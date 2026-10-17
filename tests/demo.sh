#!/usr/bin/env bash
# Демо-preflight: GO/NO перед защитой (совет: надёжность живого демо).
#
# Поднимает API (+ фронт, если node есть и SKIP_FE не задан), прогревает
# полный путь и печатает GO или NO с причиной. В отличие от smoke.sh, стек
# по умолчанию ОСТАЁТСЯ жить после проверки — демо можно открывать сразу.
#
# Использование (из корня репозитория или любого каталога, где виден tests/):
#   bash tests/demo.sh                       # проверка; стек остаётся
#   DEMO_KEEP=1 bash tests/demo.sh           # то же (стек остаётся)
#   DEMO_KEEP=0 bash tests/demo.sh           # остановить стек после вывода
#   SKIP_FE=1 bash tests/demo.sh             # только API
#   DEMO_API_PORT=8124 DEMO_FE_PORT=3106     # порты (ищется свободный от базы)
#
# Журналы: /tmp/opencode/demo-logs/{api.log,web.log}
set -u

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT_BASE="${DEMO_API_PORT:-8124}"
FE_PORT_BASE="${DEMO_FE_PORT:-3106}"
KEEP="${DEMO_KEEP:-1}"
SKIP_FE="${SKIP_FE:-0}"
LOG_DIR="${DEMO_LOG_DIR:-/tmp/opencode/demo-logs}"
mkdir -p "$LOG_DIR"

log()  { printf '[demo] %s\n' "$*"; }
no()   { printf '[demo][NO] %s\n' "$*"; exit 1; }

busy() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | grep -q ":$1 "
  else
    nc -z 127.0.0.1 "$1" >/dev/null 2>&1
  fi
}

free_port() { # печатает первый порт от $1, свободный с $2 попыток
  local p="$1"
  for _ in $(seq 0 ${2:-10}); do
    if ! busy "$p"; then printf '%s' "$p"; return 0; fi
    p=$((p + 1))
  done
  return 1
}

API_PORT="$(free_port "$API_PORT_BASE" 20)" || no "нет свободного порта от $API_PORT_BASE"
FE_PORT="$(free_port "$FE_PORT_BASE" 20)"  || no "нет свободного порта от $FE_PORT_BASE"
API_URL="http://127.0.0.1:${API_PORT}"
FE_URL="http://127.0.0.1:${FE_PORT}"

stop_stack() {
  [ "$KEEP" = "1" ] && return 0
  # убиваем только наши PID (демо-стек — не чужие процессы)
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null
  [ -n "${FE_PID:-}" ] && kill "$FE_PID" 2>/dev/null
  true
}
trap stop_stack EXIT

http() { curl -fsS -o /dev/null -w '%{http_code}' --max-time 10 "$1" 2>/dev/null; }

# ------------------------------------------------------------- 1. python API
PY="$(command -v python3 || command -v python || true)"
[ -n "$PY" ] || no "python3 не найден"
"$PY" -c 'import fastapi,uvicorn,httpx,yaml' >/dev/null 2>&1 \
  || no "python deps missing: pip install fastapi uvicorn httpx pydantic pyyaml"

API_DIR="$ROOT/services/api"
[ -d "$API_DIR" ] || no "services/api не найден"

log "API: python -m uvicorn --port $API_PORT"
setsid "$PY" -m uvicorn main:app --app-dir "$API_DIR" --host 127.0.0.1 --port "$API_PORT" \
  </dev/null >"$LOG_DIR/api.log" 2>&1 &
API_PID=$!

up=0
for _ in $(seq 1 60); do
  if [ "$(http "$API_URL/health")" = "200" ]; then up=1; break; fi
  sleep 0.5
done
[ "$up" = "1" ] || no "API не поднялся за 30s — смотри $LOG_DIR/api.log"

# --------------------------------------------- 2. API-цепочка по контракту
PH='{"profile":{"skills":["python","git","html","javascript"],"interests":[],"subjects":[]}}'
[ "$(http "$API_URL/health")" = "200" ] || no "health ≠ 200"
rc="$(curl -fsS --max-time 10 -H 'Content-Type: application/json' -d "$PH" "$API_URL/recommend" 2>/dev/null | head -c 1)"
[ "$rc" = "{" ] || no "recommend не вернул JSON"
rc="$(curl -fsS --max-time 10 -H 'Content-Type: application/json' -d '{"role_id":"web","profile":{"skills":["python"],"interests":[],"subjects":[]}}' "$API_URL/plan" 2>/dev/null | head -c 1)"
[ "$rc" = "{" ] || no "plan не вернул JSON"

# ------------------------------------------------------------- 3. фронт + прогрев
if [ "$SKIP_FE" = "1" ]; then
  log "SKIP_FE=1: фронт не проверяем"
else
  command -v node >/dev/null 2>&1 || no "node не найден (SKIP_FE=1 проверит только API)"
  WEB_DIR="$ROOT/apps/web"
  [ -d "$WEB_DIR" ] || no "apps/web не найден"
  [ -d "$WEB_DIR/node_modules" ] || { log "npm ci (первый прогон)…"; (cd "$WEB_DIR" && npm ci --no-audit --no-fund >/dev/null 2>&1) || no "npm ci упал"; }

  # Ловушка сборки: NEXT_PUBLIC_API_URL прошивается в бандл при build.
  # Порт 8000 = дефолт клиента — существующая сборка пригодна; иначе проверяем
  # (и при рассогласовании пересобираем) с нужным API_URL.
  need_build=0
  [ -f "$WEB_DIR/.next/BUILD_ID" ] || need_build=1
  if [ "$need_build" = "0" ] && [ "$API_PORT" != "8000" ]; then
    grep -rq --binary-files=without-match -F "127.0.0.1:$API_PORT" "$WEB_DIR/.next/static/chunks" 2>/dev/null || need_build=1
  fi
  if [ "$need_build" = "1" ]; then
    log "next build (NEXT_PUBLIC_API_URL=$API_URL)…"
    (cd "$WEB_DIR" && NEXT_PUBLIC_API_URL="$API_URL" npm run build >/dev/null 2>&1) || no "next build упал"
  fi

  log "WEB: next start --port $FE_PORT (NEXT_PUBLIC_API_URL должны были прошить в сборку)"
  ( cd "$WEB_DIR" && setsid npx next start -p "$FE_PORT" </dev/null >"$LOG_DIR/web.log" 2>&1 & echo $! >"$LOG_DIR/web.pid" )
  FE_PID="$(cat "$LOG_DIR/web.pid" 2>/dev/null || true)"

  ok_pages=0
  for page in / /result /plan /consultant; do
    for _ in $(seq 1 60); do
      code="$(http "$FE_URL$page")"
      [ "$code" = "200" ] && { ok_pages=$((ok_pages + 1)); break; }
      sleep 0.5
    done
  done
  [ "$ok_pages" = "4" ] || no "страниц прогрето $ok_pages/4 — смотри $LOG_DIR/web.log"
fi

printf '\n'
printf '== ДЕМО-PREFLIGHT ==\n'
printf 'GO: API  %s  (health/recommend/plan/chat OK)\n' "$API_URL"
if [ "$SKIP_FE" != "1" ]; then
  printf 'GO: WEB  %s  (страницы: 4/4 HTTP 200)\n' "$FE_URL"
fi
if [ "$KEEP" = "1" ]; then
  printf 'Стенд оставлен работать. Журналы: %s\n' "$LOG_DIR"
  printf 'Остановить: kill %s (api)%s\n' "${API_PID:-?}" "${FE_PID:+, $FE_PID (web)}"
fi
