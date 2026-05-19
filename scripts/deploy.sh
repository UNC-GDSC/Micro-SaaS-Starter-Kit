#!/usr/bin/env bash
# deploy.sh — executed on the VPS by the GitHub Actions SSH step.
#
# Required env vars (injected by the CI job):
#   IMAGE_TAG  — git SHA of the build to deploy (e.g. "abc1234...")
#   OWNER      — GitHub org/user (e.g. "maksimabramov105-dotcom")
#
# The script assumes /opt/resumeai contains:
#   docker-compose.yml, Caddyfile, .env   (managed manually on the VPS)

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/resumeai}"
REGISTRY="ghcr.io"
IMAGE_TAG="${IMAGE_TAG:-latest}"
OWNER="${OWNER:-maksimabramov105-dotcom}"

WEB_IMAGE="${REGISTRY}/${OWNER}/resumeai-web:${IMAGE_TAG}"
WORKER_IMAGE="${REGISTRY}/${OWNER}/resumeai-worker:${IMAGE_TAG}"

log() { echo "[$(date -u +%T)] $*"; }

log "▶ Deploying tag=${IMAGE_TAG}"
cd "$DEPLOY_DIR"

# ── 0. Login to GHCR ─────────────────────────────────────────────────────────
if [[ -n "${GHCR_TOKEN:-}" ]]; then
  log "Logging in to GHCR…"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$OWNER" --password-stdin
fi

# ── 1. Pull new images ────────────────────────────────────────────────────────
log "Pulling images…"
WEB_IMAGE="$WEB_IMAGE" WORKER_IMAGE="$WORKER_IMAGE" \
  docker compose pull web worker

# ── 2. Restart services (zero-downtime via compose's default replacement) ─────
log "Restarting services…"
WEB_IMAGE="$WEB_IMAGE" WORKER_IMAGE="$WORKER_IMAGE" \
  docker compose up -d --remove-orphans --no-build

# ── 3. Run database migrations ────────────────────────────────────────────────
log "Running Prisma migrations…"
# Invoke index.js directly so __dirname = node_modules/prisma/build/ where the
# prisma_schema_build_bg.wasm lives (copying the .bin symlink breaks __dirname)
docker compose exec -T web node node_modules/prisma/build/index.js migrate deploy

# ── 4. Wait for services to become healthy ────────────────────────────────────
log "Waiting 15 s for services to stabilise…"
sleep 15

# ── 5. Smoke tests ────────────────────────────────────────────────────────────
log "Running smoke tests…"
bash "${DEPLOY_DIR}/scripts/smoke_test.sh"

log "✅ Deploy complete — tag=${IMAGE_TAG}"
