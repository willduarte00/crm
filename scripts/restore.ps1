# ==============================================================================
# Script de Restauração — CRM Agência de Marketing (PowerShell)
# ==============================================================================

param (
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [switch]$Yes
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    Write-Error "❌ Arquivo de backup não encontrado: $BackupFile"
    exit 1
}

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

    Write-Host "📂 1/4 Descompactando pacote de backup..." -ForegroundColor Yellow
    if ($BackupFile.EndsWith(".tar.gz")) {
        tar -xzf $BackupFile -C $tmpDir
    } else {
        Expand-Archive -Path $BackupFile -DestinationPath $tmpDir -Force
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
        if (-not (Test-Path "./uploads")) {
            New-Item -ItemType Directory -Force -Path "./uploads" | Out-Null
        }
        if (Test-Path $uploadsFile) {
            tar -xzf $uploadsFile -C "./uploads"
        }
    }

    Write-Host "🗄️  4/4 Restaurando banco de dados PostgreSQL..." -ForegroundColor Yellow
    if ($hasDocker) {
        Get-Content $dbFile -Raw | docker compose exec -T db psql -U crm_user -d crm_db
    } elseif (Get-Command psql -ErrorAction SilentlyContinue) {
        psql -U crm_user -d crm_db < $dbFile
    }

    Write-Host "========================================================" -ForegroundColor Green
    Write-Host " ✅ Restauração concluída com sucesso!" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green

} finally {
    if (Test-Path $tmpDir) {
        Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
    }
}
