"""Интеграционные тесты API поверх TestClient (без поднятия портов).

Закрывает претензию совета «contract_check не ходит по сервису»: реальные
запросы на приложение main.app — /health, /recommend, /plan, /chat, плюс
краевые случаи контракта (400 пустого профиля, 404 роли, 422 формы, кэш,
CORS preflight, бейдж llm_used, персональные недели).
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "api"))

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(main.app)

PROFILE = {
    "skills": ["python", "git", "html", "javascript"],
    "interests": ["веб-разработка", "аналитика"],
    "subjects": ["базы данных", "алгоритмы"],
    "course": 4,
    "specialty": "Информационные системы и технологии",
}


def _post(path: str, payload: object):
    return client.post(path, json=payload)


# ---------------------------------------------------------------------- health
def test_health_ok() -> None:
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["status"] == "ok"


# ------------------------------------------------------------------- recommend
def test_recommend_shape_and_counters() -> None:
    r = _post("/recommend", {"profile": PROFILE})
    assert r.status_code == 200, r.text
    roles = r.json()["roles"]
    assert len(roles) == 5
    scores = [x["score"] for x in roles]
    assert scores == sorted(scores, reverse=True)  # убывание
    for role in roles:  # аддитивные счётчики «N из M»
        assert 0 <= role["matched_count"] <= role["needed_count"]
        assert role["needed_count"] >= 0
    assert r.json()["cached"] is False


def test_recommend_cache_hit_sets_flag() -> None:
    _post("/recommend", {"profile": dict(PROFILE, skills=["python"])})
    r2 = _post("/recommend", {"profile": dict(PROFILE, skills=["python"])})
    assert r2.status_code == 200
    assert r2.json()["cached"] is True


def test_recommend_empty_profile_returns_400_with_fallback() -> None:
    r = _post(
        "/recommend",
        {"profile": {"skills": [], "interests": [], "subjects": []}},
    )
    assert r.status_code == 400
    body = r.json()
    assert "error" in body
    assert len(body["fallback"]) == 5


def test_recommend_broken_json_is_400_error_response() -> None:
    r = client.post(
        "/recommend",
        content="{'profile': ",
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 400
    assert "error" in r.json()


def test_recommend_missing_body_field_is_422_error_response() -> None:
    """Невалидный ТИП поля (не json_invalid, не missing — у profile default) → 422."""
    r = _post(
        "/recommend",
        {"profile": {"skills": "не-список", "interests": [], "subjects": []}},
    )
    assert r.status_code == 422
    assert "error" in r.json()


def test_recommend_empty_object_falls_to_empty_profile_400() -> None:
    """{} → profile с default-фабрикой → пустой профиль → 400 + fallback."""
    r = _post("/recommend", {})
    assert r.status_code == 400
    assert "error" in r.json()
    assert len(r.json()["fallback"]) == 5


# ------------------------------------------------------------------------ plan
def test_plan_shape_and_personal_weeks() -> None:
    r = _post("/plan", {"role_id": "web", "profile": PROFILE})
    assert r.status_code == 200, r.text
    body = r.json()
    weeks = body["weeks"]
    assert [w["n"] for w in weeks] == [1, 2, 3, 4]
    for w in weeks:
        assert w["tasks"], f"неделя {w['n']} пуста"
    # Персонализация: профиль не знает css (weight 0.9 — верхний gap),
    # поэтому неделя 1 начинается с «Закрыть пробел …»из списка top-gaps
    assert any("Закрыть пробел" in t for t in weeks[0]["tasks"]), (
        f"неделя 1 без персональных задач: {weeks[0]['tasks']}"
    )


def test_plan_summary_mentions_personal_tasks() -> None:
    r = _post("/plan", {"role_id": "web", "profile": PROFILE})
    assert "персональных" in r.json()["summary"]


def test_plan_cache_hit_and_flags() -> None:
    payload = {"role_id": "qa", "profile": PROFILE}
    _post("/plan", payload)
    r2 = _post("/plan", payload)
    assert r2.status_code == 200
    assert r2.json()["cached"] is True


def test_plan_unknown_role_404() -> None:
    r = _post("/plan", {"role_id": "demo_nonexistent", "profile": PROFILE})
    assert r.status_code == 404
    assert "error" in r.json()


def test_plan_empty_profile_is_valid_base_plan() -> None:
    """Пустой профиль на /plan легален (в отличие от /recommend): базовый план."""
    r = _post(
        "/plan",
        {"role_id": "web", "profile": {"skills": [], "interests": [], "subjects": []}},
    )
    assert r.status_code == 200
    weeks = r.json()["weeks"]
    assert len(weeks) == 4
    # Персональных вставок нет — рубрика роли без персонализации
    assert all("Закрыть пробел" not in t for w in weeks for t in w["tasks"])


# --------------------------------------------------------------- plan: checks
_FORBIDDEN = ("гарант", "оффер", "трудоустро", "зарплат")
ROLES_DIR = Path(__file__).resolve().parents[1] / "data" / "roles"


def _rubric_text() -> str:
    """Конкатенация всех YAML-рубрик — источник дословности вариантов."""
    parts = [p.read_text(encoding="utf-8") for p in sorted(ROLES_DIR.glob("*.yaml"))]
    return "\n".join(parts)


def test_plan_checks_present_and_shape() -> None:
    """Каждая роль получает 1 CHOICE + 1 SELF; ids уникальны, поля согласованы."""
    r = _post("/plan", {"role_id": "web", "profile": PROFILE})
    assert r.status_code == 200, r.text
    checks = r.json()["checks"]
    assert len(checks) >= 2
    assert len({c["id"] for c in checks}) == len(checks)
    kinds = {c["kind"] for c in checks}
    assert kinds <= {"self", "choice"} and "choice" in kinds and "self" in kinds
    for c in checks:
        assert c["prompt"]
        assert c["week"] in (1, 2, 3, 4)
        if c["kind"] == "choice":
            assert len(c["options"]) >= 2
            assert c["correct"] is not None and 0 <= c["correct"] < len(c["options"])
        else:
            assert c["hint"], "self обязан нести дословный ориентир"


def test_plan_checks_options_are_verbatim_rubric_quotes() -> None:
    """Анти-галлюцинация: каждый вариант CHOICE дословно лежит в YAML-рубриках.

    База не содержит энциклопедических определений навыков (skills.yaml —
    только name+synonyms), поэтому «знает что это такое» проверяем опознанием
    роли из дословных описаний. Верный вариант = описание текущей роли.
    """
    rubric = _rubric_text()
    for role_id in ("web", "1c", "qa", "support", "startup"):
        body = _post("/plan", {"role_id": role_id, "profile": PROFILE}).json()
        choices = [c for c in body["checks"] if c["kind"] == "choice"]
        assert choices, f"{role_id}: нет CHOICE-карточки"
        for c in choices:
            own_index = c["correct"]
            own = c["options"][own_index]
            assert own == str(main.ROLES_BY_ID[role_id]["description"]), (
                f"{role_id}: верный вариант не дос описание роли"
            )
            for option in c["options"]:
                assert option in rubric, f"вариант вне рубрик: {option[:40]}…"


def test_plan_checks_choice_prompt_and_position_vary() -> None:
    """Промпт CHOICE строится из рубричной темы; позиция верного сдвигается."""
    prompts, positions = set(), set()
    for role_id in ("web", "qa", "support"):
        body = _post("/plan", {"role_id": role_id, "profile": PROFILE}).json()
        choice = next(c for c in body["checks"] if c["kind"] == "choice")
        title = str(main.ROLES_BY_ID[role_id]["title"])
        assert title in choice["prompt"], "вопрос должен называть свою роль"
        prompts.add(choice["prompt"])
        positions.add(choice["correct"])
    assert len(prompts) == 3
    assert len(positions) >= 2, "позиция верного варианта не должна быть константой"


def test_plan_checks_self_hint_is_verbatim_description() -> None:
    for role_id in ("web", "startup"):
        body = _post("/plan", {"role_id": role_id, "profile": PROFILE}).json()
        self_checks = [c for c in body["checks"] if c["kind"] == "self"]
        assert self_checks, f"{role_id}: нет SELF-карточки"
        for c in self_checks:
            assert c["hint"] == str(main.ROLES_BY_ID[role_id]["description"])
            assert c["source"].startswith(f"role:{role_id} — ")


def test_plan_checks_no_employment_lexicon() -> None:
    """Запрет заказчика: проверка не обещает трудоустройство и не «продаёт»."""
    for role_id in ("web", "1c", "qa", "support", "startup"):
        checks = _post("/plan", {"role_id": role_id, "profile": PROFILE}).json()[
            "checks"
        ]
        for c in checks:
            blob = " ".join(
                [
                    c["prompt"],
                    c["hint"],
                    c["source"],
                    *[str(o) for o in c.get("options", [])],
                ]
            ).lower()
            assert not any(w in blob for w in _FORBIDDEN), f"{role_id}: {w} в проверке"


def test_plan_checks_deterministic_and_cache_symmetric() -> None:
    """checks детерминированы ролью: два одинаковых POST → идентичный массив."""
    payload = {"role_id": "qa", "profile": PROFILE}
    first = _post("/plan", payload).json()
    second = _post("/plan", payload).json()
    assert first["checks"] == second["checks"]
    assert second["cached"] is True
    assert first["checks"] == second["checks"]  # cached-путь идентичен свежему


# ------------------------------------------------------------------------ chat
def test_chat_on_topic_reply_and_llm_used_badge() -> None:
    r = _post(
        "/chat",
        {"role_id": "web", "profile": PROFILE, "message": "Какие шаги развития?"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reply"]
    assert body["reply"] == body["answer"]
    assert body["llm_used"] in ("stub", "external")


def test_chat_off_topic_refusal() -> None:
    r = _post(
        "/chat",
        {"role_id": "web", "profile": PROFILE, "message": "Какая погода в Сочи?"},
    )
    assert r.status_code == 200
    assert "только в пределах тем роли" in r.json()["reply"]


def test_chat_empty_profile_without_role_is_400() -> None:
    r = _post(
        "/chat",
        {
            "role_id": None,
            "profile": {"skills": [], "interests": [], "subjects": []},
            "message": "шаги",
        },
    )
    assert r.status_code == 400
    assert "error" in r.json()


# ------------------------------------------------------------------------ CORS
def test_cors_preflight_for_any_localhost_port() -> None:
    r = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3210",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3210"
    # credentials сняты: заголовок не возвращается
    assert "access-control-allow-credentials" not in r.headers


# ------------------------------------------------------------- llm fail-soft
def test_llm_enabled_without_url_is_soft_stub(monkeypatch) -> None:
    import llm

    monkeypatch.setattr(llm, "_WARNED_MISSING_URL", False)
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.delenv("LLM_URL", raising=False)
    provider = llm.get_provider()
    assert provider.name == "stub"  # API не падает, работает демонстрационный режим

    monkeypatch.setenv("LLM_ENABLED", "1")  # толерантные булевы строки
    assert llm.get_provider().name == "stub"
