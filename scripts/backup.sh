#!/usr/bin/env bash
# ==============================================================================
# Script de Backup Atômico — CRM Agência de Marketing
# ==============================================================================
# Captura o dump do PostgreSQL e a pasta de uploads NO MESMO INSTANTE.
# Gera um pacote consolidado: backup_crm_YYYYMMDD_HHMMSS.tar.gz
# ==============================================================================

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Carrega variáveis do .env se existir
if [ -f .env ]; then
  # shellcheck disable=SC1091
  export $(grep -v '^#' .env | xargs)
fi

POSTGRES_USER="${POSTGRES_USER:-crm_user}"
POSTGRES_DB="${POSTGRES_DB:-crm_db}"

mkdir -p "$BACKUP_DIR"
TMP_DIR=$(mktemp -d /tmp/crm_backup_XXXXXX)

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "========================================================"
echo " [BACKUP] Iniciando rotina de backup atômico (${TIMESTAMP})"
echo "========================================================"

# 1. Executa dump do banco e compactação de uploads simultaneamente
echo "📦 1/4 Capturando banco de dados e uploads simultaneamente..."

if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "db"; then
  # Ambiente Docker Compose
  docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists > "$TMP_DIR/database.sql" &
  PID_DB=$!

  docker compose exec -T app tar -czf - -C /app/uploads . > "$TMP_DIR/uploads.tar.gz" &
  PID_UPLOADS=$!

  wait $PID_DB
  wait $PID_UPLOADS
else
  # Ambiente Host/Local
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists > "$TMP_DIR/database.sql" &
  PID_DB=$!

  UPLOAD_PATH="${UPLOAD_DIR:-./uploads}"
  mkdir -p "$UPLOAD_PATH"
  tar -czf "$TMP_DIR/uploads.tar.gz" -C "$UPLOAD_PATH" . &
  PID_UPLOADS=$!

  wait $PID_DB
  wait $PID_UPLOADS
fi

# 2. Gera manifesto com checksums
echo "🔒 2/4 Gerando manifesto de integridade..."
DB_SHA256=$(sha256sum "$TMP_DIR/database.sql" | awk '{print $1}')
UPLOADS_SHA256=$(sha256sum "$TMP_DIR/uploads.tar.gz" | awk '{print $1}')

cat <<EOF > "$TMP_DIR/manifest.json"
{
  "timestamp": "${TIMESTAMP}",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "database": {
    "file": "database.sql",
    "sha256": "${DB_SHA256}"
  },
  "uploads": {
    "file": "uploads.tar.gz",
    "sha256": "${UPLOADS_SHA256}"
  }
}
EOF

# 3. Empacota o arquivo final
ARCHIVE_NAME="backup_crm_${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="${BACKUP_DIR}/${ARCHIVE_NAME}"

echo "🗜️  3/4 Consolidando pacote final em ${ARCHIVE_PATH}..."
tar -czf "$ARCHIVE_PATH" -C "$TMP_DIR" database.sql uploads.tar.gz manifest.json

# 4. Envio para fora da VPS (se configurado)
echo "🚀 4/4 Verificando envio offsite..."
if [ -n "${OFFSITE_DESTINATION:-}" ]; then
  if command -v rclone >/dev/null 2>&1; then
    echo "  -> Enviando via rclone para ${OFFSITE_DESTINATION}..."
    rclone copy "$ARCHIVE_PATH" "${OFFSITE_DESTINATION}"
    echo "  ✅ Backup enviado com sucesso para storage offsite."
  elif command -v scp >/dev/null 2>&1; then
    echo "  -> Enviando via scp para ${OFFSITE_DESTINATION}..."
    scp "$ARCHIVE_PATH" "${OFFSITE_DESTINATION}"
    echo "  ✅ Backup enviado com sucesso para servidor remoto."
  else
    echo "  ⚠️  OFFSITE_DESTINATION configurado, mas nem rclone nem scp foram encontrados."
  fi
else
  echo "  ℹ️  OFFSITE_DESTINATION não definido. Backup mantido localmente em ${ARCHIVE_PATH}."
fi

# 5. Limpeza de backups antigos locais
if [ "$RETENTION_DAYS" -gt 0 ]; then
  find "$BACKUP_DIR" -name "backup_crm_*.tar.gz" -mtime +"$RETENTION_DAYS" -delete || true
fi

echo "========================================================"
echo " ✅ Backup concluído com sucesso!"
echo " Arquivo: ${ARCHIVE_PATH}"
echo " SHA256 DB:      ${DB_SHA256}"
echo " SHA256 Uploads: ${UPLOADS_SHA256}"
echo "========================================================"
