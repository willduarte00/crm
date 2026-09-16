# ==============================================================================
# Script de Restauração — CRM Agência de Marketing (PowerShell)
# ==============================================================================

param (
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [switch]$Yes,
    [string]$BackupAgeIdentity = "",
    [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"

# Lê apenas a variável pedida do .env, nunca JWT_SECRET/ADMIN_PASSWORD/POSTGRES_PASSWORD.
function Get-EnvValue {
    param([string]$Name)
    if (-not (Test-Path $EnvFile)) { return "" }
    $match = Select-String -Path $EnvFile -Pattern "^$Name=" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $match) { return "" }
    $value = $match.Line.Substring($Name.Length + 1)
    return $value.Trim('"').Trim("'")
}

if (-not (Test-Path $BackupFile)) {
    Write-Error "❌ Arquivo de backup não encontrado: $BackupFile"
    exit 1
}

if (-not $BackupAgeIdentity) { $BackupAgeIdentity = Get-EnvValue -Name "BACKUP_AGE_IDENTITY" }
$postgresUser = Get-EnvValue -Name "POSTGRES_USER"
if (-not $postgresUser) { $postgresUser = "crm_user" }
$postgresDb = Get-EnvValue -Name "POSTGRES_DB"
if (-not $postgresDb) { $postgresDb = "crm_db" }
$uploadDir = Get-EnvValue -Name "UPLOAD_DIR"
if (-not $uploadDir) { $uploadDir = "./uploads" }

if (-not $Yes) {
    $confirm = Read-Host "⚠️  ATENÇÃO: A restauração irá sobrescrever os dados atuais! Digite 'sim' para continuar"
    if ($confirm -ne "sim") {
        Write-Host "Operação cancelada pelo usuário."
        exit 0
    }
}

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("crm_restore_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

try {
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host " [RESTAURAÇÃO] Iniciando processo de restauração" -ForegroundColor Cyan
    Write-Host " Arquivo: $BackupFile" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan

    $archiveFile = $BackupFile
    if ($BackupFile.EndsWith(".age")) {
        if (-not $BackupAgeIdentity) {
            Write-Error "❌ Arquivo criptografado (.age): defina -BackupAgeIdentity ou BACKUP_AGE_IDENTITY no .env com o caminho da chave privada."
            exit 1
        }
        if (-not (Test-Path $BackupAgeIdentity)) {
            Write-Error "❌ Chave privada não encontrada: $BackupAgeIdentity"
            exit 1
        }
        if (-not (Get-Command age -ErrorAction SilentlyContinue)) {
            Write-Error "❌ O utilitário 'age' não está instalado. Veja https://github.com/FiloSottile/age/releases"
            exit 1
        }
        Write-Host "🔓 0/4 Descriptografando pacote..." -ForegroundColor Yellow
        $archiveFile = Join-Path $tmpDir "backup_decrypted.tar.gz"
        age -d -i $BackupAgeIdentity -o $archiveFile $BackupFile
    }

    Write-Host "📂 1/4 Descompactando pacote de backup..." -ForegroundColor Yellow
    if ($archiveFile.EndsWith(".tar.gz")) {
        tar -xzf $archiveFile -C $tmpDir
    } else {
        Expand-Archive -Path $archiveFile -DestinationPath $tmpDir -Force
    }

    $dbFile = Join-Path $tmpDir "database.sql"
    $uploadsFile = Join-Path $tmpDir "uploads.tar.gz"
    $manifestFile = Join-Path $tmpDir "manifest.json"

    if (Test-Path $manifestFile) {
        Write-Host "🔒 2/4 Verificando integridade..." -ForegroundColor Yellow
        $manifest = Get-Content $manifestFile -Raw | ConvertFrom-Json
        Write-Host "  Manifesto de: $($manifest.createdAt)" -ForegroundColor DarkGray
    }

    Write-Host "📁 3/4 Restaurando arquivos de uploads..." -ForegroundColor Yellow
    $hasDocker = (Get-Command docker -ErrorAction SilentlyContinue) -ne $null
    if ($hasDocker) {
        Get-Content $uploadsFile -Raw | docker compose exec -T app sh -c "rm -rf /app/uploads/* && tar -xzf - -C /app/uploads"
    } else {
        if (-not (Test-Path $uploadDir)) {
            New-Item -ItemType Directory -Force -Path $uploadDir | Out-Null
        }
        if (Test-Path $uploadsFile) {
            tar -xzf $uploadsFile -C $uploadDir
        }
    }

    Write-Host "🗄️  4/4 Restaurando banco de dados PostgreSQL..." -ForegroundColor Yellow
    if ($hasDocker) {
        Get-Content $dbFile -Raw | docker compose exec -T db psql -U $postgresUser -d $postgresDb
    } elseif (Get-Command psql -ErrorAction SilentlyContinue) {
        psql -U $postgresUser -d $postgresDb < $dbFile
    }

    Write-Host "========================================================" -ForegroundColor Green
    Write-Host " ✅ Restauração concluída com sucesso!" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green

} finally {
    if (Test-Path $tmpDir) {
        Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
    }
}
