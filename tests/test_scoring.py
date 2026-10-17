"""Юнит-тесты чистого скоринга (scoring.py): формула, тай-брейк, счётчики,
персональные gap-задачи. Только литеральные данные + реальные data/roles,
никакого HTTP и никакого LLM.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "api"))

import scoring  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

ROLE_WEB = {
    "id": "web",
    "title": "Frontend-разработчик",
    "skills_required": [
        {"id": "html", "weight": 0.9},
        {"id": "css", "weight": 0.9},
        {"id": "javascript", "weight": 1.0},
        {"id": "typescript", "weight": 0.7},
        {"id": "react", "weight": 0.6},
        {"id": "nodejs", "weight": 0.5},
    ],
    "tags": ["frontend", "backend", "fullstack"],
}

ROLE_EQUIV_A = {
    "id": "aaa",
    "title": "Роль A",
    "skills_required": [{"id": "python", "weight": 1.0}],
    "tags": [],
}
ROLE_EQUIV_B = {
    "id": "bbb",
    "title": "Роль B",
    "skills_required": [{"id": "python", "weight": 1.0}],
    "tags": [],
}


# ------------------------------------------------------------------ score_role
def test_score_role_formula_and_outputs() -> None:
    """python закрыт (вес 1.0 из 2.0) + 1 интерес-бонус cap 3: (1+1)/(2+3)=40."""
    profile = {"skills": ["python"], "interests": ["аналитика"], "subjects": []}
    role = {
        "id": "data",
        "title": "Данные",
        "skills_required": [
            {"id": "python", "weight": 1.0},
            {"id": "sql", "weight": 1.0},
        ],
        "tags": ["аналитика"],
    }
    aliases = {"python": "python", "sql": "sql"}
    score, matched, gaps, overlap = scoring.score_role(profile, role, aliases)
    assert score == 40
    assert matched == ["python"]
    assert gaps == ["sql"]
    assert overlap == ["аналитика"]


def test_score_role_empty_profile() -> None:
    """Пустой профиль: score 0, все требуемые id — в gaps, почему minItems есть."""

    profile: dict[str, list[str]] = {"skills": [], "interests": [], "subjects": []}
    role = dict(ROLE_WEB)
    score, matched, gaps, overlap = scoring.score_role(profile, role, {})
    assert score == 0
    assert matched == []
    assert gaps == sorted(
        ["html", "css", "javascript", "typescript", "react", "nodejs"]
    )
    assert overlap == []


def test_score_role_clamps_and_zero_weight_role() -> None:
    """Роль без skills_required (max=3) и Დва способа клампа 0..100."""
    role: dict[str, object] = {
        "id": "x",
        "title": "X",
        "skills_required": [],
        "tags": [],
    }
    assert (
        scoring.score_role({"skills": [], "interests": [], "subjects": []}, role, {})[0]
        == 0
    )
    # 5 пересечений интересов → кап 3 → 3/3 = 100
    role_tags_many = dict(role, tags=[f"tag{i}" for i in range(5)])
    profile = {"skills": [], "interests": [f"tag{i}" for i in range(5)], "subjects": []}
    assert scoring.score_role(profile, role_tags_many, {})[0] == 100


def test_rank_roles_tie_break_by_role_id() -> None:
    """Одинаковый score → детерминированный порядок по role_id по возрастанию."""
    profile = {"skills": ["python"], "interests": [], "subjects": []}
    rows = scoring.rank_roles(profile, [ROLE_EQUIV_B, ROLE_EQUIV_A], {})
    assert [(r["role_id"], r["score"]) for r in rows] == [("aaa", 25), ("bbb", 25)]


# ------------------------------------------------------------------ match_counts
def test_match_counts_dedup_and_intersection() -> None:
    """Дубликат id в skills_required не раздувает M; чужие id в matched не считаются."""
    role = {
        "id": "dup",
        "title": "Dup",
        "skills_required": [
            {"id": "python", "weight": 1.0},
            {"id": "python", "weight": 0.5},  # дубликат
            {"id": "sql", "weight": 1.0},
        ],
        "tags": [],
    }
    # matched содержит лишний id (не требуемый) → в счётчик не попадает
    matched, needed = scoring.match_counts(["python", "rust"], role)
    assert (matched, needed) == (1, 2)


def test_rank_roles_row_fields() -> None:
    """rank возвращает счётчики согласованно с matched/gaps."""
    profile = {"skills": ["python"], "interests": [], "subjects": []}
    roles = [
        {
            "id": "solo",
            "title": "Solo",
            "skills_required": [
                {"id": "python", "weight": 1.0},
                {"id": "sql", "weight": 1.0},
            ],
            "tags": [],
        }
    ]
    row = scoring.rank_roles(profile, roles, {})[0]
    assert row["matched_count"] == 1
    assert row["needed_count"] == 2
    assert row["gaps"] == ["sql"]


# --------------------------------------------------------------- реально data
def test_real_skills_yaml_aliases_and_names() -> None:
    """Реальный data/roles/skills.yaml: синоним «1с» → 1c; имена присутствуют."""
    aliases = scoring.load_synonyms(ROOT / "data" / "roles" / "skills.yaml")
    assert aliases.get("1с") == "1c"  # кириллический синоним
    assert aliases.get("js") in (None, "javascript")  # не обещаем лишних
    names = scoring.load_skill_names(ROOT / "data" / "roles" / "skills.yaml")
    assert names.get("python") == "Python"
    unknown = scoring.normalize_skill("_GRAAL_", aliases)
    assert unknown == "_graal_"  # неизвестный навык → identity в lowercase


def test_profile_with_cyrillic_synonym_counts() -> None:
    """Кириллический синоним в профиле закрывает требуемый навык роли."""
    aliases = scoring.load_synonyms(ROOT / "data" / "roles" / "skills.yaml")
    role = {
        "id": "onec",
        "title": "1С",
        "skills_required": [{"id": "1c", "weight": 1.0}],
        "tags": [],
    }
    _, matched, gaps, _ = scoring.score_role(
        {"skills": ["1С"], "interests": [], "subjects": []}, role, aliases
    )
    assert matched == ["1c"]
    assert gaps == []


# ------------------------------------------------------------------ gap_tasks
def test_gap_tasks_order_weight_then_id_and_limit() -> None:
    """Top-gaps: сортировка (−weight, id); limit 3; имена из словаря."""
    role = dict(ROLE_WEB)
    profile = {"skills": ["html"], "interests": [], "subjects": []}
    names = {"javascript": "JavaScript", "css": "CSS", "typescript": "TypeScript"}
    tasks = scoring.gap_tasks(profile, role, {}, names, limit=3)
    assert len(tasks) == 3
    # javascript weight 1.0 → первый; дальше css (0.9) — tie с html? html закрыт.
    assert "JavaScript" in tasks[0]
    assert tasks == [
        "Закрыть пробел «JavaScript»: обязательный навык роли, в профиле его нет",
        "Закрыть пробел «CSS»: обязательный навык роли, в профиле его нет",
        "Закрыть пробел «TypeScript»: обязательный навык роли, в профиле его нет",
    ]


def test_gap_tasks_empty_profile_and_no_gaps() -> None:
    """Пустой профиль → []; закрытая роль → [] (базовый план без вставок)."""
    empty = {"skills": [], "interests": [], "subjects": []}
    assert scoring.gap_tasks(empty, ROLE_WEB, {}, {}) == []
    full = {
        "skills": ["html", "css", "javascript", "typescript", "react", "nodejs"],
        "interests": [],
        "subjects": [],
    }
    assert scoring.gap_tasks(full, ROLE_WEB, {}, {}) == []
    assert (
        scoring.gap_tasks(
            {"interests": ["frontend"], "skills": [], "subjects": []}, ROLE_WEB, {}, {}
        )
        != []
    )  # не-пустой профиль с интересами участвует


def test_gap_tasks_fallback_id_name() -> None:
    """Без словаря имён — фолбэк на id в формулировке задачи."""
    tasks = scoring.gap_tasks(
        {"skills": ["html"], "interests": [], "subjects": []},
        {"id": "r", "title": "R", "skills_required": [{"id": "sql", "weight": 0.5}]},
        {},
        None,
    )
    assert tasks == ["Закрыть пробел «sql»: обязательный навык роли, в профиле его нет"]
