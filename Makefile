.PHONY: dev up down logs psql migrate

# ── Local development (no Docker) ────────────────────────────────────────────
# Runs Next.js + Python worker in parallel; Ctrl-C stops both.
dev:
	@echo "→ Starting Next.js and Python worker (Ctrl-C to stop both)"
	@trap 'kill 0' INT; \
	  npm run dev & \
	  (cd worker && uv run uvicorn worker.main:app --reload --port 8000) & \
	  wait

# ── Docker Compose ────────────────────────────────────────────────────────────
up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

# ── Database helpers ──────────────────────────────────────────────────────────
psql:
	docker compose exec postgres psql -U resumeai resumeai

migrate:
	npx prisma migrate deploy
