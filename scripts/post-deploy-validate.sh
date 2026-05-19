#!/usr/bin/env bash
# post-deploy-validate.sh — full post-deployment validation
# Run manually on the VPS after any deploy or infrastructure change.
# Usage:  bash /opt/resumeai/scripts/post-deploy-validate.sh
#
# Exit codes: 0 = all checks passed, 1 = one or more checks failed

set -euo pipefail

DOMAIN="${DOMAIN:-resumeai-bot.ru}"
PASS=0
FAIL=0
RESULTS=()

pass() { PASS=$((PASS+1)); RESULTS+=("  ✅  $1"); }
fail() { FAIL=$((FAIL+1)); RESULTS+=("  ❌  $1"); }
info() { RESULTS+=("  ℹ️   $1"); }

hr() { echo "────────────────────────────────────────────────────"; }

echo ""
hr
echo "  Post-deploy validation — $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "  Domain: ${DOMAIN}"
hr
echo ""

# ── 1. Docker container health ──────────────────────────────────────────────
echo "[1/6] Container health..."
for svc in db redis web worker caddy; do
  status=$(docker inspect --format='{{.State.Health.Status}}' "resumeai-${svc}" 2>/dev/null || echo "missing")
  if [[ "$status" == "healthy" ]]; then
    pass "resumeai-${svc}: healthy"
  else
    fail "resumeai-${svc}: ${status}"
  fi
done

# ── 2. HTTP endpoints ────────────────────────────────────────────────────────
echo "[2/6] HTTP endpoints..."
check_http() {
  local label="$1" url="$2" expected="$3"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [[ "$code" == "$expected" ]]; then
    pass "${label}: HTTP ${code}"
  else
    fail "${label}: expected ${expected}, got ${code} (${url})"
  fi
}
check_http "Homepage"        "https://${DOMAIN}/"                  "200"
check_http "Health (web)"    "https://${DOMAIN}/api/health"        "200"
check_http "Health (worker)" "https://${DOMAIN}/api/worker/health" "200"
check_http "Sign-in page"    "https://${DOMAIN}/login"             "200"

# ── 3. TLS + HSTS ───────────────────────────────────────────────────────────
echo "[3/6] TLS / HSTS..."
cert_expiry=$(echo | openssl s_client -connect "${DOMAIN}:443" -servername "${DOMAIN}" 2>/dev/null \
  | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [[ -n "$cert_expiry" ]]; then
  days_left=$(( ( $(date -d "$cert_expiry" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$cert_expiry" +%s 2>/dev/null) - $(date +%s) ) / 86400 ))
  if [[ "$days_left" -gt 14 ]]; then
    pass "TLS cert valid for ${days_left} days (expires ${cert_expiry})"
  else
    fail "TLS cert expires in ${days_left} days — RENEW NOW"
  fi
else
  fail "TLS cert check failed"
fi

hsts=$(curl -sI "https://${DOMAIN}/" 2>/dev/null | grep -i "strict-transport-security" | tr -d '\r' || true)
if [[ -n "$hsts" ]]; then
  pass "HSTS: ${hsts}"
else
  fail "HSTS header missing"
fi

# ── 4. Database ──────────────────────────────────────────────────────────────
echo "[4/6] Database..."
table_count=$(docker compose -f /opt/resumeai/docker-compose.yml exec -T postgres \
  psql -U resumeai -d resumeai -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" \
  2>/dev/null | tr -d ' \r\n' || echo "0")
if [[ "$table_count" -ge 21 ]]; then
  pass "DB: ${table_count} tables present (migrations applied)"
else
  fail "DB: only ${table_count} tables found (expected ≥21)"
fi

migration_count=$(docker compose -f /opt/resumeai/docker-compose.yml exec -T postgres \
  psql -U resumeai -d resumeai -tAc \
  "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;" \
  2>/dev/null | tr -d ' \r\n' || echo "0")
info "DB: ${migration_count} Prisma migrations applied"

# ── 5. Worker crypto ─────────────────────────────────────────────────────────
echo "[5/6] Worker crypto..."
crypto_ok=$(docker compose -f /opt/resumeai/docker-compose.yml exec -T worker \
  python3 -c '
from worker.crypto import encrypt, decrypt
msg = "smoke-test-2026"
result = decrypt(encrypt(msg))
ok = (result == msg) or (result == msg.encode())
print("CRYPTO_OK" if ok else "CRYPTO_FAIL:" + repr(result))
' 2>&1 | grep -o 'CRYPTO_OK\|CRYPTO_FAIL[^$]*' | head -1 || echo "CRYPTO_FAIL:exception")
if [[ "$crypto_ok" == "CRYPTO_OK" ]]; then
  pass "Worker crypto: encrypt/decrypt round-trip OK"
else
  fail "Worker crypto: round-trip FAILED (${crypto_ok})"
fi

# ── 6. Disk space ────────────────────────────────────────────────────────────
echo "[6/6] Disk space..."
used_pct=$(df / | awk 'NR==2{print $5}' | tr -d '%')
if [[ "$used_pct" -lt 85 ]]; then
  pass "Disk: ${used_pct}% used ($(df -h / | awk 'NR==2{print $4}') free)"
else
  fail "Disk: ${used_pct}% used — LOW SPACE WARNING"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
hr
echo "  Results: ${PASS} passed, ${FAIL} failed"
hr
for r in "${RESULTS[@]}"; do echo "$r"; done
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo "  ⚠️  ${FAIL} check(s) FAILED — review above"
  exit 1
else
  echo "  ✅  All ${PASS} checks passed — production is healthy"
  exit 0
fi
