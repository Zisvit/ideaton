# Карьерный трекер — SUPERNOVA №9

Веб-сервис: студент → топ-5 карьерных траекторий → план 30 дней → чат-консультант.

## Стек
- **Frontend:** Next.js 16 (pages router) + React 19 + TypeScript (`apps/web`)
- **Backend:** Python 3.12 + FastAPI + uvicorn (`services/api`)
- **Контракты:** OpenAPI 3.1 и JSON-схема роли (`packages/contracts`)
- **Данные:** YAML-роли в `data/roles` (26 направлений, веса и 30-дневные планы)
- **Инфра:** Docker Compose (`infra/docker-compose.yml`)
- **Тесты:** pytest — юнит, HTTP-контракт и UI-гейты (`tests/`)

## Структура
```
ideaton/
├── apps/
│   └── web/          # Next.js (zisvit)
├── services/
│   └── api/          # FastAPI: scoring, plan, chat (phpAtom1c)
├── packages/
│   └── contracts/    # openapi.yaml + roles.schema.json (Soda)
├── data/
│   └── roles/        # YAML-роли (Soda)
├── infra/
│   └── docker-compose.yml
├── tests/            # pytest: API, контракты, UI-гейты
└── docs/
    ├── PRD.md
    ├── SPRINTS.md
    ├── UX.md
    └── DEMO.md
```

## Запуск
```bash
# Требуется: Docker 24+, Docker Compose v2
docker compose -f infra/docker-compose.yml up --build

# Web:    http://localhost:3000
# API:    http://localhost:8000
# Health: http://localhost:8000/health
```

## Разработка без Docker
```bash
# API (из services/api — импорты llm/scoring/schemas локальные)
cd services/api
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Web (из apps/web)
cd apps/web
npm ci
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev

# Тесты (из корня; нужны fastapi, httpx, pytest, pydantic, pyyaml)
python -m pytest tests/ -q
```

## Контракты
- `packages/contracts/openapi.yaml` — контракт API (источник истины).
- `packages/contracts/roles.schema.json` — схема роли в `data/roles`.
- `tests/test_contract_live.py` сверяет `app.openapi()` с `openapi.yaml`.

## Ветки и CI
- `main` — защищена, PR required, 1 approve.
- Фичи: `feat/<short-name>` от `main`.
- CI: compileall, валидация YAML-ролей, проверка секретов, сборка фронта,
  pytest и API-smoke (`tests/smoke.sh`); автомерж — через `automerge-*.yml`.

## Команда
| Роль | Ответственность | Контакт |
|---|---|---|
| **zisvit** | Frontend (`apps/web`) | @zisvit |
| **phpAtom1c** | Backend + AI (`services/api`) | @phpAtom1c |
| **Soda** | Данные, инфра, контракты (`data`, `infra`, `packages/contracts`) | @Soda |

## Лицензия
MIT — внутренний хакатон SUPERNOVA.
