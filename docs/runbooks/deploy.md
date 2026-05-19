# Deploy Runbook

Production URL: **https://resumeai-bot.ru**  
VPS: `root@72.56.250.53` · Deploy dir: `/opt/resumeai`  
Images: `ghcr.io/maksimabramov105-dotcom/resumeai-web` + `resumeai-worker`

---

## Normal deploy (automated)

Push to `main` → GitHub Actions runs automatically:

1. **test** — `type-check` + `jest --ci` + `prisma validate`
2. **build** — builds both Docker images, pushes to GHCR with `sha-<commit>` + `latest` tags
3. **deploy** — SSHes into the VPS, runs `scripts/deploy.sh`, runs smoke tests

Monitor progress at:  
`https://github.com/maksimabramov105-dotcom/Micro-SaaS-Starter-Kit/actions`

---

## Pre-deploy checklist (for risky changes)

Before merging to `main` when you're shipping DB migrations or breaking changes:

- [ ] Take a manual backup: `ssh root@72.56.250.53 "bash /opt/resumeai/scripts/backup_db.sh"`
- [ ] Verify migration is safe: `npx prisma migrate diff --from-schema-datasource --to-schema-datamodel prisma/schema.prisma --script`
- [ ] If adding NOT NULL columns: backfill default values first in a separate migration
- [ ] No live traffic spike expected (check Caddy access log)
- [ ] PR reviewed and approved

---

## Manual deploy

```bash
# On your laptop — trigger a deploy of the current HEAD of main:
ssh root@72.56.250.53

# On the VPS:
cd /opt/resumeai
export IMAGE_TAG=<git-sha>          # e.g. abc1234def5...
export OWNER=maksimabramov105-dotcom
bash scripts/deploy.sh
```

---

## Rollback

```bash
ssh root@72.56.250.53
cd /opt/resumeai

# Find the previous tag (GHCR shows image history, or check Actions run)
PREV_TAG=<previous-git-sha>

# Pull and restart with old images
WEB_IMAGE="ghcr.io/maksimabramov105-dotcom/resumeai-web:${PREV_TAG}" \
WORKER_IMAGE="ghcr.io/maksimabramov105-dotcom/resumeai-worker:${PREV_TAG}" \
  docker compose up -d --no-build

# If the rollback also reverses a migration:
# There is no automatic down-migration. Restore from backup instead:
# docker compose exec -T postgres psql -U resumeai resumeai < /backups/resumeai-YYYYMMDD_HHMMSS.sql
```

> **Note:** Prisma does not generate `down` migrations automatically. For DB
> rollbacks, always restore from the pre-deploy backup.

---

## Reading logs

```bash
# All services (last 200 lines, follow)
docker compose -f /opt/resumeai/docker-compose.yml logs -f --tail=200

# Single service
docker compose logs -f --tail=200 web
docker compose logs -f --tail=200 worker
docker compose logs -f --tail=200 caddy

# Caddy access log (structured JSON)
tail -f /var/lib/docker/volumes/resumeai_caddy_logs/_data/access.log | jq '.'

# Backup log
tail -f /var/log/resumeai-backup.log
```

---

## Required GitHub Secrets

Set these in **Settings → Secrets and variables → Actions → Repository secrets**:

| Secret | Value |
|---|---|
| `VPS_HOST` | `72.56.250.53` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Private key matching the key in `~/.ssh/authorized_keys` on the VPS |
| `GHCR_TOKEN` | GitHub PAT with `write:packages` scope |

---

## VPS first-time setup

```bash
ssh root@72.56.250.53

# Create deploy dir and copy files
mkdir -p /opt/resumeai/scripts /backups

# Copy docker-compose.yml, Caddyfile, scripts/ from the repo
# Create .env with all secrets (see .env.production.template)
cp /path/to/.env.production.template /opt/resumeai/.env
# Fill in all values

# Login to GHCR so docker can pull images
echo "$GHCR_TOKEN" | docker login ghcr.io -u USERNAME --password-stdin

# Make scripts executable
chmod +x /opt/resumeai/scripts/*.sh

# Add backup cron (runs at 03:00 UTC daily)
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/resumeai/scripts/backup_db.sh >> /var/log/resumeai-backup.log 2>&1") | crontab -

# First deploy
export IMAGE_TAG=latest
export OWNER=maksimabramov105-dotcom
bash /opt/resumeai/scripts/deploy.sh
```

---

## Smoke test (manual)

```bash
BASE_URL=https://resumeai-bot.ru bash /opt/resumeai/scripts/smoke_test.sh
```

Expected output:
```
✅ web /api/health OK
✅ worker /api/worker/health OK
✅ All smoke tests passed
```
