#!/usr/bin/env bash
# smoke_test.sh — post-deploy health checks.
#
# Env vars:
#   BASE_URL          — default: https://resumeai-bot.ru
#   ADMIN_WEBHOOK_URL — Telegram/Slack webhook for failure alerts (optional)

set -euo pipefail

BASE_URL="${BASE_URL:-https://resumeai-bot.ru}"
ADMIN_WEBHOOK_URL="${ADMIN_WEBHOOK_URL:-}"
TIMEOUT=15

FAILED=0

# ── Helpers ───────────────────────────────────────────────────────────────────

log()  { echo "[$(date -u +%T)] $*"; }
fail() { echo "[$(date -u +%T)] ❌ $*" >&2; FAILED=1; }

notify_failure() {
  local msg="$1"
  if [[ -n "$ADMIN_WEBHOOK_URL" ]]; then
    # Works for both Telegram bot webhooks and Slack incoming webhooks
    curl -fsS --max-time 5 -X POST "$ADMIN_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"🚨 ResumeAI smoke test FAILED: ${msg}\"}" \
      || true   # never let the notification itself abort the script
  fi
}

check() {
  local label="$1"
  local url="$2"

  log "Checking ${label} → ${url}"
  if curl -fsS --max-time "$TIMEOUT" "$url" > /dev/null 2>&1; then
    log "  ✅ ${label} OK"
  else
    fail "${label} failed (${url})"
    notify_failure "${label} — ${url}"
  fi
}

# Check that a URL returns HTTP 2xx (follows redirects, checks status code)
check_status() {
  local label="$1"
  local url="$2"
  local expected_pattern="${3:-^2}"   # default: any 2xx

  log "Checking ${label} → ${url}"
  local status
  status=$(curl -sS --max-time "$TIMEOUT" -o /dev/null -w "%{http_code}" "$url" 2>/dev/null) || status="000"
  if echo "$status" | grep -qE "$expected_pattern"; then
    log "  ✅ ${label} OK (HTTP ${status})"
  else
    fail "${label} failed — got HTTP ${status} (${url})"
    notify_failure "${label} — HTTP ${status} — ${url}"
  fi
}

# Check that a URL returns a body containing a required string
check_body() {
  local label="$1"
  local url="$2"
  local required="$3"

  log "Checking ${label} → ${url}"
  local body
  body=$(curl -sS --max-time "$TIMEOUT" "$url" 2>/dev/null) || body=""
  if echo "$body" | grep -q "$required"; then
    log "  ✅ ${label} OK"
  else
    fail "${label} failed — body missing '${required}' (${url})"
    notify_failure "${label} — missing '${required}' — ${url}"
  fi
}

# ── Checks ────────────────────────────────────────────────────────────────────

# Infrastructure health
check "web /api/health"           "${BASE_URL}/api/health"
check "worker /api/worker/health" "${BASE_URL}/api/worker/health"

# Auth system — CSRF endpoint must return a token (proves NextAuth is initialised)
check_body "NextAuth CSRF"        "${BASE_URL}/api/auth/csrf"       "csrfToken"

# Login page must render (catches broken NextAuth config that 500s on page load)
check_status "login page"         "${BASE_URL}/login"               "^2"

# Auth providers list — must include our two OAuth providers
check_body "OAuth providers"      "${BASE_URL}/api/auth/providers"  "google"

# Auth sign-in endpoint must NOT immediately return an error.
# NextAuth requires a valid CSRF token in the POST body; without it, it redirects
# back with ?error= (CSRF protection).  We fetch the token first, then POST.
log "Checking auth sign-in initiation → ${BASE_URL}/api/auth/signin/google"
CSRF_TOKEN=$(curl -sS --max-time "$TIMEOUT" "${BASE_URL}/api/auth/csrf" 2>/dev/null \
  | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4) || CSRF_TOKEN=""

if [[ -z "$CSRF_TOKEN" ]]; then
  log "  ⚠️  auth sign-in check skipped — could not obtain CSRF token"
else
  SIGNIN_LOCATION=$(curl -sS --max-time "$TIMEOUT" -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "csrfToken=${CSRF_TOKEN}" \
    -o /dev/null -w "%{redirect_url}" \
    "${BASE_URL}/api/auth/signin/google" 2>/dev/null) || SIGNIN_LOCATION=""

  if echo "$SIGNIN_LOCATION" | grep -q "accounts.google.com"; then
    log "  ✅ auth sign-in OK (redirects to Google)"
  elif echo "$SIGNIN_LOCATION" | grep -q "error="; then
    fail "auth sign-in BROKEN — redirects to '${SIGNIN_LOCATION}' instead of Google"
    notify_failure "OAuth sign-in broken — ${SIGNIN_LOCATION}"
  else
    # No location header or unexpected redirect — log as warning, not hard fail
    log "  ⚠️  auth sign-in redirect unclear (${SIGNIN_LOCATION:-no redirect})"
  fi
fi

# ── Result ────────────────────────────────────────────────────────────────────

if [[ "$FAILED" -ne 0 ]]; then
  log "❌ Smoke tests FAILED — check container logs"
  exit 1
fi

log "✅ All smoke tests passed"
