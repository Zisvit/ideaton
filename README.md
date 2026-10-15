# Карьерный трекер — SUPERNOVA №9

Веб-сервис: студент → топ-5 карьерных траекторий → план 30 дней → чат-консультант.

## Стек
- **Frontend:** React 18 + TypeScript + Vite (`apps/web`)
- **Backend:** Fastify + TypeScript (`services/api`)
- **Контракты:** OpenAPI 3.1 + генерируемые TS типы (`packages/contracts`)
- **Данные:** JSON-роли в `data/roles` (50+ ролей, веса, 30-дневные планы)
- **Инфра:** Docker Compose, nginx reverse proxy (`infra`)
- **Монорепо:** Turborepo + pnpm workspaces

## Структура
```
ideaton/
├── apps/
│   ├── web/          # React SPA (zisvit)
│   └── api/          # Fastify API (phpAtom1c)
├── packages/
│   └── contracts/    # OpenAPI + TS типы (Soda)
├── data/
│   └── roles/        # JSON-схемы ролей (Soda)
├── infra/
│   ├── docker-compose.yml
│   └── nginx.conf
└── docs/
    ├── PRD.md
    └── SPRINTS.md
```

## Запуск
```bash
# Требуется: Docker 24+, Docker Compose v2
docker compose -f infra/docker-compose.yml up -d

# Web:  http://localhost:3000
# API:  http://localhost:3001/api/v1
# Health: http://localhost:3001/health
```

## Контракты
- Исходник: `packages/contracts/openapi.yaml`
- Генерируемые типы: `packages/contracts/src/` (публикуются как `@tracker/contracts`)
- Использование в web/api: `import { Profile, ScoreResponse } from '@tracker/contracts'`
- Регенерация: `pnpm --filter @tracker/contracts generate`

## Разработка
```bash
# Установка
pnpm install

# Локально (без Docker)
pnpm dev          # web + api параллельно
pnpm build        # все пакеты
pnpm check        # lint + typecheck + tests
```

## Ветки и CI
- `main` — защищена, PR required, 1 approve.
- Фичи: `feat/<short-name>` от `main`.
- CI: линт, типы, тесты, валидация контрактов, сборка Docker-образов.

## Команда
| Роль | Ответственность | Контакт |
|---|---|---|
| **zisvit** | Frontend (`apps/web`) | @zisvit |
| **phpAtom1c** | Backend + AI (`services/api`) | @phpAtom1c |
| **Soda** | Данные, инфра, контракты (`data`, `infra`, `packages/contracts`) | @Soda |

## Лицензия
MIT — внутренний хакатон SUPERNOVA.