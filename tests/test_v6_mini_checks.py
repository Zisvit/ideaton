"""Гейты v6: мини-проверки пунктов плана (совет: mimo/deepseek/space-bunny).

Контракты (совет v6, раунд 2):
  - no-score: без счёта и красного; повтор безлимитный;
  - v6: мини-проверка не двигала done («понял» ≠ «сделал»); v13 (совет 7/9):
    пройденная проверка — ворота done (no-signal-пункты — как раньше),
    хранилище отдельное career-tracker-mini:v1:{role} (versioned, deepseek);
  - генерация на фронте по префиксам; навык вне глоссария → теста нет
    (нет кнопки — нет обещания);
  - accordion: раскрыта ровно одна; grid-template-rows transition —
    единственное layout-исключение волны.
Статические сканы исходников (как test_motion_css): читаем TS/TSX, не бандл.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _strip_comments(text: str) -> str:
    """Комментарии вне скана: гейт смотрит на код, а не на прозу («без
    красного» в документации — честная норма, не утечка лексикона)."""
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    text = re.sub(r"^\s*//.*$", "", text, flags=re.M)
    return text


CHECKS = _strip_comments(
    (ROOT / "apps/web/lib/planChecks.ts").read_text(encoding="utf-8")
)
PLAN = _strip_comments((ROOT / "apps/web/pages/plan.tsx").read_text(encoding="utf-8"))
API = _strip_comments((ROOT / "apps/web/lib/api.ts").read_text(encoding="utf-8"))
CSS = _strip_comments(
    (ROOT / "apps/web/styles/globals.css").read_text(encoding="utf-8")
)

NO_SCORE_LEXICON = (
    # красный цвет / экзамен / счёт попыток в КОДЕ генератора — запрещены
    "красн",
    "exam",
    "попытка",
)


def test_mini_kinds_and_generator_rules():
    for kind in ("'choice'", "'self'", "'do'"):
        assert kind in CHECKS, f"нет типа {kind}"
    # правила префиксов: gap → choice «зачем навык», «Собрать проект» → do
    assert "Закрыть\\s+пробел" in CHECKS
    assert "Собрать\\s+проект" in CHECKS
    # навык не найден → НЕТ теста (но-сигнал: одна явная точка возврата)
    assert "return null" in CHECKS


def test_mini_no_score_no_red_lexicon():
    for w in NO_SCORE_LEXICON:
        assert w not in CHECKS.lower(), f"запрещённое слово в planChecks: {w}"


def test_mini_storage_separate_from_done_and_versioned():
    assert "career-tracker-mini:v1" in API
    assert "function getMini" in API and "function saveMini" in API
    # в plan.tsx нет прямого письма в localStorage — только через lib/api
    assert "localStorage.setItem" not in PLAN


def test_mini_stores_only_booleans():
    # попытки/счётчики не хранятся: в хранилищах допустимы только
    # boolean (карты done/checks/mini), unknown (каст парса) и string
    # (headers конфига) — остальное (числа попыток, статус-литералы) под запретом
    maps = re.findall(r"Record<string, ([A-Za-z]+)>", API)
    assert maps, "нет хранилищ-карт"
    allowed = {"boolean", "unknown", "string"}
    exotic = [t for t in maps if t not in allowed]
    assert not exotic, f"посторонние значения хранилищ: {exotic}"
    assert maps.count("boolean") >= 6


def test_plan_wires_mini_rows_and_accordion():
    assert "function MiniRow" in PLAN
    assert "cur === key ? null : key" in PLAN
    assert "settleMini" in PLAN
    # done-галочка на своей кнопке; ворота проверки — v13 (tests/test_v13_gates.py)
    assert "onClick={() => toggle(key)}" in PLAN
    # чип-строка прячется на печати (v1-правило .plan-print-hide)
    assert "mini-row plan-print-hide" in PLAN


def test_grid_rows_single_layout_exception():
    # grid-template-rows: РОВНО одна transition-строка (тело мини-карточки) —
    # layout-исключение волны не должно размножаться по стилям
    transitions = re.findall(r"transition:\s*grid-template-rows[^;]*;", CSS)
    assert len(transitions) == 1, f"grid-rows переходов: {transitions}"
