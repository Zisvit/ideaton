"""v29: /consultant и /employer в той же дизайн-системе, что главная.

Что фиксируем:
1) /employer: герой в две колонки с витриной учебной базы, ПОИСК по навыкам
   (67 чипов одним списком не прочитать) и счётчик в шапке блока фильтров;
2) /consultant: герой в две колонки с карточкой «три шага», разговор — «колодец»
   внутри карточки, реплика консультанта — светлая плоскость (чёрный блок в
   светлой карточке выглядел чужеродно), лис-мини в аватаре-круге;
3) реплика пользователя и бота различаются по тону, оба — с хайрлайном.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps/web"
CSS = (WEB / "styles/globals.css").read_text(encoding="utf-8")
EMPLOYER = (WEB / "pages/employer.tsx").read_text(encoding="utf-8")
CONSULTANT = (WEB / "pages/consultant.tsx").read_text(encoding="utf-8")


def test_employer_has_search_and_stats():
    assert 'className="employer-search"' in EMPLOYER
    assert "visibleSkills.map" in EMPLOYER, "чипы не фильтруются поиском"
    assert "query.trim().toLowerCase()" in EMPLOYER
    assert 'type="search"' in EMPLOYER
    assert "Поиск навыка" in EMPLOYER
    # витрина в герое — реальные числа из учебной базы
    assert "SKILL_OPTIONS.length} навыков" in EMPLOYER
    assert "orgCount} организаций" in EMPLOYER
    assert "SPECS.length} направлений" in EMPLOYER


def test_consultant_hero_and_chat():
    assert 'className="hero-grid' in CONSULTANT
    assert 'className="preview-card"' in CONSULTANT
    assert "Три шага до плана" in CONSULTANT
    # контракт v6: лис-мини и бейдж скриптового режима на месте
    assert 'className="foxMini"' in CONSULTANT
    assert "badge--script" in CONSULTANT


def test_chat_is_plane_not_black_block():
    assert ".chatLine__bubble--bot {" in CSS
    block = CSS[CSS.index(".chatLine__bubble--bot {") :]
    block = block[: block.index("}")]
    assert "var(--surface)" in block, "реплика консультанта должна быть светлой плоскостью"
    assert "var(--bubble-bg)" not in block, "чёрный блок в светлой карточке убран"
    # лента разговора — «колодец» с рамкой
    log = CSS[CSS.index(".chatBot__log {") :]
    log = log[: log.index("}")]
    assert "var(--surface-2)" in log and "border:" in log
    # лис-мини — круглый аватар
    fox = CSS[CSS.index(".foxMini {") :]
    fox = fox[: fox.index("}")]
    assert "border-radius: 50%" in fox


def test_hero_blocks_shared_across_pages():
    """Герой на всех страницах — одна и та же система, а не «сшитые» куски."""
    for page in (EMPLOYER, CONSULTANT):
        assert 'className="hero-grid' in page
        assert 'className="supernova"' in page
    for cls in (".hero-grid", ".hero-side", ".preview-card", ".preview-row"):
        assert cls in CSS, f"нет общего блока {cls}"
