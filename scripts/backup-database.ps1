# ==============================================================================
# MRM InfoTech - Automated Database Backup Script (PowerShell / Windows)
# ==============================================================================
param (
    [string]$BackupDir = "./backups",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$DatabaseUrl = $env:DATABASE_URL
if (-not $DatabaseUrl -and (Test-Path ".env")) {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^DATABASE_URL=(.+)$') {
            $DatabaseUrl = $matches[1].Trim('"').Trim("'")
        }
    }
}

if (-not $DatabaseUrl) {
    Write-Error "[-] ERROR: DATABASE_URL is not set."
    exit 1
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$OutputFile = Join-Path $BackupDir "mrm_backup_$Timestamp.sql"

Write-Host "[+] Starting PostgreSQL database backup..."
Write-Host "[+] Target: $OutputFile"

try {
    # Check if pg_dump is available
    if (Get-Command "pg_dump" -ErrorAction SilentlyContinue) {
        & pg_dump "$DatabaseUrl" --clean --if-exists --no-owner --no-privileges -f "$OutputFile"
        Write-Host "[+] Backup written: $OutputFile"
    } else {
        Write-Warning "[!] pg_dump executable not found in PATH. Ensure PostgreSQL client tools are installed."
    }
} catch {
    Write-Error "[-] Backup failed: $_"
    exit 1
}

# Retention cleanup
Write-Host "[+] Checking backup retention..."
$Cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "mrm_backup_*.sql*" | Where-Object { $_.LastWriteTime -lt $Cutoff } | Remove-Item -Force
Write-Host "[+] Backup process complete."

