"""Гейты волны v11 (офлайн-режим): читаем исходники, не сборку.

* offlineData.json — валидная форма и детерминированная перегенерация
  байт-в-байт (генератор scripts/gen_web_data.py);
* движок — чистый (без browser-globals), pyRound и точные строки;
* страницы подключают движок ТОЛЬКО динамическим import() (JSON в отдельном
  чанке), 4xx-ветка не фолбэчится;
* контракты v9/v10 не поехали (точечные проверки, не дублирующие их тесты).
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"

DATA = (WEB / "lib/offlineData.json").read_text(encoding="utf-8")
ENGINE = (WEB / "lib/localEngine.ts").read_text(encoding="utf-8")
API = (WEB / "lib/api.ts").read_text(encoding="utf-8")
INDEX = (WEB / "pages/index.tsx").read_text(encoding="utf-8")
RESULT = (WEB / "pages/result.tsx").read_text(encoding="utf-8")
PLAN = (WEB / "pages/plan.tsx").read_text(encoding="utf-8")
CSS = (WEB / "styles/globals.css").read_text(encoding="utf-8")
MAIN = (ROOT / "services" / "api" / "main.py").read_text(encoding="utf-8")


def test_offline_data_shape():
    payload = json.loads(DATA)
    assert payload["schema"] == 1
    assert payload["sourceHash"].startswith("sha256:")
    roles = payload["roles"]
    assert 20 <= len(roles) <= 40
    ids = [r["id"] for r in roles]
    assert ids == sorted(ids)
    for rid in ("web", "qa", "1c", "support", "startup"):
        assert rid in ids
    assert payload["aliases"] and payload["skill_names"]
    assert payload["constants"]["defaultLimit"] == 12
    assert payload["constants"]["gapTaskLimit"] == 3
    role = next(r for r in roles if r["id"] == "web")
    assert role["development_steps"] and role["resources"]


def test_offline_data_regenerates_byte_for_byte():
    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        import gen_web_data  # noqa: PLC0415 — модуль лежит в scripts/

        assert gen_web_data.render() == DATA
    finally:
        sys.path.pop(0)


def test_offline_strings_exact():
    strings = json.loads(DATA)["strings"]
    assert strings["gapHuman"] == "Не хватает навыка: {name}"
    assert strings["checklistDone"] == "Освоен навык «{id}»"
    assert strings["whyMatched"] == "Совпадают навыки: "
    assert strings["whyNoMatch"].startswith("Прямых совпадений")
    assert strings["summaryPersonal"].startswith(" Недели 1–2 начинаются с {n}")
    assert strings["disclaimer"].endswith(
        "не является гарантией трудоустройства или оффера."
    )


def test_empty_profile_error_matches_api():
    assert "Пустой профиль: заполните хотя бы skills, interests или subjects" in MAIN
    assert "Пустой профиль: заполните хотя бы skills, interests или subjects" in ENGINE


def test_engine_is_pure_and_deterministic():
    assert "export function pyRound" in ENGINE
    assert "Math.floor" in ENGINE
    for bad in ("window.", "document.", "localStorage", "fetch(", "navigator."):
        assert bad not in ENGINE
    assert "Math.random" not in ENGINE


def test_engine_only_dynamic_import():
    assert "import raw from './offlineData.json'" in ENGINE
    assert "await import('../lib/localEngine')" in RESULT
    assert "await import('../lib/localEngine')" in PLAN
    # статический импорт утащил бы JSON в общий бандл
    assert "from '../lib/localEngine'" not in RESULT
    assert "from '../lib/localEngine'" not in PLAN


def test_result_offline_wiring():
    assert "recommendLocal" in RESULT
    assert "offline-pill" in RESULT
    assert "Повторить через сервер" in RESULT
    assert "timeout: 8000" in RESULT
    assert "Array.isArray(res.data.roles)" in RESULT
    assert RESULT.count("aria-busy") == 1
    # 4xx не фолбэчим: причины http в списке локального пересчёта нет
    assert "res.reason === 'network'" in RESULT
    assert "res.reason === 'http'" not in RESULT


def test_plan_offline_wiring():
    assert "planLocal" in PLAN
    assert "offline-pill" in PLAN
    assert "timeout: 30000" in PLAN
    assert "Array.isArray(res.data.weeks)" in PLAN
    assert "Array.isArray(res.data.checklist)" in PLAN
    # mini-гейт v6: plan.tsx не пишет в localStorage
    assert "localStorage.setItem" not in PLAN


def test_api_reason_is_machine_readable():
    assert "reason?: 'network' | 'timeout' | 'server' | 'bad-json' | 'http'" in API
    assert "reason: 'bad-json'" in API
    assert "process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'" in API
    assert "error.message" not in API


def test_examples_are_varied():
    assert "pickExample" in API
    assert "pickExample" in INDEX
    assert "Math.random" in API
    assert "lastExample" in API
    names = set(json.loads(DATA)["skill_names"])
    for marker in ("manual_testing", "financial_statements", "patient_care"):
        assert marker in names


def test_offline_css_present():
    assert ".offline-pill" in CSS
    assert ".offline-note" in CSS
