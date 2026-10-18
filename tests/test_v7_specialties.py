"""Гейты v7: 21 специальность СИУЭиП + лимит рекомендаций 1–12.

Закрывает долги совета v7:
  - lockstep закрытого словаря в 4 местах (roles.schema.json, openapi.yaml,
    schemas.py, data/roles/*.yaml) — расхождение = CI-fail;
  - специальности как данные: 5 шагов, ≥4 навыка, ресурс с https, kind;
  - покрытие: id навыков ролей живут в skills.yaml, синонимы не коллизят
    (scoring.load_synonyms молча терял коллизии через setdefault);
  - лексика: без «гарантий/оффера/трудоустройства/зарплаты» в рубриках;
  - limit: 1..12, режет и fallback; кэш различает limit.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
import schemas  # noqa: E402

client = TestClient(main.app)

ROLES_DIR = ROOT / "data" / "roles"
SPECIALTY_IDS = [
    "infocom",
    "net_admin",
    "software_dev",
    "electrician",
    "medicine",
    "pharmacy",
    "nursing",
    "economics",
    "banking",
    "trade",
    "social_work",
    "law_enforcement",
    "law_social",
    "law_court",
    "beauty",
    "preschool",
    "pedagogy_extra",
    "correction_ped",
    "physical_culture",
    "graphic_design",
    "design",
]
ROLE_IDS_5 = ["web", "1c", "qa", "support", "startup"]
ALL_IDS = ROLE_IDS_5 + SPECIALTY_IDS
PROFILE = {
    "skills": ["python", "git", "html"],
    "interests": ["веб-разработка"],
    "subjects": ["базы данных"],
    "course": 4,
    "specialty": "Информационные системы и технологии",
}
FORBIDDEN = ("гарант", "оффер", "офер", "трудоустро", "зарплат")


# ------------------------------------------------------------------ lockstep
def test_role_id_lockstep_four_places() -> None:
    schema = json.loads(
        (ROOT / "packages" / "contracts" / "roles.schema.json").read_text()
    )
    schema_enum = schema["properties"]["id"]["enum"]
    contract = yaml.safe_load(
        (ROOT / "packages" / "contracts" / "openapi.yaml").read_text()
    )
    contract_enum = contract["components"]["schemas"]["RoleId"]["enum"]
    assert schema_enum == list(schemas.ROLE_IDS), "roles.schema.json ≠ schemas.py"
    assert contract_enum == list(schemas.ROLE_IDS), "openapi.yaml ≠ schemas.py"
    assert list(schemas.ROLE_IDS) == ALL_IDS
    yaml_ids = {p.stem for p in ROLES_DIR.glob("*.yaml") if p.name != "skills.yaml"}
    assert yaml_ids == set(ALL_IDS), f"YAML не совпадают: {yaml_ids ^ set(ALL_IDS)}"


def test_roles_loaded_with_kind_and_order() -> None:
    ids = [r["id"] for r in main.ROLES]
    assert ids == ALL_IDS, "порядок ROLES должен совпадать с ROLE_IDS"
    for r in main.ROLES:
        kind = str(r.get("kind") or "role")
        expected = "specialty" if r["id"] in SPECIALTY_IDS else "role"
        assert kind == expected, f"{r['id']}: kind={kind}, ожидался {expected}"


# ------------------------------------------------------------- данные-рубрики
def test_specialties_shape() -> None:
    assert len(SPECIALTY_IDS) == 21
    for rid in SPECIALTY_IDS:
        role = main.ROLES_BY_ID[rid]
        assert role.get("title"), rid
        assert role.get("description"), rid
        steps = role.get("development_steps") or []
        assert len(steps) >= 5, f"{rid}: шагов {len(steps)} < 5"
        skills = role.get("skills_required") or []
        assert len(skills) >= 4, f"{rid}: навыков {len(skills)} < 4"
        resources = role.get("resources") or []
        assert resources, f"{rid}: нет ресурсов"
        for res in resources:
            assert str(res.get("url", "")).startswith("https://"), rid


def test_specialties_no_employment_lexicon() -> None:
    for rid in ALL_IDS:
        role = main.ROLES_BY_ID[rid]
        blob = " ".join(
            [
                str(role.get("description", "")),
                *[str(s) for s in role.get("development_steps") or []],
            ]
        ).lower()
        for w in FORBIDDEN:
            assert w not in blob, f"{rid}: запрещённая лексика «{w}»"


def test_all_required_skills_live_in_catalog() -> None:
    catalog = yaml.safe_load((ROLES_DIR / "skills.yaml").read_text())["skills"]
    missing: dict[str, str] = {}
    for rid in ALL_IDS:
        for req in main.ROLES_BY_ID[rid].get("skills_required") or []:
            sid = str(req.get("id", ""))
            if sid not in catalog:
                missing[sid] = rid
    assert not missing, f"навыки вне словаря: {missing}"


def test_skill_synonyms_are_unique() -> None:
    """scoring.load_synonyms теряет коллизии молча (setdefault) — гейт ловит."""
    catalog = yaml.safe_load((ROLES_DIR / "skills.yaml").read_text())["skills"]
    seen: dict[str, str] = {}
    dups: dict[str, list[str]] = {}
    for cid, meta in catalog.items():
        forms = [str(cid), str(meta.get("name", ""))]
        forms += [str(s) for s in meta.get("synonyms") or []]
        for form in forms:
            key = form.strip().lower().replace("ё", "е")
            if key in seen and seen[key] != cid:
                dups.setdefault(key, [seen[key]]).append(str(cid))
            seen[key] = cid
    assert not dups, f"синонимы-коллизии: {dups}"


# ------------------------------------------------------------------- /plan
def test_plan_works_for_every_specialty() -> None:
    for rid in SPECIALTY_IDS:
        r = client.post("/plan", json={"role_id": rid, "profile": PROFILE})
        assert r.status_code == 200, f"{rid}: {r.status_code} {r.text[:120]}"
        body = r.json()
        assert [w["n"] for w in body["weeks"]] == [1, 2, 3, 4]
        assert body["title"], rid
        checks = body["checks"]
        assert len(checks) >= 2, f"{rid}: нет самопроверки"
        choice = next(c for c in checks if c["kind"] == "choice")
        assert len(choice["options"]) >= 3
        assert choice["options"][choice["correct"]] == str(
            main.ROLES_BY_ID[rid]["description"]
        )


def test_plan_choice_distractors_from_same_kind() -> None:
    """Дистракторы специальности — описания других специальностей (не ролей)."""
    descriptions = {rid: str(main.ROLES_BY_ID[rid]["description"]) for rid in ALL_IDS}
    for rid in ("nursing", "trade", "design"):
        body = client.post("/plan", json={"role_id": rid, "profile": PROFILE}).json()
        choice = next(c for c in body["checks"] if c["kind"] == "choice")
        others = [o for o in choice["options"] if o != descriptions[rid]]
        for option in others:
            src = next(k for k, v in descriptions.items() if v == option)
            assert src in SPECIALTY_IDS, f"{rid}: дистрактор из роли {src}"


# ------------------------------------------------------------------- limit
def test_limit_slices_recommendations() -> None:
    for n in (1, 3, 12):
        r = client.post("/recommend", json={"profile": PROFILE, "limit": n})
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["roles"]) == n
        assert body["roles"] == body["items"]
        scores = [x["score"] for x in body["roles"]]
        assert scores == sorted(scores, reverse=True)
    kinds = {
        x["kind"]
        for x in client.post(
            "/recommend", json={"profile": PROFILE, "limit": 12}
        ).json()["roles"]
    }
    assert kinds <= {"role", "specialty"}


def test_limit_out_of_range_is_422() -> None:
    for bad in (0, 13, -1):
        r = client.post("/recommend", json={"profile": PROFILE, "limit": bad})
        assert r.status_code == 422, f"limit={bad}"
        assert "error" in r.json()


def test_limit_is_part_of_cache_key() -> None:
    a = client.post(
        "/recommend",
        json={"profile": dict(PROFILE, skills=["python", "git"]), "limit": 3},
    )
    b = client.post(
        "/recommend",
        json={"profile": dict(PROFILE, skills=["python", "git"]), "limit": 5},
    )
    assert a.json()["cached"] is False and b.json()["cached"] is False
    a2 = client.post(
        "/recommend",
        json={"profile": dict(PROFILE, skills=["python", "git"]), "limit": 3},
    )
    assert a2.json()["cached"] is True and len(a2.json()["roles"]) == 3


def test_empty_profile_fallback_respects_limit() -> None:
    r = client.post(
        "/recommend",
        json={"profile": {"skills": [], "interests": [], "subjects": []}, "limit": 4},
    )
    assert r.status_code == 400
    assert len(r.json()["fallback"]) == 4
    for item in r.json()["fallback"]:
        assert item["kind"] in ("role", "specialty")
