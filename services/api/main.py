"""API карьерного трекера (FastAPI): /health, /recommend, /plan, /chat.

Выравнивание по контракту packages/contracts/openapi.yaml (контракт главнее):
  GET  /health  → {ok: true, status: "ok"}
  POST /recommend → {roles: [5 × {role_id,title,score,why,gaps}], items, profile_hash, cached}
  POST /plan    → {weeks: [4 × {n,tasks}], checklist, …}  — недели 1–2
                  персонализируются пробелами профиля (scoring.gap_tasks)
  POST /chat    → {reply, answer, sources, profile_hash, llm_used}
  400/404/422   → {error: "..."}
Поля ТЗ (items, matched, matched_count/needed_count «N из M», answer, status,
steps, resources, gaps, summary, disclaimer, profile_hash, cached − на
/recommend и /plan, llm_used на /plan и /chat для честного бейджа режима)
добавлены сверх контракта: openapi.yaml не запрещает дополнительные поля
(нет additionalProperties:false), а контрактные поля присутствуют и
типизированы строго.

Загрузка ролей: env ROLES_DIR → ../../data/roles → встроенный дефолт (5 ролей).
Дефолт — дословная копия data/roles/*.yaml, плюс гарантия: канонические 5 ролей
всегда присутствуют (union с дефолтом, данные приоритетнее), чтобы /recommend
выполнял контракт minItems/maxItems = 5 при любом ROLES_DIR.

Кэш — dict по sha256(canonical json) запроса (/recommend, /plan). LLM — только
перефраз готового черновика; факты исключительно из рубрики роли.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any

import yaml
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import llm
import scoring
from schemas import (
    ChatRequest,
    ChatResponse,
    Check,
    ErrorResponse,
    HealthResponse,
    PlanRequest,
    PlanResponse,
    Profile,
    RecommendRequest,
    RecommendResponse,
    Resource,
    RoleScore,
    Week,
    ROLE_IDS,
)

DISCLAIMER = (
    "План носит рекомендательный характер и не является гарантией "
    "трудоустройства или оффера."
)

API_DIR = Path(__file__).resolve().parent
DEFAULT_ROLES_DIR = API_DIR.parent.parent / "data" / "roles"

# ---------------------------------------------------------------- roleId data

# Встроенный дефолт — дословная копия data/roles/*.yaml (fallback ≡ данные).
DEFAULT_ROLES: list[dict[str, Any]] = [
    {
        "id": "web",
        "title": "Веб-разработчик",
        "description": "Создаёт сайты и веб-приложения на HTML, CSS и JavaScript.",
        "skills_required": [
            {"id": "html", "weight": 0.9},
            {"id": "css", "weight": 0.9},
            {"id": "javascript", "weight": 1.0},
            {"id": "typescript", "weight": 0.7},
            {"id": "react", "weight": 0.6},
            {"id": "nodejs", "weight": 0.5},
        ],
        "related_specialties": ["frontend", "backend", "fullstack"],
        "development_steps": [
            "Изучить основы HTML и CSS, сверстать первую страницу",
            "Освоить JavaScript на уровне DOM и асинхронности",
            "Познакомиться с React",
            "Научиться работать с API и fetch-запросами",
            "Собрать проект: фронтенд + бэкенд + база данных",
        ],
        "partner_companies": ["Яндекс", "Т-Банк", "VK", "Сбер", "Ozon"],
        "resources": [
            {
                "title": "MDN Web Docs",
                "url": "https://developer.mozilla.org",
                "minutes": 60,
            },
            {
                "title": "JavaScript.info",
                "url": "https://javascript.info",
                "minutes": 120,
            },
            {"title": "React Docs", "url": "https://react.dev", "minutes": 90},
        ],
    },
    {
        "id": "1c",
        "title": "Разработчик 1С",
        "description": "Автоматизирует учёт и управление бизнесом на платформе 1С:Предприятие.",
        "skills_required": [
            {"id": "1c", "weight": 1.0},
            {"id": "sql", "weight": 0.5},
            {"id": "accounting", "weight": 0.6},
            {"id": "bpmn", "weight": 0.4},
        ],
        "related_specialties": ["1c-developer", "erp"],
        "development_steps": [
            "Установить 1С:Предприятие и познакомиться с конфигурациями",
            "Изучить встроенный язык 1С",
            "Освоить язык запросов 1С и SQL",
            "Написать собственный отчёт и обработку",
        ],
        "partner_companies": ["1С", "СКБ Контур"],
        "resources": [
            {
                "title": "1С:Предприятие — руководство разработчика",
                "url": "https://its.1c.ru",
                "minutes": 120,
            },
        ],
    },
    {
        "id": "qa",
        "title": "Тестировщик",
        "description": "Проверяет качество ПО: тест-кейсы, автотесты, дефекты до релиза.",
        "skills_required": [
            {"id": "manual_testing", "weight": 0.9},
            {"id": "test_design", "weight": 0.8},
            {"id": "sql", "weight": 0.5},
            {"id": "automation", "weight": 0.6},
            {"id": "python", "weight": 0.5},
        ],
        "related_specialties": ["manual-qa", "auto-qa"],
        "development_steps": [
            "Познакомиться с основами тестирования",
            "Научиться писать тест-кейсы и чек-листы",
            "Освоить баг-трекинг (Jira, YouTrack)",
            "Изучить автоматизацию на Python + pytest",
        ],
        "partner_companies": ["Яндекс", "Сбер", "VK", "Kaspersky"],
        "resources": [
            {
                "title": "Основы тестирования ПО",
                "url": "https://testengineer.ru",
                "minutes": 90,
            },
        ],
    },
    {
        "id": "support",
        "title": "Специалист техподдержки",
        "description": "Помогает пользователям решать проблемы, диагностирует сбои.",
        "skills_required": [
            {"id": "communication", "weight": 0.9},
            {"id": "troubleshooting", "weight": 0.8},
            {"id": "sql", "weight": 0.3},
            {"id": "crm", "weight": 0.4},
        ],
        "related_specialties": ["support-engineer", "customer-success"],
        "development_steps": [
            "Познакомиться с продуктом и базой знаний",
            "Освоить коммуникацию и работу с возражениями",
            "Научиться диагностировать типовые проблемы",
            "Освоить CRM-систему",
        ],
        "partner_companies": ["Яндекс", "МТС"],
        "resources": [
            {
                "title": "Курс по техподдержке",
                "url": "https://atalent.ru",
                "minutes": 60,
            },
        ],
    },
    {
        "id": "startup",
        "title": "Стартап / Продакт",
        "description": "Запускает технологические стартапы, ищет продуктово-рыночное соответствие.",
        "skills_required": [
            {"id": "product_management", "weight": 0.9},
            {"id": "marketing", "weight": 0.7},
            {"id": "finance", "weight": 0.5},
            {"id": "team_management", "weight": 0.6},
            {"id": "analytics", "weight": 0.6},
        ],
        "related_specialties": ["founder", "product-manager"],
        "development_steps": [
            "Сформулировать гипотезу продукта",
            "Провести проблемные интервью",
            "Создать MVP",
            "Настроить аналитику",
        ],
        "partner_companies": ["ФРИИ", "Сколково"],
        "resources": [
            {
                "title": "Y Combinator Startup School",
                "url": "https://www.startupschool.org",
                "minutes": 240,
            },
        ],
    },
]


def _load_roles_from_dir(directory: Path) -> list[dict[str, Any]]:
    """Читает role-файлы *.yaml из directory (кроме skills.yaml)."""
    roles: list[dict[str, Any]] = []
    if not directory.is_dir():
        return roles
    for path in sorted(directory.glob("*.yaml")):
        if path.name == "skills.yaml":
            continue
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError:
            continue
        candidates = data if isinstance(data, list) else [data]
        for role in candidates:
            if (
                isinstance(role, dict)
                and role.get("id")
                and role.get("title")
                and isinstance(role.get("skills_required"), list)
            ):
                roles.append(role)
    return roles


def load_roles() -> list[dict[str, Any]]:
    """ROLES_DIR → ../../data/roles → встроенный дефолт (5 ролей).

    Гарантия контракта: канонические ROLE_IDS всегда присутствуют: данные
    приоритетнее, дефолт добирает недостающие id (чтобы /recommend всегда
    мог вернуть ровно 5 траекторий из закрытого словаря).
    """
    env_dir = os.getenv("ROLES_DIR", "").strip()
    candidates = [
        p for p in (Path(env_dir) if env_dir else None, DEFAULT_ROLES_DIR) if p
    ]
    by_id: dict[str, dict[str, Any]] = {}
    for candidate in candidates:
        for role in _load_roles_from_dir(candidate):
            by_id.setdefault(str(role["id"]), role)
        if by_id:
            break  # первый непустой источник побеждает целиком
    if not by_id:
        by_id = {str(r["id"]): dict(r) for r in DEFAULT_ROLES}
    else:
        for role in DEFAULT_ROLES:  # добивка канонических id из дефолта
            by_id.setdefault(str(role["id"]), dict(role))
    return [by_id[rid] for rid in ROLE_IDS if rid in by_id] + [
        r for rid, r in sorted(by_id.items()) if rid not in ROLE_IDS
    ]


def _skills_candidates() -> list[Path]:
    """Каскад поиска словаря навыков ( skills.yaml): SKILLS_FILE →
    ROLES_DIR/skills.yaml → ../../data/roles/skills.yaml (ТЗ) →
    ../../data/skills.yaml (CI-контракт)."""
    candidates: list[Path] = []
    env_skills = os.getenv("SKILLS_FILE", "").strip()
    if env_skills:
        candidates.append(Path(env_skills))
    env_roles = os.getenv("ROLES_DIR", "").strip()
    if env_roles:
        candidates.append(Path(env_roles) / "skills.yaml")
    candidates.append(DEFAULT_ROLES_DIR / "skills.yaml")  # data/roles/skills.yaml
    candidates.append(DEFAULT_ROLES_DIR.parent / "skills.yaml")  # data/skills.yaml
    return candidates


def load_aliases() -> dict[str, str]:
    """Словарь alias → canonical id: первый файл каскада с непустым результатом."""
    for path in _skills_candidates():
        aliases = scoring.load_synonyms(path)
        if aliases:
            return aliases
    return {}


def load_skill_names() -> dict[str, str]:
    """Словарь id → human name из того же каскада (для персональных gap-задач)."""
    for path in _skills_candidates():
        names = scoring.load_skill_names(path)
        if names:
            return names
    return {}


# --------------------------------------------------------------------- state

ROLES: list[dict[str, Any]] = load_roles()
ROLES_BY_ID: dict[str, dict[str, Any]] = {r["id"]: r for r in ROLES}
ALIASES: dict[str, str] = load_aliases()
SKILL_NAMES: dict[str, str] = load_skill_names()
_CACHE: dict[str, dict[str, Any]] = {}

_WORD_RE = re.compile(r"[a-zа-яё0-9]{2,}")


def _tokens(text: str) -> set[str]:
    return set(_WORD_RE.findall(text.lower()))


def _profile_hash(profile: Profile) -> str:
    canonical = json.dumps(
        profile.model_dump(mode="json"),
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _cache_key(endpoint: str, payload: dict[str, Any]) -> str:
    canonical = json.dumps(
        payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    )
    return hashlib.sha256(f"{endpoint}:{canonical}".encode("utf-8")).hexdigest()


def _validate_role_id(role_id: str) -> dict[str, Any]:
    """404 для неизвестной роли (контракт: /plan и /chat → NotFound)."""
    role = ROLES_BY_ID.get(role_id)
    if role is None:
        raise HTTPException(
            status_code=404,
            detail=f"Неизвестная роль: допустимы {', '.join(ROLE_IDS)}",
        )
    return role


def _gaps_human(gaps: list[str]) -> list[str]:
    return [f"Не хватает навыка: {g}" for g in gaps]


def _rephrase_or_draft(
    provider: llm.LLMProvider, draft: str, context: str
) -> tuple[str, bool]:
    """Перефраз через провайдер с защитой смысла; (текст, использован_external)."""
    candidate = provider.rephrase(draft, context=context)
    if provider.name != "stub" and _accept_rephrase(draft, candidate):
        return candidate.strip(), True
    return draft, False


def _accept_rephrase(draft: str, candidate: str) -> bool:
    """LLM-перефраз принимаем, если он непустой и близок по объёму к черновику.

    Простая эврика против расхождения: кратный разнёс длины (>3x или <1/3)
    или пустой результат — берём черновик.
    """
    if not candidate or not candidate.strip():
        return False
    ratio = len(candidate.strip()) / max(1, len(draft.strip()))
    return 0.33 <= ratio <= 3.0


# ---------------------------------------------------------------------- app

app = FastAPI(title="Карьерный трекер — API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    # Локальный демо-фронт может жить на любом порту localhost (3000 занят
    # чужим процессом) — разрешаем localhost/127.0.0.1 с любым портом.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    # cookies/credentials фронт не использует (=True с wildcard-регэкспом —
    # несёт риск и ничем не нужен: API ходит по голому fetch без cookie).
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def _http_exception_handler(
    _request: Request, exc: HTTPException
) -> JSONResponse:
    """Контракт: 400/404 отдают ErrorResponse {error}."""
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(RequestValidationError)
async def _validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Контракт: 422 ValidationError и 400 BadRequest отдают {error}."""
    errors = exc.errors()
    if any(e.get("type") == "json_invalid" for e in errors):
        return JSONResponse(
            status_code=400,
            content={"error": "Некорректный JSON в теле запроса"},
        )
    parts: list[str] = []
    for err in errors[:3]:
        loc = ".".join(str(x) for x in err.get("loc", [])[1:]) or "тело"
        parts.append(f"Поле {loc}: {err.get('msg', 'ошибка валидации')}")
    return JSONResponse(
        status_code=422,
        content={"error": "; ".join(parts) or "Тело запроса не прошло валидацию"},
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    # Контракт: {ok: true}; ТЗ: {status: "ok"} — возвращаем оба поля.
    return HealthResponse(ok=True, status="ok")


@app.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest) -> RecommendResponse | JSONResponse:
    profile = req.profile
    phash = _profile_hash(profile)

    if profile.is_empty():
        # ТЗ: пустой профиль → 400 + fallback (контракт документирует 400).
        fallback_items = [
            {
                "role_id": r["id"],
                "title": r.get("title", r["id"]),
                "score": 0,
                "why": ["Заполните профиль — роль включена как базовое направление"],
                "matched": [],
                "gaps": [],
            }
            for r in sorted(ROLES, key=lambda x: x["id"])
        ]
        return JSONResponse(  # type: ignore[return-value]
            status_code=400,
            content={
                "error": "Пустой профиль: заполните хотя бы skills, interests или subjects",
                "profile_hash": phash,
                "fallback": fallback_items,
            },
        )

    key = _cache_key("recommend", {"profile": profile.model_dump(mode="json")})
    if key in _CACHE:
        cached = dict(_CACHE[key])
        cached["cached"] = True
        return RecommendResponse(**cached)

    rows = scoring.rank_roles(profile.model_dump(), ROLES, ALIASES)
    role_scores: list[RoleScore] = []
    for row in rows[:5]:
        role = ROLES_BY_ID.get(row["role_id"], {})
        why = scoring.build_why(
            profile.model_dump(),
            role,
            row["matched"],
            row["overlap_interests"],
            ALIASES,
        )
        role_scores.append(
            RoleScore(
                role_id=row["role_id"],
                title=row["title"],
                score=row["score"],
                why=why,
                matched=row["matched"],
                gaps=_gaps_human(row["gaps"]),
                # «N из M навыков» для UI (UX.md:74): вместо голого процента.
                matched_count=row["matched_count"],
                needed_count=row["needed_count"],
            )
        )
    resp = RecommendResponse(
        roles=role_scores,  # контракт: ровно 5, по убыванию score
        items=role_scores,  # ТЗ: алиас roles
        profile_hash=phash,
        cached=False,
    )
    _CACHE[key] = resp.model_dump()
    return resp


# Запрет лексики в проверках: проверка не «продаёт» результат и не обещает
# трудоустройство (запрет заказчика; DISCLAIMER глобальный не отменяет это).
_FORBIDDEN_CHECK_WORDS = ("гарант", "оффер", "офер", "трудоустро", "зарплат")


def _build_checks(role: dict[str, Any], all_roles: list[dict[str, Any]]) -> list[Check]:
    """Самопроверка понимания (совет раунда 2: «1 CHOICE + 1 SELF» на роль).

    Детерминированная генерация из СЫРЫХ строк рубрики роли — из description и
    закрытого словаря навыков. Не через _rephrase_or_draft: LLM-перефраз сломал
    бы дословность source и воспроизводимость cached-ответов. Без
    первоисточника — проверки нет (не выдумываем факты вне рубрики).
    """
    rid = str(role.get("id", ""))
    title = str(role.get("title") or rid)
    description = str(role.get("description") or "")
    if not description:
        return []
    if any(w in description.lower() for w in _FORBIDDEN_CHECK_WORDS):
        return []

    # Формат CHOICE: «Что делает X?» — три дословных описания ролей;
    # верное = текущая роль. Варианты — только из чужих описаний рубрик,
    # чтобы факт не вылезал за пределы базы. Позиция верного сдвигается
    # детерминированно.
    others = [
        r
        for r in all_roles
        if r.get("id") != rid
        and r.get("description")
        and not any(
            w in str(r.get("description", "")).lower() for w in _FORBIDDEN_CHECK_WORDS
        )
    ]
    if len(others) >= 2:
        pos = len(rid) % 3  # web→1, 1c→2, qa→0, support→1, startup→2
        options = [str(others[0]["description"]), str(others[1]["description"])]
        options.insert(pos, description)
        checks: list[Check] = [
            Check(
                id=f"{rid}-what-is",
                kind="choice",
                prompt=f"Что делает {title}?",
                options=options,
                correct=pos,
                hint="",
                source=f"role:{rid} — description",
                week=4,
            )
        ]
    else:
        checks = []

    # Формат SELF: «объясни своими словами» про навык с максимальным весом
    # (tie-break по id), ориентир — дословное description роли.
    sk = sorted(
        (s for s in role.get("skills_required") or [] if s.get("id")),
        key=lambda s: (-float(s.get("weight") or 0), str(s.get("id"))),
    )
    skill_id = str(sk[0]["id"]) if sk else ""
    skill_name = SKILL_NAMES.get(skill_id, skill_id or "")
    if skill_name:
        prompt = (
            f"Объясни своими словами: что такое {skill_name} "
            f"и зачем оно в роли «{title}»?"
        )
    else:
        prompt = f"Объясни своими словами: в чём суть роли «{title}»?"
        skill_id = ""
    checks.append(
        Check(
            id=f"{rid}-own-words",
            kind="self",
            prompt=prompt,
            hint=description,
            source=f"role:{rid} — description",
            skill=skill_id,
            week=3,
        )
    )
    return checks


@app.post("/plan", response_model=PlanResponse)
def plan(req: PlanRequest) -> PlanResponse:
    role = _validate_role_id(req.role_id)
    profile = req.profile
    phash = _profile_hash(profile)

    key = _cache_key(
        "plan",
        {"role_id": req.role_id, "profile": profile.model_dump(mode="json")},
    )
    if key in _CACHE:
        cached = dict(_CACHE[key])
        cached["cached"] = True  # симметрично /recommend (ТЗ-поле cached)
        return PlanResponse(**cached)

    # Факты — только из рубрики роли (development_steps + resources).
    draft_steps = [str(s) for s in role.get("development_steps") or []]
    if not draft_steps:
        raise HTTPException(
            status_code=404, detail="Для роли нет рубрики (development_steps)"
        )

    provider = llm.get_provider()
    steps: list[str] = []
    llm_used: str = "stub"
    for draft in draft_steps:
        text, external = _rephrase_or_draft(provider, draft, f"роль: {role['title']}")
        steps.append(text)
        if external:
            llm_used = "external"

    # 4 недели (контракт: n 1–4, tasks minItems 1): круговой разбор шагов,
    # при нехватке шагов — детерминированный цикл по рубрике.
    #
    # Персонализация (совет: план из профиля, а не только из роли): недели
    # 1–2 открываются задачами закрытия верхних пробелов ПРОФИЛЯ этой роли
    # (детерминированно: -weight, id; максимум 3). Недели 3–4 — рубрика роли
    # без изменений. Пустой профиль → персональных задач нет (базовый план).
    personal = scoring.gap_tasks(profile.model_dump(), role, ALIASES, SKILL_NAMES)
    personal_slots: dict[int, list[str]] = {1: personal[:2], 2: personal[2:3]}

    weeks: list[Week] = []
    for n in range(1, 5):
        tasks = [steps[i] for i in range(n - 1, len(steps), 4)]
        for extra in personal_slots.get(n, []):
            if extra not in tasks:
                tasks.insert(0, extra)
        if not tasks:
            tasks = [steps[(n - 1) % len(steps)]]
        weeks.append(Week(n=n, tasks=tasks))

    _, _, gaps, _ = scoring.score_role(profile.model_dump(), role, ALIASES)
    checklist = [f"Освоен навык «{g}»" for g in gaps] or [
        "Профиль покрывает навыки роли — план расширяет опыт"
    ]

    resources = [
        Resource(
            title=str(r.get("title", "")),
            url=str(r.get("url", "")),
            type=r.get("type"),
            minutes=r.get("minutes"),
        )
        for r in role.get("resources") or []
        if r.get("title") and r.get("url")
    ]

    summary = (
        f"План на 30 дней для роли «{role['title']}»: 4 недели, "
        f"{len(steps)} шагов из рубрики роли, {len(gaps)} пробелов в профиле. "
        "Все шаги взяты из закрытой базы ролей."
    )
    if personal:
        summary += (
            f" Недели 1–2 начинаются с {len(personal)} персональных задач "
            "закрытия твоих пробелов."
        )

    resp = PlanResponse(
        weeks=weeks,  # контракт: ровно 4 недели
        checklist=checklist,  # контракт: чек-лист пробелов
        role_id=req.role_id,
        title=role.get("title", req.role_id),
        steps=steps,
        resources=resources,
        gaps=_gaps_human(gaps),
        summary=summary,
        disclaimer=DISCLAIMER,
        profile_hash=phash,
        llm_used=llm_used,  # type: ignore[arg-type]
        cached=False,
        # Аддитивная самопроверка (1 CHOICE + 1 SELF): факты из сырых строк
        # рубрики, детерминированно → cached-ответ идентичен свежему.
        checks=_build_checks(role, ROLES),
    )
    _CACHE[key] = resp.model_dump()
    return resp


# Общие слова-топики консультации: вопрос о них считается «о роли», а не
# выдуманным вне рубрики (шаблон отказа применяется к чужой тематике).
_GENERIC_TOPIC_WORDS = {
    "шаги",
    "шаг",
    "развитие",
    "развития",
    "план",
    "планы",
    "навыки",
    "навык",
    "ресурсы",
    "ресурс",
    "роль",
    "роли",
    "компании",
    "партнеры",
    "партнёры",
    "старт",
    "начать",
    "начинающий",
    "изучать",
    "изучении",
    "обучение",
    "курс",
    "плане",
    "путь",
    "карьера",
    "карьере",
    "специальность",
    "профессия",
    "профессии",
}


def _rubric_vocab(role: dict[str, Any]) -> set[str]:
    """Словарь тем роли: навыки, теги, заголовок, шаги, ресурсы, компании."""
    parts: list[str] = [str(role.get("title", "")), str(role.get("description", ""))]
    parts.extend(str(s.get("id", "")) for s in role.get("skills_required") or [])
    parts.extend(str(t) for t in role.get("tags") or [])
    parts.extend(str(s) for s in role.get("related_specialties") or [])
    parts.extend(str(s) for s in role.get("development_steps") or [])
    parts.extend(str(r.get("title", "")) for r in role.get("resources") or [])
    parts.extend(str(c) for c in role.get("partner_companies") or [])
    return _tokens(" ".join(parts)) | _GENERIC_TOPIC_WORDS


def _chat_draft(role: dict[str, Any], message: str) -> tuple[str, list[str]]:
    """Черновик ответа строго из фактов рубрики роли."""
    role_id = role["id"]
    msg_tokens = _tokens(message)
    steps = [str(s) for s in role.get("development_steps") or []]
    relevant = [s for s in steps if _tokens(s) & msg_tokens] or steps[:3]

    lines = [
        f"Отвечаю только по рубрике роли «{role.get('title', role_id)}».",
        f"Описание роли: {role.get('description', '')}.",
        "Релевантные шаги развития: " + "; ".join(relevant) + ".",
    ]
    resources = role.get("resources") or []
    if resources:
        res = "; ".join(f"{r.get('title')} ({r.get('url')})" for r in resources[:2])
        lines.append(f"Ресурсы: {res}.")
    lines.append("Ответ построен на закрытой базе ролей, не выходит за её рамки.")

    sources = [f"role:{role_id} — development_steps", f"role:{role_id} — description"]
    if resources:
        sources.append(f"role:{role_id} — resources")
    return " ".join(lines), sources


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    profile = req.profile
    phash = _profile_hash(profile)

    if req.role_id is not None:
        role = _validate_role_id(req.role_id)
    else:
        # ТЗ: role_id опционален — роль выводится из профиля.
        if profile.is_empty():
            raise HTTPException(
                status_code=400,
                detail="Укажите role_id или заполните профиль для выбора роли",
            )
        top = scoring.rank_roles(profile.model_dump(), ROLES, ALIASES)[0]
        role = ROLES_BY_ID[top["role_id"]]

    msg_tokens = _tokens(req.message)
    if not (msg_tokens & _rubric_vocab(role)):
        # ТЗ: только темы рубрики, иначе отказ-шаблон.
        refusal = (
            "Ответ возможен только в пределах тем роли: навыки, шаги развития, "
            "ресурсы и партнёры из закрытой базы. Переформулируйте вопрос "
            f"о роли «{role.get('title', role['id'])}»."
        )
        return ChatResponse(
            reply=refusal, answer=refusal, sources=[], profile_hash=phash
        )

    draft, sources = _chat_draft(role, req.message)
    provider = llm.get_provider()
    reply, external_used = _rephrase_or_draft(
        provider, draft, f"роль: {role.get('title', role['id'])}"
    )

    # Контракт: reply + sources; ТЗ: answer (алиас reply) + profile_hash +
    # llm_used (режим консультанта для честного бейджа в UI: live/демо).
    llm_used = "external" if external_used else "stub"
    return ChatResponse(
        reply=reply,
        answer=reply,
        sources=sources,
        profile_hash=phash,
        llm_used=llm_used,  # type: ignore[arg-type]
    )
