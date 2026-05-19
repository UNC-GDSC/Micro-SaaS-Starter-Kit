#!/usr/bin/env bash
# backup_db.sh — pg_dump the ResumeAI database, gzip, rotate old files.
#
# Add to /opt/resumeai crontab:
#   0 3 * * * /opt/resumeai/scripts/backup_db.sh >> /var/log/resumeai-backup.log 2>&1
#
# Env vars (override via .env or cron environment):
#   BACKUP_DIR      — destination directory (default: /backups)
#   DB_CONTAINER    — name of the postgres container (default: resumeai-db)
#   DB_USER         — Postgres user (default: resumeai)
#   DB_NAME         — Postgres database (default: resumeai)
#   RETENTION_DAYS  — days to keep backups (default: 30)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_CONTAINER="${DB_CONTAINER:-resumeai-db}"
DB_USER="${DB_USER:-resumeai}"
DB_NAME="${DB_NAME:-resumeai}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
FILENAME="${BACKUP_DIR}/resumeai-${TIMESTAMP}.sql.gz"

log() { echo "[$(date -u +%T)] $*"; }

# ── 1. Ensure backup directory exists ────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── 2. Dump ───────────────────────────────────────────────────────────────────
log "Dumping ${DB_NAME} from container ${DB_CONTAINER}…"
docker exec "$DB_CONTAINER" \
  pg_dump -U "$DB_USER" --no-password "$DB_NAME" \
  | gzip > "$FILENAME"

SIZE="$(du -sh "$FILENAME" | cut -f1)"
log "✅ Backup written: ${FILENAME} (${SIZE})"

# ── 3. Rotate old backups ─────────────────────────────────────────────────────
log "Rotating backups older than ${RETENTION_DAYS} days…"
DELETED="$(find "$BACKUP_DIR" -name "resumeai-*.sql.gz" \
  -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
log "   Removed ${DELETED} old backup(s)"

log "Done. Current backup count: $(find "$BACKUP_DIR" -name "resumeai-*.sql.gz" | wc -l | tr -d ' ')"
