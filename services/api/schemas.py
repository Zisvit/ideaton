"""Pydantic v2-схемы API карьерного трекера.

Принцип выравнивания (контракт главнее): packages/contracts/openapi.yaml —
источник истины по ОБЯЗАТЕЛЬНЫМ полям response/request. ТЗ-список полей
(items, cached, matched, answer, status, …) — расширения сверх контракта.
OpenAPI-схемы контракта не запрещают дополнительные поля (нет
additionalProperties:false), поэтому модели содержат И контрактные поля
(roles, why, weeks, checklist, reply, ok), И поля ТЗ. Контрактные поля
обязательны и типизированы строго; ТЗ-поля — опциональные/алиасы.

Profile парсится мягче контракта (поля опциональны с дефолтами), чтобы
«пустой профиль» доходил до обработчика и получал 400 + fallback (а не 422) —
так требует ТЗ /recommend. Обе стороны (400 и 422) документированы контрактом.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# Канонический закрытый словарь ролей (контракт: components.schemas.RoleId).
RoleId = Literal["web", "1c", "qa", "support", "startup"]

ROLE_IDS: tuple[str, ...] = ("web", "1c", "qa", "support", "startup")


class Profile(BaseModel):
    """Профиль студента — поля ровно как в контракте Profile.

    Опциональность нужна только для пути «пустой профиль → 400 + fallback»;
    валидация course (1–6) сохраняется как в контракте.
    """

    skills: list[str] = Field(
        default_factory=list, description="Навыки (нормализуются по skills.yaml)"
    )
    interests: list[str] = Field(default_factory=list, description="Интересы")
    subjects: list[str] = Field(default_factory=list, description="Изучаемые предметы")
    course: int | None = Field(
        default=None, ge=1, le=6, description="Курс обучения 1–6"
    )
    specialty: str | None = Field(
        default=None, description="Специальность / направление подготовки"
    )

    def is_empty(self) -> bool:
        """Профиль пуст, если нет ни навыков, ни интересов, ни предметов."""
        return not self.skills and not self.interests and not self.subjects


class RecommendRequest(BaseModel):
    profile: Profile = Field(default_factory=Profile)


class RoleScore(BaseModel):
    """Одна траектория из топ-5.

    Контракт обязывает role_id/title/score/why/gaps (why — human-причины,
    minItems 1). matched — расширение ТЗ (канонические id совпавших навыков).
    """

    role_id: str
    title: str
    score: int = Field(ge=0, le=100)
    why: list[str] = Field(min_length=1, description="Причины, почему роль подходит")
    matched: list[str] = Field(
        default_factory=list, description="Совпавшие навыки (ТЗ)"
    )
    gaps: list[str] = Field(default_factory=list, description="Пробелы профиля")


class RecommendResponse(BaseModel):
    """Контракт требует roles (ровно 5); items/profile_hash/cached — расширения ТЗ."""

    roles: list[RoleScore] = Field(min_length=5, max_length=5)
    items: list[RoleScore] = Field(
        default_factory=list, description="Алиас roles (ТЗ); main.py заполняет тем же"
    )
    profile_hash: str = ""
    cached: bool = False


class Resource(BaseModel):
    """Образовательный ресурс роли.

    minutes — integer ≥1; разрешён контрактом roles.schema.json (resources).
    """

    title: str
    url: str
    type: str | None = None
    minutes: int | None = Field(default=None, ge=1, description="Оценка времени, мин")


class PlanRequest(BaseModel):
    profile: Profile = Field(default_factory=Profile)
    # str (не Literal), чтобы неизвестный role_id давал 404 из обработчика,
    # как документирует контракт (/plan, /chat → 404 NotFound), а не 422.
    role_id: str


class Week(BaseModel):
    """Неделя плана (контракт: n 1–4, tasks minItems 1)."""

    n: int = Field(ge=1, le=4)
    tasks: list[str] = Field(min_length=1)


class PlanResponse(BaseModel):
    """Контракт обязывает weeks (ровно 4) и checklist; остальное — расширения ТЗ."""

    weeks: list[Week] = Field(min_length=4, max_length=4)
    checklist: list[str] = Field(
        default_factory=list, description="Чек-лист пробелов, которые закрывает студент"
    )
    role_id: str = ""
    title: str = ""
    steps: list[str] = Field(
        default_factory=list,
        description="Шаги рубрики плоско (ТЗ); факты только из рубрики",
    )
    resources: list[Resource] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    summary: str = ""
    disclaimer: str = ""
    profile_hash: str = ""
    llm_used: Literal["stub", "external"] = "stub"


class ChatRequest(BaseModel):
    profile: Profile = Field(default_factory=Profile)
    message: str = Field(min_length=1)
    # Контракт делает role_id обязательным; ТЗ допускает None (роль выводится
    # из профиля). Принимаем оба случая: None → выводим роль, иначе валидируем.
    role_id: str | None = None


class ChatResponse(BaseModel):
    """Контракт обязывает reply + sources; answer — алиас ТЗ (то же значение)."""

    reply: str
    answer: str = Field(default="", description="Алиас reply (ТЗ)")
    sources: list[str] = Field(default_factory=list)
    profile_hash: str = ""


class HealthResponse(BaseModel):
    """Контракт обязывает ok:true; status — расширение ТЗ."""

    ok: bool = True
    status: str = "ok"


class ErrorResponse(BaseModel):
    """Контракт: 400/404/422 отдают {error: ...}."""

    error: str
