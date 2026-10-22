"""v31: персонажа в продукте нет — визуальный центр на монограмме.

Запрос пользователя: «убери лису совсем. сделай ещё лучше, в первую очередь
учитывая эстетический характер».

Что закрывает этот гейт:
  1) персонажа нет ни в разметке, ни в стилях, ни в ассетах, ни в текстах;
  2) вместо него — новая композиция интро (гем «СИ» в ореоле, вордмарк,
     короткое обещание, шкала сцены) и карточка «маршрут» в герое;
  3) бюджет @keyframes не превышен (≤ 30) и ни один ключ не мёртвый;
  4) в интро и в герое нет растровых картинок — только CSS-графика и текст.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps/web"
CSS = (WEB / "styles/globals.css").read_text(encoding="utf-8")
SCENE = (WEB / "components/IntroScene.tsx").read_text(encoding="utf-8")
INDEX = (WEB / "pages/index.tsx").read_text(encoding="utf-8")
CONSULTANT = (WEB / "pages/consultant.tsx").read_text(encoding="utf-8")
SCRIPTS = (WEB / "lib/consultantScripts.ts").read_text(encoding="utf-8")
CRITICAL = (WEB / "lib/criticalCss.ts").read_text(encoding="utf-8")
PUBLIC = WEB / "public"

#: файлы приложения, в которых не должно остаться персонажа
SOURCE_FILES = [
    WEB / "components/IntroScene.tsx",
    WEB / "pages/index.tsx",
    WEB / "pages/consultant.tsx",
    WEB / "pages/employer.tsx",
    WEB / "pages/result.tsx",
    WEB / "pages/plan.tsx",
    WEB / "lib/consultantScripts.ts",
    WEB / "lib/criticalCss.ts",
    WEB / "styles/globals.css",
]

#: слова, по которым ищем персонажа (латиница + кириллица)
FORBIDDEN = re.compile(
    r"fox|mascot|foxMini|талисман|\bлис\b|\bлиса\b|\bлису\b|\bлисом\b|\bлисе\b",
    re.IGNORECASE,
)


def test_no_mascot_in_sources():
    for path in SOURCE_FILES:
        text = path.read_text(encoding="utf-8")
        hit = FORBIDDEN.search(text)
        assert not hit, f"в {path.name} осталось упоминание персонажа: {hit.group(0)!r}"


def test_no_mascot_assets():
    leftovers = [p.name for p in PUBLIC.iterdir() if FORBIDDEN.search(p.name)]
    assert not leftovers, f"остались ассеты персонажа: {leftovers}"
    # растров в public остаётся только шум-тайл и шрифты
    assert sorted(p.name for p in PUBLIC.iterdir()) == [
        "fonts",
        "noise-64.png",
    ]


def test_intro_composition_replaced_mascot():
    """Новая композиция интро: гем в ореоле, вордмарк, обещание, шкала."""
    for cls in ("intro-badge", "intro-wordmark", "intro-rail", "intro-mark"):
        assert cls in SCENE, f"в сцене нет {cls}"
        assert cls in CSS, f"в стилях нет {cls}"
    assert "СИ" in SCENE, "нет монограммы проекта"
    assert "SUPERNOVA" in SCENE, "нет вордмарка"
    assert "Карьерный трекер СИУЭиП" in SCENE, "нет названия продукта в подписи"
    # сцена остаётся декоративной (aria-hidden) и не грузит ничего
    assert 'aria-hidden="true"' in SCENE
    assert "<img" not in SCENE
    assert "preload" not in SCENE, "прелоад картинки больше не нужен"


def test_intro_visual_rules_present():
    """Ореол, шкала и блик описаны в стилях — сцена не «пустая»."""
    for rule in (
        ".intro-badge::before",
        ".intro-badge::after",
        ".intro-rail__fill",
        ".intro-wordmark",
        "@keyframes markIn",
        "@keyframes introRail",
        "@keyframes auroraDrift",
    ):
        assert rule in CSS, f"нет правила {rule}"
    # шкала заполняется только transform (никакого paint в keyframes)
    body = CSS[CSS.index("@keyframes introRail {") :]
    body = body[: body.index("}")]
    assert "scaleX" in body
    assert "width" not in body and "left" not in body


def test_route_card_replaces_mascot_in_hero():
    assert 'className="route-card"' in INDEX
    assert INDEX.count('className="route__step"') == 3, "в маршруте должно быть 3 шага"
    assert ".route-card {" in CSS
    assert ".route__num {" in CSS
    # в правой колонке героя больше нет картинок
    hero = INDEX[INDEX.index('className="hero-side"') : INDEX.index("</aside>")]
    assert "<img" not in hero
    assert "<picture" not in hero
    # и в аварийном (критическом) CSS маршрут есть, персонажа нет
    assert ".route-card{" in CRITICAL


def test_consultant_avatar_is_monogram():
    assert 'className="bot-avatar"' in CONSULTANT
    assert ".bot-avatar {" in CSS
    assert "Помощник" in SCRIPTS, "в скриптах помощник должен называться помощником"


def test_keyframes_budget_and_no_dead_keys():
    names = re.findall(r"(?m)^@keyframes\s+([A-Za-z0-9-]+)", CSS)
    assert len(names) <= 30, f"перебор @keyframes: {len(names)}"
    assert len(names) == len(set(names)), "имена keyframes повторяются"
    for name in names:
        used = re.search(r"animation[^;{}]*\b" + re.escape(name) + r"\b", CSS)
        assert used, f"@keyframes {name} не используется — мёртвый код"


def test_no_raster_in_intro_or_hero():
    assert not (PUBLIC / "fox-cutout.png").exists()
    assert not (PUBLIC / "fox-cutout.webp").exists()
    assert not (PUBLIC / "fox-fur-128.png").exists()
    # герой и интро — только текст и CSS
    assert "<picture" not in INDEX[: INDEX.index("</aside>")]
