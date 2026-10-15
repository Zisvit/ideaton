# Спринты (4 × 2 недели)

## Команда и владение
| Участник | Роль | Вертикаль |
|---|---|---|
| **zisvit** | Frontend Lead | `apps/web` — весь UI, стейт, интеграция с API |
| **phpAtom1c** | AI/Backend Lead | `services/api` — скоринг, чат, OpenAPI, деплой |
| **Soda** | Data/Infra Lead | `data/roles`, `infra`, `packages/contracts`, CI/CD |

---

## Спринт 1 (недели 1–2): Фундамент и профиль
**Владельцы:** zisvit (web), Soda (contracts, data, infra)

| Задача | Влад. | DoD |
|---|---|---|
| Монорепо: Turborepo + pnpm, структура папок | Soda | `pnpm build` зелёный, `docker compose up` поднимает web+api |
| `packages/contracts`: OpenAPI 3.1 + TS типы (профиль, скор, план, чат) | Soda | Сгенерированные типы используются в web и api без ручных правок |
| `data/roles`: JSON-схема роли (id, title, skills[], weights, steps30d[]), 50+ ролей | Soda | Валидация схемы, импорт в api за ≤100 мс |
| Инфра: Docker Compose (web, api, nginx), healthchecks | Soda | `docker compose up -d` → 200 на `/health` у обоих сервисов |
| Web: страница профиля (форма, валидация, localStorage) | zisvit | Все поля валидируются, данные сохраняются, переход к /results |
| API: эндпоинт `POST /api/v1/score` (заглушка, 200 + мок) | phpAtom1c | Контракт совпадает с `contracts`, возвращает топ-5 моков |

**Критерий «режем фичу»:** если к концу спринта нет работающего `docker compose up` с healthchecks — режем чат, оставляем только скоринг + план.

---

## Спринт 2 (недели 3–4): Скоринг и план 30 дней
**Владельцы:** phpAtom1c (api), zisvit (web results), Soda (data quality)

| Задача | Влад. | DoD |
|---|---|---|
| Rule-based скоринг: взвешенный матч (skills, interests, values, experience) | phpAtom1c | Детерминированный, ≤500 мс, unit-тесты на 10 профилях |
| Обоснование траектории: почему роль в топ-5 (топ-3 фактора) | phpAtom1c | В ответе API есть `reasoning: string[]` |
| Генерация плана 30 дней из `role.steps30d` (4 недели × 3–5 действий) | phpAtom1c | План специфичен роли, действия с ресурсами (ссылки, чек-листы) |
| Web: страница результатов — топ-5 карточек + раскрывающийся план | zisvit | Карточки кликабельны, план отображается по неделям, печать/PDF |
| API: `GET /api/v1/plan/:roleId` — детализация недели | phpAtom1c | Контракт в `contracts`, кэш-Control: immutable |

**Критерий «режем фичу»:** если скоринг >1с или план пустой для >20% ролей — упрощаем веса до skills-only, режем reasoning.

---

## Спринт 3 (недели 5–6): Чат-консультант (LLM kill-switch)
**Владельцы:** phpAtom1c (api + prompt engineering), zisvit (web chat UI)

| Задача | Влад. | DoD |
|---|---|---|
| LLM-прокси: системный промпт = «ты консультант, факты только из контекста (роль+план)» | phpAtom1c | 0 галлюцинаций на 20 тестовых диалогах (ручная проверка) |
| Kill-switch: флаг `ENABLE_LLM_CHAT=false` → API возвращает 503 + фолбэк-текст | phpAtom1c | Переключение без редеплоя (env), фолбэк: «Задайте вопрос позже / напишите на email» |
| Web: чат-виджет на странице плана, контекст = выбранная роль + план | zisvit | История в localStorage, Enter=send, Shift+Enter=новая строка |
| Ретривер: подтягивает role + plan в контекст LLM (без векторов) | phpAtom1c | Контекст ≤2k токенов, латентность ≤2с (streaming) |

**Критерий «режем фичу»:** если LLM галлюцинирует >2 раз из 20 — отключаем чат (kill-switch), оставляем FAQ-блок из статических Q&A.

---

## Спринт 4 (недели 7–8): Полировка и демо
**Владельцы:** все (feature freeze с понедельника 2-й недели)

| Задача | Влад. | DoD |
|---|---|---|
| UX: лоадинг скелетоны, ошибки, пустые состояния | zisvit | Lighthouse Performance ≥90, Accessibility ≥95 |
| API: rate-limit (10 req/min на IP), логирование запросов | phpAtom1c | `docker compose logs api` показывает request-id, latency |
| Данные: ревью 50 ролей экспертом (Soda + внешний), фикс весов | Soda | Все роли имеют уникальные steps30d, нет дублей |
| Документация: README, ADR (architecture decisions), запуск | Soda | Новичок поднимает проект за ≤10 мин по README |
| Демо-скрипт: 3 персоны → 3 разных топ-5 → план → чат | все | Запускается локально, без интернета (LLM может быть выключен) |

**Критерий «режем фичу»:** в понедельник 2-й недели — feature freeze. Что не в main — в следующий квартал. Только багфиксы.

---

## Definition of Done (общий)
- Код в `main` через PR (1 approve минимум).
- Линт/типчек/тесты зелёные в CI (`pnpm check`).
- Контракты не ломаются (`pnpm contracts:validate`).
- Документация обновлена в том же PR.
- Запускается `docker compose up -d` на чистой машине.