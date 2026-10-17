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

from pydantic import BaseModel, Field, model_validator

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
    # Контракт: gaps входит в required [role_id, title, score, why, gaps]
    # — обязательное без default (расхождение с дефолтом ловит контракт-тест на живом приложении).
    gaps: list[str] = Field(description="Пробелы профиля")
    # ТЗ-расширение для «N из M навыков» вместо голого процента (UX.md:74).
    matched_count: int = Field(
        default=0, ge=0, description="Сколько уникальных требуемых навыков закрыто"
    )
    needed_count: int = Field(
        default=0, ge=0, description="Сколько всего уникальных требуемых навыков"
    )


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


class Check(BaseModel):
    """Самопроверка понимания (аддитивное поле PlanResponse, совет раунда 2).

    Формат «1 CHOICE + 1 SELF» на роль: choice = «опознай роль/шаг» с вариантами
    — ДОСЛОВНЫМИ строками рубрик (анти-галлюцинация), self = «объясни своими
    словами» с дословным ориентиром. Результат прохождения хранится только на
    клиенте (как done), серверный state не появляется.
    """

    id: str = Field(min_length=1, description="Стабильный ключ клиентского хранилища")
    prompt: str = Field(
        min_length=1, description="Вопрос проверки — только факты рубрики роли"
    )
    kind: Literal["self", "choice"] = Field(
        default="self", description="self — своими словами; choice — выбор из цитат"
    )
    options: list[str] = Field(
        default_factory=list,
        description="Только для kind=choice; дословные цитаты рубрик",
    )
    correct: int | None = Field(
        default=None, ge=0, description="Индекс верного варианта в options"
    )
    hint: str = Field(
        default="", description="Ориентир (self): дословная цитата рубрики"
    )
    source: str = Field(
        default="",
        description="role:{id} — {поле}; прослеживаемость факта (как sources в /chat)",
    )
    skill: str = Field(
        default="", description="id навыка из закрытого словаря (для kind=self)"
    )
    week: int = Field(default=1, ge=1, le=4, description="Подсказка UI: к какой неделе")

    # choice обязан быть согласованным; иначе тихо деградируем в self —
    # факт-объект не роняем: skill-проверка остаётся честной без вариантов.
    @model_validator(mode="after")
    def _self_if_options_broken(self) -> "Check":
        if self.kind == "choice":
            if (
                len(self.options) >= 2
                and self.correct is not None
                and 0 <= self.correct < len(self.options)
            ):
                return self
            self.kind = "self"
            self.options = []
            self.correct = None
        return self


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
    # ТЗ-расширение: симметрично /recommend — флаг кэша в ответе.
    cached: bool = Field(default=False, description="Ответ отдан из кэша (ТЗ)")
    # Аддитивная самопроверка понимания (совет: 1 CHOICE + 1 SELF из рубрики).
    # НЕ в required: UI рендерит блок только при непустом массиве.
    checks: list[Check] = Field(
        default_factory=list,
        description="Самопроверка понимания (аддитивно; факты только из рубрики роли)",
    )


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
    # ТЗ-расширение: режим консультанта для UI-бейджа (демо-режим / ИИ).
    llm_used: Literal["stub", "external"] = "stub"


class HealthResponse(BaseModel):
    """Контракт обязывает ok:true; status — расширение ТЗ."""

    ok: bool = True
    status: str = "ok"


class ErrorResponse(BaseModel):
    """Контракт: 400/404/422 отдают {error: ...}."""

    error: str
