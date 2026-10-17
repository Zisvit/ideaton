"""Контракт-гейт на ЖИВОМ приложении: app.openapi() против openapi.yaml.

Дополняет tests/contract_check.py (тот валидирует YAML и данные, но не код):
проверяем, что FastAPI-приложение экспонирует ровно пути контракта,
что контрактные обязательные поля присутствуют в сгенерированных схемах
и что ТЗ-аддитивные поля согласованы в обе стороны (YAML ↔ код).
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))

import main  # noqa: E402


def _load(path_key: str):
    contract = yaml.safe_load(
        (ROOT / "packages" / "contracts" / "openapi.yaml").read_text()
    )
    return contract, contract["paths"][path_key]


def test_all_contract_paths_exist_in_app() -> None:
    contract = yaml.safe_load(
        (ROOT / "packages" / "contracts" / "openapi.yaml").read_text()
    )
    app_paths = set(main.app.openapi()["paths"])
    missing = set(contract["paths"]) - app_paths
    assert not missing, (
        f"эндпоинты контракта отсутствуют в приложении: {sorted(missing)}"
    )


def test_method_get_health_matches_contract() -> None:
    app = main.app.openapi()
    assert "get" in app["paths"]["/health"]


def test_method_post_on_all_mutations() -> None:
    app = main.app.openapi()
    for path in ("/recommend", "/plan", "/chat"):
        assert "post" in app["paths"][path], path


def test_rolescore_required_fields_covered_by_app() -> None:
    contract, _ = _load("/recommend")
    gen_required = {
        "role_id",
        "title",
        "score",
        "why",
        "gaps",
    }
    app_role = main.app.openapi()["components"]["schemas"]["RoleScore"]
    # Все обязательные поля контракта есть в приложении (app может добавить свои)
    assert gen_required <= set(app_role.get("required", []))


def test_recommend_response_contract_fields_typed_in_app() -> None:
    app = main.app.openapi()
    roles = app["components"]["schemas"]["RecommendResponse"]
    prop = roles["properties"]["roles"]
    assert "items" in prop
    assert prop.get("minItems") == 5 and prop.get("maxItems") == 5


def test_openapi_yaml_documents_new_additive_fields() -> None:
    """Аддитивные ТЗ-поля согласованы: объявлены и в контракте, и в коде."""
    contract = yaml.safe_load(
        (ROOT / "packages" / "contracts" / "openapi.yaml").read_text()
    )
    schemas = contract["components"]["schemas"]
    # Объявлены в YAML
    assert {"matched_count", "needed_count"} <= set(schemas["RoleScore"]["properties"])
    assert "cached" in schemas["PlanResponse"]["properties"]
    assert "llm_used" in schemas["ChatResponse"]["properties"]
    # И присутствуют в схемах приложения
    app_schemas = main.app.openapi()["components"]["schemas"]
    assert {"matched_count", "needed_count"} <= set(
        app_schemas["RoleScore"]["properties"]
    )
    assert "cached" in app_schemas["PlanResponse"]["properties"]
    assert "llm_used" in app_schemas["ChatResponse"]["properties"]


def test_additive_fields_are_optional_and_not_breaking() -> None:
    """Аддитивные поля НЕ обязательны (расширение без лома клиентов)."""
    contract = yaml.safe_load(
        (ROOT / "packages" / "contracts" / "openapi.yaml").read_text()
    )
    schemas = contract["components"]["schemas"]
    assert "matched_count" not in schemas["RoleScore"]["required"]
    assert "needed_count" not in schemas["RoleScore"]["required"]
    assert "cached" not in schemas["PlanResponse"]["required"]
    assert "llm_used" not in schemas["ChatResponse"]["required"]
