#!/usr/bin/env bash
# smoke.sh — локальный smoke-тест «Карьерного трекера»: health → recommend → plan → chat.
#
# Поднимает API (uvicorn/Python, либо Node-сервер — по факту наличия кода) и
# фронтенд (next start, либо статика out/dist/build; иначе SKIP), гоняет цепочку
# ручек на демо-профиле и ВСЁ убирает за собой: процессы (trap + дети через
# pkill -P) и временные файлы. Повторный запуск безопасен, порты администрируются
# через env. Всё, чего нет в репозитории, честно SKIP'ится — CI остаётся зелёным.
#
# Выход: 0 — цепочка прошла или корректно пропущена; 1 — провалился шаг.
#
# Переменные окружения:
#   API_DIR / WEB_DIR       services/api, apps/web
#   SMOKE_API_PORT / SMOKE_FE_PORT / SMOKE_API_HOST / SMOKE_FE_HOST
#                           8000 / 3000 / 127.0.0.1 / 127.0.0.1
#   SMOKE_BASE_URL / SMOKE_FE_BASE_URL   полный override URL (внешний инстанс)
#   SMOKE_HEALTH_PATH / _RECOMMEND_PATH / _PLAN_PATH / _CHAT_PATH
#   SMOKE_DEMO_FILE        data/students_demo.json
#   SMOKE_ROLE_ID          фолбэк role_id, если recommend не ответил (default web)
#   SMOKE_PAYLOAD          полное тело recommend/plan (JSON-строка)
#   SMOKE_CHAT_PAYLOAD     полное тело chat
#   SMOKE_READY_TRIES / SMOKE_READY_SLEEP / SMOKE_HTTP_TIMEOUT
#                           60 / 0.5 / 15
#   SMOKE_SKIP_FE=1         не поднимать фронт
#   SMOKE_KEEP_TMP=1        не удалять каталог с логами (для отладки)

set -uo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

API_DIR="${API_DIR:-services/api}"
WEB_DIR="${WEB_DIR:-apps/web}"
API_HOST="${SMOKE_API_HOST:-127.0.0.1}"
FE_HOST="${SMOKE_FE_HOST:-127.0.0.1}"
API_PORT="${SMOKE_API_PORT:-8000}"
FE_PORT="${SMOKE_FE_PORT:-3000}"
BASE_URL="${SMOKE_BASE_URL:-http://${API_HOST}:${API_PORT}}"
FE_BASE_URL="${SMOKE_FE_BASE_URL:-http://${FE_HOST}:${FE_PORT}}"
HEALTH_PATH="${SMOKE_HEALTH_PATH:-/health}"
RECOMMEND_PATH="${SMOKE_RECOMMEND_PATH:-/recommend}"
PLAN_PATH="${SMOKE_PLAN_PATH:-/plan}"
CHAT_PATH="${SMOKE_CHAT_PATH:-/chat}"
DEMO_FILE="${SMOKE_DEMO_FILE:-data/students_demo.json}"
ROLE_ID_FALLBACK="${SMOKE_ROLE_ID:-web}"
READY_TRIES="${SMOKE_READY_TRIES:-60}"
READY_SLEEP="${SMOKE_READY_SLEEP:-0.5}"
HTTP_TIMEOUT="${SMOKE_HTTP_TIMEOUT:-15}"

TMP_SMOKE="$(mktemp -d "${TMPDIR:-/tmp}/smoke-tracker.XXXXXX")"
API_LOG="$TMP_SMOKE/api.log"
FE_LOG="$TMP_SMOKE/fe.log"
RESP_FILE="$TMP_SMOKE/resp.json"
PAYLOAD_FILE="$TMP_SMOKE/payload.json"
PLAN_FILE="$TMP_SMOKE/plan.json"
CHAT_FILE="$TMP_SMOKE/chat.json"
API_PID=""
FE_PID=""
CLEANED=0
FAILED=0
API_KIND=""       # python | node | ""
FE_MODE=""        # next | static | ""
HTTP_CODE="000"
EMPTY_PROFILE=0
ROLE_ID=""
NOTE="встроенный демо-профиль (example из openapi.yaml)"

log()  { printf '[smoke] %s\n' "$*"; }
ok()   { printf '  [ OK ] %s\n' "$*"; }
warn() { printf '  [WARN] %s\n' "$*" >&2; }
fail() { printf '  [FAIL] %s\n' "$*" >&2; FAILED=1; }
skip() { printf '  [SKIP] %s\n' "$*"; }

kill_tree() {  # kill_tree PID — гасит процесс и его детей (группа setsid + pkill + KILL)
  local pid="$1" i=0
  [ -n "$pid" ] || return 0
  kill -0 "$pid" 2>/dev/null || return 0
  kill -TERM -- "-$pid" 2>/dev/null          # вся группа (процесс под setsid)
  command -v pkill >/dev/null 2>&1 && pkill -TERM -P "$pid" 2>/dev/null
  kill -TERM "$pid" 2>/dev/null
  while [ "$i" -lt 8 ] && kill -0 "$pid" 2>/dev/null; do
    sleep 0.25
    i=$((i + 1))
  done
  kill -KILL -- "-$pid" 2>/dev/null
  command -v pkill >/dev/null 2>&1 && pkill -KILL -P "$pid" 2>/dev/null
  kill -KILL "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  return 0
}

sweep_port() {  # страховка: добить всё, что осталось висеть на НАШЕМ порту
  command -v fuser >/dev/null 2>&1 && fuser -k "${1}/tcp" 2>/dev/null
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:$1" -sTCP:LISTEN 2>/dev/null | xargs -r kill -9 2>/dev/null
  fi
  return 0
}

cleanup() {
  [ "$CLEANED" = "1" ] && return 0
  CLEANED=1
  local pid
  for pid in $API_PID $FE_PID; do
    [ -n "$pid" ] || continue
    kill_tree "$pid"
  done
  # Если процесс запускали мы — страхуемся портом. Внешний инстанс (API_PID="") не трогаем.
  if [ -n "$API_PID" ]; then sweep_port "$API_PORT"; fi
  if [ -n "$FE_PID" ]; then sweep_port "$FE_PORT"; fi
  if [ "${SMOKE_KEEP_TMP:-0}" = "1" ]; then
    log "логи сохранены: $TMP_SMOKE"
  else
    rm -rf "$TMP_SMOKE"
  fi
}
trap cleanup EXIT
trap 'cleanup; trap - EXIT; exit 130' INT TERM

# ------------------------------------------------------------- HTTP-клиент ---

http() {  # http METHOD PATH [BODYFILE] [BASE] -> HTTP_CODE, HTTP_BODY (из RESP_FILE)
  local method="$1" path="$2" body="${3:-}" base="${4:-$BASE_URL}"
  HTTP_CODE="000"
  HTTP_BODY=""
  : > "$RESP_FILE"
  if command -v curl >/dev/null 2>&1; then
    local args=(-s -o "$RESP_FILE" -w '%{http_code}' -m "$HTTP_TIMEOUT" -X "$method" "$base$path")
    if [ -n "$body" ]; then
      args+=(-H 'Content-Type: application/json' --data-binary "@$body")
    fi
    HTTP_CODE="$(curl "${args[@]}" 2>/dev/null)" || HTTP_CODE="000"
  else
    HTTP_CODE="$(python3 - "$method" "$base$path" "$body" "$RESP_FILE" 2>/dev/null <<'PY' || echo 000
import sys, urllib.request, urllib.error
method, url, bodyfile, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
data = open(bodyfile, "rb").read() if bodyfile else None
req = urllib.request.Request(url, data=data, method=method)
if data:
    req.add_header("Content-Type", "application/json")
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        code, payload = resp.getcode(), resp.read()
except urllib.error.HTTPError as exc:
    code, payload = exc.code, exc.read()
except Exception:
    print("000")
    sys.exit(0)
open(out, "wb").write(payload)
print(code)
PY
)"
  fi
  if [ -s "$RESP_FILE" ]; then
    HTTP_BODY="$(head -c 400 "$RESP_FILE")"
  fi
}

json_valid() {
  python3 -c 'import json,sys; json.load(open(sys.argv[1], encoding="utf-8"))' "$1" 2>/dev/null
}

wait_ready() {  # wait_ready PATH ; 0 — готов, 1 — таймаут, 2 — процесс умер
  local path="$1" i=0
  while [ "$i" -lt "$READY_TRIES" ]; do
    http GET "$path"
    case "$HTTP_CODE" in
      2*) return 0 ;;
    esac
    if [ -n "$API_PID" ] && ! kill -0 "$API_PID" 2>/dev/null; then
      return 2
    fi
    i=$((i + 1))
    sleep "$READY_SLEEP"
  done
  return 1
}

port_busy() {  # port_busy URL
  command -v curl >/dev/null 2>&1 || return 1
  curl -s -o /dev/null -m 2 "$1" 2>/dev/null
}

tail_logs() {
  if [ -s "$API_LOG" ]; then
    echo "--- api.log (последние 20 строк) ---"
    tail -n 20 "$API_LOG" || true
  fi
  if [ -s "$FE_LOG" ]; then
    echo "--- fe.log (последние 10 строк) ---"
    tail -n 10 "$FE_LOG" || true
  fi
}

# --------------------------------------------------- запуск компонентов -------

PYTHON_BIN="$(command -v python3 || command -v python || true)"

spawn() {  # spawn LOGFILE SCRIPT [ARGS...] — фоном, в СВОЕЙ группе (setsid), печатает PID
  local log="$1" script="$2"
  shift 2
  if command -v setsid >/dev/null 2>&1; then
    setsid sh -c "$script" _ "$@" >"$log" 2>&1 &
  else
    sh -c "$script" _ "$@" >"$log" 2>&1 &
  fi
  printf '%s' "$!"
}

pick_python_app() {  # печатает "module:attr", если нашли ASGI-приложение
  [ -n "$PYTHON_BIN" ] || return 1
  [ -d "$API_DIR" ] || return 1
  local f rel mod attr
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if grep -Eq '^[[:space:]]*(app|application)[[:space:]]*=[[:space:]]*[A-Za-z_]' "$f" 2>/dev/null; then
      rel="${f#"$API_DIR"/}"
      mod="${rel%.py}"
      mod="${mod//\//.}"
      attr="$(grep -Eo '^[[:space:]]*(app|application)[[:space:]]*=' "$f" | head -n1 | tr -d ' =')"
      printf '%s:%s' "$mod" "${attr:-app}"
      return 0
    fi
  done < <(find "$API_DIR" -name '*.py' -not -path '*/node_modules/*' -not -path '*/__pycache__/*' 2>/dev/null | sort)
  return 1
}

start_api() {
  if [ ! -d "$API_DIR" ]; then
    skip "API: каталог $API_DIR отсутствует (spark) — стек не поднят"
    return 0
  fi
  if port_busy "$BASE_URL$HEALTH_PATH"; then
    warn "API: на $BASE_URL уже кто-то слушает — свой не запускаем, тестируем что есть"
    API_KIND="external"
    return 0
  fi
  local mod
  if mod="$(pick_python_app)"; then
    if "$PYTHON_BIN" -c 'import uvicorn' >/dev/null 2>&1 || command -v uvicorn >/dev/null 2>&1; then
      log "API: uvicorn, модуль $mod, порт $API_PORT"
      API_PID="$(spawn "$API_LOG" \
        'exec "$1" -m uvicorn --app-dir "$2" "$3" --host "$4" --port "$5" --log-level info' \
        "$PYTHON_BIN" "$API_DIR" "$mod" "$API_HOST" "$API_PORT")"
      API_KIND="python"
      return 0
    fi
    warn "API: найден Python-модуль $mod, но uvicorn не установлен — пропуск (pip install uvicorn)"
    return 0
  fi
  if [ -f "$API_DIR/package.json" ]; then
    local entry=""
    if [ -f "$API_DIR/dist/index.js" ]; then
      entry="dist/index.js"
    elif [ -f "$API_DIR/dist/server.js" ]; then
      entry="dist/server.js"
    elif [ -f "$API_DIR/dist/main.js" ]; then
      entry="dist/main.js"
    fi
    if [ -n "$entry" ] && command -v node >/dev/null 2>&1; then
      log "API: node $API_DIR/$entry"
      API_PID="$(spawn "$API_LOG" 'cd "$1" && exec env PORT="$2" node "$3"' \
        "$API_DIR" "$API_PORT" "$entry")"
      API_KIND="node"
      return 0
    fi
    if [ -x "$API_DIR/node_modules/.bin/tsx" ]; then
      log "API: tsx"
      API_PID="$(spawn "$API_LOG" 'cd "$1" && exec env PORT="$2" ./node_modules/.bin/tsx src/index.ts' \
        "$API_DIR" "$API_PORT")"
      API_KIND="node"
      return 0
    fi
    if command -v npm >/dev/null 2>&1 && \
       grep -q '"start"' "$API_DIR/package.json" 2>/dev/null; then
      log "API: npm start ($API_DIR)"
      API_PID="$(spawn "$API_LOG" 'cd "$1" && exec env PORT="$2" npm start' \
        "$API_DIR" "$API_PORT")"
      API_KIND="node"
      return 0
    fi
    warn "API: $API_DIR/package.json есть, но не нашли способ запуска (dist/index.js, tsx, scripts.start) — пропуск"
    return 0
  fi
  skip "API: в $API_DIR не нашли ни Python ASGI-приложение, ни package.json — стенд не поднят"
  return 0
}

start_frontend() {
  [ "${SMOKE_SKIP_FE:-0}" = "1" ] && { skip "фронт: отключён SMOKE_SKIP_FE=1"; return 0; }
  if port_busy "$FE_BASE_URL/"; then
    warn "фронт: на $FE_BASE_URL уже кто-то слушает — свой не запускаем"
    FE_MODE="external"
    return 0
  fi
  [ -d "$WEB_DIR" ] || { skip "фронт: каталог $WEB_DIR отсутствует (lightning)"; return 0; }
  if [ -f "$WEB_DIR/.next/BUILD_ID" ] && [ -f "$WEB_DIR/node_modules/.bin/next" ]; then
    log "фронт: next start ($WEB_DIR/.next)"
    FE_PID="$(spawn "$FE_LOG" 'cd "$1" && exec ./node_modules/.bin/next start -H "$2" -p "$3"' \
      "$WEB_DIR" "$FE_HOST" "$FE_PORT")"
    FE_MODE="next"
    return 0
  fi
  if [ -f "$WEB_DIR/.next/BUILD_ID" ] && command -v npx >/dev/null 2>&1; then
    log "фронт: npx next start ($WEB_DIR/.next)"
    FE_PID="$(spawn "$FE_LOG" 'cd "$1" && exec npx --no-install next start -H "$2" -p "$3"' \
      "$WEB_DIR" "$FE_HOST" "$FE_PORT")"
    FE_MODE="next"
    return 0
  fi
  local d
  for d in out dist build; do
    if [ -d "$WEB_DIR/$d" ]; then
      if [ -z "$PYTHON_BIN" ]; then
        warn "фронт: $WEB_DIR/$d — статика, но python3 не найден — пропуск"
        return 0
      fi
      log "фронт: статика $WEB_DIR/$d через python3 -m http.server"
      [ -f "$WEB_DIR/$d/index.html" ] || warn "фронт: в $WEB_DIR/$d нет index.html — будет листинг"
      FE_PID="$(spawn "$FE_LOG" 'exec "$1" -m http.server "$2" --bind "$3" --directory "$4"' \
        "$PYTHON_BIN" "$FE_PORT" "$FE_HOST" "$WEB_DIR/$d")"
      FE_MODE="static"
      return 0
    fi
  done
  skip "фронт: $WEB_DIR не собран (нет .next/BUILD_ID, out/, dist/, build/) — не поднимаем"
  return 0
}

# ------------------------------------------------------------- демо-тела -----

build_payloads() {
  if [ -n "${SMOKE_PAYLOAD:-}" ]; then
    printf '%s' "$SMOKE_PAYLOAD" > "$PAYLOAD_FILE"
    NOTE="SMOKE_PAYLOAD (env)"
  else
    local meta line2
    meta="$(python3 - "$DEMO_FILE" "$PAYLOAD_FILE" 2>/dev/null <<'PY'
import json, os, sys
demo_path, out_path = sys.argv[1], sys.argv[2]
fallback = {
    "skills": ["python", "git", "html"],
    "interests": ["веб-разработка", "аналитика"],
    "subjects": ["базы данных", "алгоритмы"],
    "course": 4,
    "specialty": "Информационные системы и технологии",
}
note = "встроенный демо-профиль (example из openapi.yaml)"
empty = "0"
try:
    with open(demo_path, encoding="utf-8") as fh:
        doc = json.load(fh)
except Exception:
    doc = None

def students(d):
    if isinstance(d, list):
        return [s for s in d if isinstance(s, dict)]
    if isinstance(d, dict):
        val = d.get("students")
        if isinstance(val, list):
            return [s for s in val if isinstance(s, dict)]
        if isinstance(val, dict):
            return [s for s in val.values() if isinstance(s, dict)]
        return [d]
    return []

def profile_of(s):
    p = s.get("profile")
    return p if isinstance(p, dict) else s

def nonempty(s):
    p = profile_of(s)
    return bool(p.get("skills")) or bool(p.get("interests"))

studs = students(doc)
picked = None
if studs:
    filled = [s for s in studs if nonempty(s)]
    if filled:
        picked = filled[0]
        note = "демо-студент %s (%s)" % (picked.get("id", "?"), os.path.basename(demo_path))
    else:
        picked = studs[0]
        note = "демо-студент %s (%s) — ПУСТОЙ профиль" % (picked.get("id", "?"), os.path.basename(demo_path))
        empty = "1"
if picked is not None:
    body = {"profile": profile_of(picked)}
else:
    body = {"profile": fallback}
with open(out_path, "w", encoding="utf-8") as fh:
    json.dump(body, fh, ensure_ascii=False)
print(note)
print(empty)
PY
)"
    NOTE="$(printf '%s\n' "$meta" | sed -n '1p')"
    line2="$(printf '%s\n' "$meta" | sed -n '2p')"
    EMPTY_PROFILE="${line2:-0}"
  fi
  if [ "$EMPTY_PROFILE" = "1" ]; then
    warn "демо-профиль пустой: контракт Profile требует ≥1 навык (minItems: 1) — 422 на recommend будет ожидаемым"
  fi
  log "демо-профиль: $NOTE"
}

build_role_bodies() {  # build_role_bodies ROLE_ID
  local role="$1"
  if [ -n "${SMOKE_CHAT_PAYLOAD:-}" ]; then
    printf '%s' "$SMOKE_CHAT_PAYLOAD" > "$CHAT_FILE"
  else
    python3 - "$PAYLOAD_FILE" "$PLAN_FILE" "$CHAT_FILE" "$role" <<'PY'
import json, sys
payload, plan, chat, role = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
with open(payload, encoding="utf-8") as fh:
    body = json.load(fh)
profile = body.get("profile", body)
with open(plan, "w", encoding="utf-8") as fh:
    json.dump({"role_id": role, "profile": profile}, fh, ensure_ascii=False)
with open(chat, "w", encoding="utf-8") as fh:
    json.dump({"role_id": role, "profile": profile,
               "message": "С чего начать развитие в этой роли?"}, fh, ensure_ascii=False)
PY
  fi
}

extract_role_id() {
  python3 - "$RESP_FILE" 2>/dev/null <<'PY'
import json, sys
try:
    with open(sys.argv[1], encoding="utf-8") as fh:
        doc = json.load(fh)
except Exception:
    sys.exit(1)
roles = doc.get("roles") if isinstance(doc, dict) else None
if isinstance(roles, list) and roles and isinstance(roles[0], dict) and roles[0].get("role_id"):
    print(roles[0]["role_id"])
    sys.exit(0)
sys.exit(1)
PY
}

# ---------------------------------------------------------------- шаги -------

step() {  # step NAME METHOD PATH [BODYFILE]
  local name="$1" method="$2" path="$3" body="${4:-}"
  http "$method" "$path" "$body"
  case "$HTTP_CODE" in
    2*)
      if [ -s "$RESP_FILE" ]; then
        if json_valid "$RESP_FILE"; then
          ok "$name: HTTP $HTTP_CODE, JSON валиден"
        else
          fail "$name: HTTP $HTTP_CODE, но тело — не JSON: ${HTTP_BODY:0:200}"
        fi
      else
        ok "$name: HTTP $HTTP_CODE (пустое тело)"
      fi
      ;;
    422|400)
      if [ "$EMPTY_PROFILE" = "1" ]; then
        warn "$name: HTTP $HTTP_CODE — ожидаемо для пустого профиля (контракт требует ≥1 навык)"
      else
        fail "$name: HTTP $HTTP_CODE — контракт нарушен: ${HTTP_BODY:0:200}"
      fi
      ;;
    000)
      fail "$name: нет соединения с $BASE_URL$path (код 000)"
      ;;
    *)
      fail "$name: HTTP $HTTP_CODE — не 2xx: ${HTTP_BODY:0:200}"
      ;;
  esac
}

# ------------------------------------------------------------------ main -----

log "smoke: «Карьерный трекер» — health → recommend → plan → chat"
log "корень: $ROOT | API: $BASE_URL | фронт: $FE_BASE_URL"

start_api
if [ -n "$API_KIND" ] && [ "$API_KIND" != "external" ]; then
  if wait_ready "$HEALTH_PATH"; then
    ok "API поднялся за ожидание ($API_KIND, $BASE_URL$HEALTH_PATH)"
  else
    rc=$?
    if [ "$rc" -eq 2 ]; then
      fail "API: процесс умер на старте (см. лог)"
    else
      fail "API: не ответил на $HEALTH_PATH (попыток: $READY_TRIES, интервал ${READY_SLEEP}с)"
    fi
    tail_logs
    API_KIND=""
  fi
elif [ "$API_KIND" = "external" ]; then
  if wait_ready "$HEALTH_PATH"; then
    ok "внешний API на $BASE_URL отвечает"
  else
    fail "внешний API на $BASE_URL молчит"
    API_KIND=""
  fi
fi

if [ -n "$API_KIND" ]; then
  build_payloads
  step "health"    GET  "$HEALTH_PATH"
  step "recommend" POST "$RECOMMEND_PATH" "$PAYLOAD_FILE"
  ROLE_ID="$(extract_role_id || true)"
  if [ -n "$ROLE_ID" ]; then
    log "role_id из ответа recommend: $ROLE_ID"
  else
    ROLE_ID="$ROLE_ID_FALLBACK"
    warn "role_id не извлечён из recommend — фолбэк $ROLE_ID_FALLBACK"
  fi
  build_role_bodies "$ROLE_ID"
  step "plan" POST "$PLAN_PATH" "$PLAN_FILE"
  step "chat" POST "$CHAT_PATH" "$CHAT_FILE"
else
  skip "цепочка recommend/plan/chat пропущена: API не поднят"
fi

start_frontend
if [ -n "$FE_MODE" ] && [ "$FE_MODE" != "external" ]; then
  ready=0
  i=0
  while [ "$i" -lt "$READY_TRIES" ]; do
    http GET "/" "" "$FE_BASE_URL"
    case "$HTTP_CODE" in 2*) ready=1; break ;; esac
    if ! kill -0 "$FE_PID" 2>/dev/null; then break; fi
    i=$((i + 1))
    sleep "$READY_SLEEP"
  done
  if [ "$ready" = "1" ]; then
    ok "фронт отдаёт / : HTTP $HTTP_CODE ($FE_MODE)"
  else
    fail "фронт не ответил на / ($FE_MODE)"
    tail_logs
  fi
elif [ "$FE_MODE" = "external" ]; then
  http GET "/" "" "$FE_BASE_URL"
  case "$HTTP_CODE" in
    2*) ok "внешний фронт на $FE_BASE_URL отдаёт /" ;;
    *)  warn "внешний фронт на $FE_BASE_URL не ответил (HTTP $HTTP_CODE)" ;;
  esac
fi

if [ "$FAILED" -eq 0 ]; then
  log "SMOKE OK (или все шаги корректно пропущены)"
  exit 0
fi
log "SMOKE FAILED — подробности выше"
exit 1
