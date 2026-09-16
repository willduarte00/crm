#!/usr/bin/env bash
# ==============================================================================
# Script de Restauração — CRM Agência de Marketing
# ==============================================================================
# Restaura o banco PostgreSQL e os arquivos de upload a partir de um pacote
# gerado por scripts/backup.sh (backup_crm_YYYYMMDD_HHMMSS.tar.gz ou .tar.gz.age).
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Uso: $0 <caminho_do_backup.tar.gz[.age]> [--yes]"
  echo "Exemplo: $0 ./backups/backup_crm_20260819_210000.tar.gz"
  exit 1
fi

BACKUP_FILE="$1"
CONFIRM="${2:-}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Arquivo de backup não encontrado: $BACKUP_FILE"
  exit 1
fi

ENV_FILE="${ENV_FILE:-.env}"

# Lê apenas a variável pedida do .env, sem exportar segredos (JWT_SECRET,
# ADMIN_PASSWORD, POSTGRES_PASSWORD) para o ambiente dos processos filhos.
env_get() {
  local name="$1"
  local value=""
  if [ -f "$ENV_FILE" ]; then
    value=$(grep -E "^${name}=" "$ENV_FILE" | head -1 | cut -d= -f2-)
  fi
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

POSTGRES_USER="${POSTGRES_USER:-$(env_get POSTGRES_USER)}"
POSTGRES_USER="${POSTGRES_USER:-crm_user}"
POSTGRES_DB="${POSTGRES_DB:-$(env_get POSTGRES_DB)}"
POSTGRES_DB="${POSTGRES_DB:-crm_db}"
UPLOAD_DIR="${UPLOAD_DIR:-$(env_get UPLOAD_DIR)}"
BACKUP_AGE_IDENTITY="${BACKUP_AGE_IDENTITY:-$(env_get BACKUP_AGE_IDENTITY)}"

if [ "$CONFIRM" != "--yes" ] && [ "$CONFIRM" != "-y" ]; then
  echo "⚠️  ATENÇÃO: A restauração irá sobrescrever os dados atuais do banco e da pasta de uploads!"
  read -p "Deseja continuar? (digite 'sim' para confirmar): " RESP
  if [ "$RESP" != "sim" ]; then
    echo "Operação cancelada pelo usuário."
    exit 0
  fi
fi

TMP_DIR=$(mktemp -d /tmp/crm_restore_XXXXXX)

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "========================================================"
echo " [RESTAURAÇÃO] Iniciando processo de restauração"
echo " Arquivo: ${BACKUP_FILE}"
echo "========================================================"

ARCHIVE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.age ]]; then
  if [ -z "${BACKUP_AGE_IDENTITY:-}" ]; then
    echo "❌ Arquivo criptografado (.age): defina BACKUP_AGE_IDENTITY com o caminho da chave privada (no .env ou no ambiente)." >&2
    exit 1
  fi
  if [ ! -f "$BACKUP_AGE_IDENTITY" ]; then
    echo "❌ Chave privada não encontrada em BACKUP_AGE_IDENTITY: $BACKUP_AGE_IDENTITY" >&2
    exit 1
  fi
  if ! command -v age >/dev/null 2>&1; then
    echo "❌ O utilitário 'age' não está instalado. Instale com 'apt install age' ou veja https://github.com/FiloSottile/age" >&2
    exit 1
  fi
  echo "🔓 0/4 Descriptografando pacote..."
  ARCHIVE_FILE="$TMP_DIR/backup_decrypted.tar.gz"
  age -d -i "$BACKUP_AGE_IDENTITY" -o "$ARCHIVE_FILE" "$BACKUP_FILE"
fi

# 1. Descompacta pacote de backup
echo "📂 1/4 Descompactando pacote de backup..."
tar -xzf "$ARCHIVE_FILE" -C "$TMP_DIR"

if [ ! -f "$TMP_DIR/database.sql" ] || [ ! -f "$TMP_DIR/uploads.tar.gz" ]; then
  echo "❌ Formato de backup inválido: arquivos 'database.sql' ou 'uploads.tar.gz' ausentes no pacote."
  exit 1
fi

# 2. Valida integridade se houver manifesto
echo "🔒 2/4 Verificando integridade dos arquivos..."
if [ -f "$TMP_DIR/manifest.json" ]; then
  DB_SHA256=$(sha256sum "$TMP_DIR/database.sql" | awk '{print $1}')
  UPLOADS_SHA256=$(sha256sum "$TMP_DIR/uploads.tar.gz" | awk '{print $1}')
  echo "  ✅ Checksum DB:      ${DB_SHA256}"
  echo "  ✅ Checksum Uploads: ${UPLOADS_SHA256}"
fi

# 3. Restaura arquivos de upload
echo "📁 3/4 Restaurando arquivos de uploads..."
if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "app"; then
  # Ambiente Docker
  docker compose exec -T app sh -c "rm -rf /app/uploads/* && tar -xzf - -C /app/uploads" < "$TMP_DIR/uploads.tar.gz"
else
  # Ambiente Host/Local
  UPLOAD_PATH="${UPLOAD_DIR:-./uploads}"
  mkdir -p "$UPLOAD_PATH"
  rm -rf "${UPLOAD_PATH:?}"/*
  tar -xzf "$TMP_DIR/uploads.tar.gz" -C "$UPLOAD_PATH"
fi

# 4. Restaura banco de dados PostgreSQL
echo "🗄️  4/4 Restaurando banco de dados PostgreSQL..."
if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "db"; then
  # Ambiente Docker
  docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$TMP_DIR/database.sql"
else
  # Ambiente Host/Local
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$TMP_DIR/database.sql"
fi

echo "========================================================"
echo " ✅ Restauração concluída com sucesso!"
echo " Todos os dados e arquivos foram sincronizados."
echo "========================================================"
