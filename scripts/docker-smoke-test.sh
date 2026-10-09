#!/usr/bin/env sh
set -eu

BASE_URL="${1:-http://localhost:${APP_PORT:-8080}}"
failures=0

check() {
  description="$1"; expected="$2"; actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "ok    $description"
  else
    echo "FAIL  $description (expected $expected, got $actual)"
    failures=$((failures + 1))
  fi
}

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

check "web app is served" 200 "$(status "$BASE_URL/")"
check "client-side routes fall back to the app" 200 "$(status "$BASE_URL/app/tax-obligations")"
check "API liveness through the proxy" 200 "$(status "$BASE_URL/api/health")"
check "API readiness (PostgreSQL reachable)" 200 "$(status "$BASE_URL/api/health/ready")"
check "protected routes require a JWT" 401 "$(status "$BASE_URL/api/companies")"
check "Swagger is disabled in production" 404 "$(status "$BASE_URL/api/docs")"
check "unknown API routes answer 404" 404 "$(status "$BASE_URL/api/does-not-exist")"

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed."
  exit 1
fi
echo "All checks passed."
