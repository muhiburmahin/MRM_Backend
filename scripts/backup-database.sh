#!/usr/bin/env bash
# ==============================================================================
# MRM InfoTech - Automated Database Backup Script (PostgreSQL)
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="mrm_backup_${TIMESTAMP}.sql.gz"
TARGET_PATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "${BACKUP_DIR}"

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ]; then
    # Load DATABASE_URL from local .env if available
    export $(grep -v '^#' .env | grep -E '^DATABASE_URL=' | xargs)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[-] ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

echo "[+] Starting PostgreSQL database backup..."
echo "[+] Target: ${TARGET_PATH}"

# Execute pg_dump with clean, no-owner, and gzip compression
pg_dump "${DATABASE_URL}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  | gzip > "${TARGET_PATH}"

BACKUP_SIZE=$(ls -lh "${TARGET_PATH}" | awk '{print $5}')
echo "[+] Backup completed successfully! File: ${FILENAME} (${BACKUP_SIZE})"

# Retention management: purge backups older than RETENTION_DAYS
echo "[+] Cleaning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -name "mrm_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete || true

echo "[+] Database backup procedure finished successfully."

