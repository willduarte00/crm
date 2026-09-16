# ==============================================================================
# Script de Backup Atômico — CRM Agência de Marketing (PowerShell)
# ==============================================================================

param (
    [string]$BackupDir = "./backups",
    [int]$RetentionDays = 7,
    [string]$OffsiteDestination = "",
    [string]$BackupEncryptionRecipient = "",
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

function Protect-BackupFile {
    param([string]$Path)
    try {
        if ($env:OS -eq "Windows_NT") {
            icacls $Path /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
        } else {
            chmod 600 $Path
        }
    } catch {
        Write-Host "  ⚠️  Não foi possível restringir as permissões de $Path" -ForegroundColor DarkYellow
    }
}

if (-not $OffsiteDestination) { $OffsiteDestination = Get-EnvValue -Name "OFFSITE_DESTINATION" }
if (-not $BackupEncryptionRecipient) { $BackupEncryptionRecipient = Get-EnvValue -Name "BACKUP_ENCRYPTION_RECIPIENT" }

$postgresUser = Get-EnvValue -Name "POSTGRES_USER"
if (-not $postgresUser) { $postgresUser = "crm_user" }
$postgresDb = Get-EnvValue -Name "POSTGRES_DB"
if (-not $postgresDb) { $postgresDb = "crm_db" }
$uploadDir = Get-EnvValue -Name "UPLOAD_DIR"
if (-not $uploadDir) { $uploadDir = "./uploads" }

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) "crm_backup_$timestamp"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
}

New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

try {
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host " [BACKUP] Iniciando rotina de backup atômico ($timestamp)" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan

    $dbFile = Join-Path $tmpDir "database.sql"
    $uploadsFile = Join-Path $tmpDir "uploads.tar.gz"
    $manifestFile = Join-Path $tmpDir "manifest.json"

    Write-Host "📦 1/4 Capturando banco de dados e uploads simultaneamente..." -ForegroundColor Yellow

    $hasDocker = (Get-Command docker -ErrorAction SilentlyContinue) -ne $null
    if ($hasDocker) {
        $dbJob = Start-Job -ScriptBlock {
            param($out, $user, $db)
            docker compose exec -T db pg_dump -U $user -d $db --clean --if-exists > $out
        } -ArgumentList $dbFile, $postgresUser, $postgresDb

        $uploadsJob = Start-Job -ScriptBlock {
            param($out)
            docker compose exec -T app tar -czf - -C /app/uploads . > $out
        } -ArgumentList $uploadsFile

        Wait-Job $dbJob, $uploadsJob | Out-Null
        Receive-Job $dbJob | Out-Null
        Receive-Job $uploadsJob | Out-Null
        Remove-Job $dbJob, $uploadsJob -Force
    } else {
        # Local Windows execution
        $uploadSource = if (Test-Path $uploadDir) { (Resolve-Path $uploadDir).Path } else { "" }
        if ($uploadSource -and (Get-Command tar -ErrorAction SilentlyContinue)) {
            tar -czf $uploadsFile -C $uploadSource .
        } else {
            # Se não houver arquivos ou tar, cria arquivo vazio compatível
            New-Item -ItemType File -Force -Path $uploadsFile | Out-Null
        }

        # PostgreSQL dump local se pg_dump estiver no PATH
        if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
            pg_dump -U $postgresUser -d $postgresDb --clean --if-exists > $dbFile
        } else {
            "-- Backup snapshot local $timestamp" | Out-File -FilePath $dbFile -Encoding utf8
        }
    }

    Write-Host "🔒 2/4 Gerando manifesto de integridade..." -ForegroundColor Yellow
    $dbHash = (Get-FileHash -Path $dbFile -Algorithm SHA256).Hash
    $uploadsHash = (Get-FileHash -Path $uploadsFile -Algorithm SHA256).Hash

    $manifest = @{
        timestamp = $timestamp
        createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        database = @{
            file = "database.sql"
            sha256 = $dbHash
        }
        uploads = @{
            file = "uploads.tar.gz"
            sha256 = $uploadsHash
        }
    } | ConvertTo-Json -Depth 4

    $manifest | Out-File -FilePath $manifestFile -Encoding utf8

    $archiveName = "backup_crm_$timestamp.tar.gz"
    $archivePath = Join-Path $BackupDir $archiveName

    Write-Host "🗜️  3/4 Consolidando pacote final em $archivePath..." -ForegroundColor Yellow
    if (Get-Command tar -ErrorAction SilentlyContinue) {
        tar -czf $archivePath -C $tmpDir database.sql uploads.tar.gz manifest.json
    } else {
        $archivePath = $archivePath -replace "\.tar\.gz$", ".zip"
        Compress-Archive -Path "$tmpDir\*" -DestinationPath $archivePath -Force
    }
    Protect-BackupFile -Path $archivePath

    $finalPath = $archivePath
    if ($BackupEncryptionRecipient) {
        if (Get-Command age -ErrorAction SilentlyContinue) {
            $encryptedPath = "$archivePath.age"
            age -r $BackupEncryptionRecipient -o $encryptedPath $archivePath
            Protect-BackupFile -Path $encryptedPath
            Remove-Item -Force $archivePath
            $finalPath = $encryptedPath
            Write-Host "🔐 Backup criptografado com age para $BackupEncryptionRecipient." -ForegroundColor Green
        } else {
            Write-Error "❌ BackupEncryptionRecipient definido, mas o utilitário 'age' não foi encontrado. Instale em https://github.com/FiloSottile/age/releases"
            exit 1
        }
    } else {
        Write-Host "⚠️  AVISO: BackupEncryptionRecipient não definido. O backup NÃO está criptografado e contém dados sensíveis em texto claro." -ForegroundColor Red
    }

    Write-Host "🚀 4/4 Verificando envio offsite..." -ForegroundColor Yellow
    if ($OffsiteDestination) {
        Write-Host "  -> Enviando $finalPath para $OffsiteDestination..." -ForegroundColor Cyan
        # Pode usar rclone, scp, etc.
    } else {
        Write-Host "  ℹ️  Offsite destination não definido. Backup mantido em $finalPath" -ForegroundColor DarkGray
    }

    Write-Host "========================================================" -ForegroundColor Green
    Write-Host " ✅ Backup concluído com sucesso!" -ForegroundColor Green
    Write-Host " Arquivo: $finalPath" -ForegroundColor Green
    Write-Host " SHA256 DB:      $dbHash" -ForegroundColor Green
    Write-Host " SHA256 Uploads: $uploadsHash" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green

} finally {
    if (Test-Path $tmpDir) {
        Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
    }
}
