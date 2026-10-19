"""Гейты v13 (совет 7/9): витрина 21 направления, obsidian-карта, ворота
проверки и многоэтапные мини-тесты.

Волна v13:
  1) все специальности колледжа на главной (лёгкий specialties.json,
     статический импорт; чанк движка v11 не тронут);
  2) «Карта тем» — ближе к Obsidian: тёмный холст, точки по degree,
     кривые рёбра, подсветка соседей, детерминизм без Math.random;
  3) «изучено» — только после пройденной проверки (ворота done);
  4) проверки многоэтапные: цепочка этапов 2–3 при эфемерном прогрессе.

Статические сканы исходников (как test_v6_mini_checks): читаем TS/TSX/JSON.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"


def _strip_comments(text: str) -> str:
    """Комментарии вне скана: гейт смотрит на код, а не на прозу."""
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    text = re.sub(r"^\s*//.*$", "", text, flags=re.M)
    return text


SPEC_RAW = (WEB / "lib" / "specialties.json").read_text(encoding="utf-8")
SPEC = json.loads(SPEC_RAW)
DATA = json.loads((WEB / "lib" / "offlineData.json").read_text(encoding="utf-8"))
INDEX = _strip_comments((WEB / "pages" / "index.tsx").read_text(encoding="utf-8"))
CARD = _strip_comments(
    (WEB / "components" / "DirectionCard.tsx").read_text(encoding="utf-8")
)
PLAN = _strip_comments((WEB / "pages" / "plan.tsx").read_text(encoding="utf-8"))
CHECKS = _strip_comments((WEB / "lib" / "planChecks.ts").read_text(encoding="utf-8"))
GRAPH = _strip_comments((WEB / "lib" / "topicGraph.ts").read_text(encoding="utf-8"))
MAP = _strip_comments((WEB / "components" / "TopicMap.tsx").read_text(encoding="utf-8"))
CSS = _strip_comments((WEB / "styles" / "globals.css").read_text(encoding="utf-8"))


def test_specialties_regenerate_byte_for_byte():
    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        import gen_web_data  # noqa: PLC0415 — модуль лежит в scripts/

        assert gen_web_data.render_specialties() == SPEC_RAW
    finally:
        sys.path.pop(0)


def test_specialties_cover_all_college_directions():
    expected = [r["id"] for r in DATA["roles"] if r.get("kind") == "specialty"]
    assert len(expected) == 21
    assert [item["id"] for item in SPEC] == expected
    names = set(DATA["skill_names"].values())
    for item in SPEC:
        assert item["title"].strip(), item["id"]
        assert item["description"].strip(), item["id"]
        assert len(item["skills"]) >= 3, item["id"]
        for skill in item["skills"]:
            assert skill["name"] in names, (item["id"], skill["id"])


def test_index_showcase_is_static_and_lightweight():
    assert "import specialties from '../lib/specialties.json'" in INDEX
    # v15: витрина рендерится секциями-группами (общий DirectionGroups),
    # подписи и порядок групп приходят из данных specialties.json
    assert "DirectionGroups" in INDEX
    assert "specs={SPECS}" in INDEX
    # v14: разметка карточки переехала в общий DirectionCard (её же получает
    # /employer), поэтому spec-item/spec-skill сканируются в CARD
    assert "spec-item" in CARD and "spec-skill" in CARD
    # чанк движка не тронут: ни на главной, ни в карточке нет offlineData/localEngine
    for src in (INDEX, CARD):
        assert "offlineData" not in src
        assert "localEngine" not in src


def test_done_requires_passed_check():
    assert "const canMarkDone" in PLAN
    assert "const isDone" in PLAN
    assert "aria-pressed={isDone(key)}" in PLAN
    assert "isDone(key) ? 'done is-done'" in PLAN
    assert "is-locked" in PLAN
    assert "Сначала пройдите проверку" in PLAN


def test_mini_checks_are_multistage():
    assert "MiniStep" in CHECKS
    assert "moreChoice" in CHECKS and "moreSelf" in CHECKS
    # цепочки собираются и в «первом» узле (gap/meet), и в «more» (остальные)
    assert "first.more = chain(" in CHECKS
    assert "more: chain(" in CHECKS
    # план рендерит этапы: счётчик «Шаг N из M» и эфемерный stage (useState)
    assert "const [stage, setStage] = React.useState(0)" in PLAN
    assert "из {chain.length}" in PLAN


def test_map_is_obsidian_like_and_deterministic():
    # детерминизм: никакого Math.random ни в графе, ни в компоненте
    assert "Math.random" not in GRAPH
    assert "Math.random" not in MAP
    # джиттер и degree — фирменные детали v13
    assert "jitter" in GRAPH and "degree" in GRAPH
    assert "fromKey" in GRAPH and "toKey" in GRAPH
    # подсветка соседей и кривые рёбра в компоненте
    assert "is-hot" in MAP and "is-dim" in MAP
    assert "Q " in MAP  # квадратичная кривая ребра (path d="M … Q …")
    # тёмный холст в обеих темах — на существующих hero-токенах
    assert "linear-gradient(135deg, var(--hero-a) 0%, var(--hero-b) 100%)" in CSS
    # подписи — только hover/selected: текст скрыт по умолчанию
    assert ".topic-node__text" in CSS


def test_v13_kept_print_and_keyframe_budgets():
    # новых @media print нет: печатный сброс v12 остаётся последним блоком
    assert CSS.count("@media print") == 3
    # бюджет @keyframes не тронут (30) — карта живёт на transitions
    names = re.findall(r"@keyframes\s+[A-Za-z0-9_-]+", CSS)
    assert len(names) == 30, names
