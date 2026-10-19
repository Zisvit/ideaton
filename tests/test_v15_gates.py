"""Гейты волны v15 (совет 7/9): направления сгруппированы по сферам.

Волна v15:
  1) SPEC_GROUPS в scripts/gen_web_data.py — единственный источник правды:
     6 групп, порядок фиксирован, покрытие 21/21 ровно один раз (fail-fast);
  2) specialties.json получает производные поля group_id/group_title/
     group_hint/group_order (после title; порядок карточек по id не менялся);
  3) обе витрины (главная и /employer) рендерят секции общим DirectionGroups;
     пустые группы не показываются, «Найдено N из 21» на /employer сохранён;
  4) бюджеты v12/v13 не тронуты: ни новых @keyframes, ни @media print.

Статические сканы исходников (как test_v13_gates): читаем TS/TSX/JSON.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"

SPEC_RAW = (WEB / "lib" / "specialties.json").read_text(encoding="utf-8")
SPEC = json.loads(SPEC_RAW)
DATA = json.loads((WEB / "lib" / "offlineData.json").read_text(encoding="utf-8"))


def _strip_comments(text: str) -> str:
    """Комментарии вне скана: гейт смотрит на код, а не на прозу."""
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    text = re.sub(r"^\s*//.*$", "", text, flags=re.M)
    return text


INDEX = _strip_comments((WEB / "pages" / "index.tsx").read_text(encoding="utf-8"))
EMPLOYER = _strip_comments((WEB / "pages" / "employer.tsx").read_text(encoding="utf-8"))
GROUPS = _strip_comments(
    (WEB / "components" / "DirectionGroups.tsx").read_text(encoding="utf-8")
)
CSS = _strip_comments((WEB / "styles" / "globals.css").read_text(encoding="utf-8"))

SPEC_IDS = [r["id"] for r in DATA["roles"] if r.get("kind") == "specialty"]


def _gen():
    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        import gen_web_data  # noqa: PLC0415 — модуль лежит в scripts/

        return gen_web_data
    finally:
        sys.path.pop(0)


def test_spec_groups_cover_all_college_specialties_once():
    gen = _gen()
    assert len(gen.SPEC_GROUPS) == 6
    covered: list[str] = []
    for slug, title, hint, ids in gen.SPEC_GROUPS:
        assert slug and title and hint and ids, slug
        covered += ids
    assert sorted(covered) == sorted(SPEC_IDS)
    assert len(covered) == len(set(covered)) == 21


def test_specialties_json_group_fields_lockstep_with_table():
    gen = _gen()
    table = {slug: ids for slug, _t, _h, ids in gen.SPEC_GROUPS}
    by_group: dict[str, list[str]] = {}
    for item in SPEC:
        for key in ("group_id", "group_title", "group_hint"):
            assert isinstance(item[key], str) and item[key].strip(), (
                item["id"],
                key,
            )
        assert 1 <= int(item["group_order"]) <= 6, item["id"]
        by_group.setdefault(item["group_id"], []).append(item["id"])
    assert len(by_group) == 6
    covered = [sid for ids in by_group.values() for sid in ids]
    assert sorted(covered) == sorted(SPEC_IDS)  # ровно один раз, без потерь
    for gid, ids in by_group.items():
        assert sorted(table[gid]) == sorted(ids), gid
        titles = {i["group_title"] for i in SPEC if i["group_id"] == gid}
        assert len(titles) == 1, gid


def test_both_showcases_render_group_sections():
    assert "DirectionGroups" in INDEX and "specs={SPECS}" in INDEX
    assert "DirectionGroups" in EMPLOYER and "specs={filtered}" in EMPLOYER
    # пустые группы не рендерятся: секции собираются по фактическим карточкам
    assert "for (const spec of specs)" in GROUPS
    assert "group_order" in GROUPS
    # счётчик «Найдено N из 21» и ветка пустого результата не тронуты
    assert "aria-live" in EMPLOYER
    assert "filtered.length === 0" in EMPLOYER
    assert "Ничего не найдено" in EMPLOYER


def test_group_component_is_offline_guest_safe():
    assert "DirectionCard" in GROUPS
    for banned in (
        "Math.random",
        "offlineData",
        "localEngine",
        "localStorage",
        "fetch(",
    ):
        assert banned not in GROUPS, banned


def test_budgets_untouched_and_generator_fail_fast():
    # печатный сброс v12 остаётся последним блоком: новых @media print нет
    assert CSS.count("@media print") == 3
    # бюджет @keyframes не тронут (30)
    names = re.findall(r"@keyframes\s+[A-Za-z0-9_-]+", CSS)
    assert len(names) == 30, names
    src = (ROOT / "scripts" / "gen_web_data.py").read_text(encoding="utf-8")
    assert "SPEC_GROUPS" in src
    assert "группы не покрывают специальности" in src
    assert '"group_id"' in src and '"group_order"' in src
