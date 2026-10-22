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


def test_intro_does_not_flash_before_run():
    """Совет совета: до .is-run сцена не показывается.

    Иначе контент виден на монте (анимации появления ждут .is-run), потом
    уходит на 0%-кадр markIn/fadeIn и проявляется заново — «дёрнулось»
    вместо «проявилось»."""
    scene = CSS[CSS.index(".intro-scene {") :]
    scene = scene[: scene.index("}")]
    assert "opacity: 0" in scene, "до .is-run сцена должна быть скрыта"
    assert ".is-run .intro-scene { opacity: 1;" in CSS


def test_monogram_contrast_in_light_theme():
    """Первый стоп градиента монограммы был #D9E7FF (1.15:1 на белой плитке)."""
    css = re.sub(r"/\*[\s\S]*?\*/", "", CSS)  # комментарии не считаем
    assert "#D9E7FF" not in css, "в градиенте монограммы остался нечитаемый стоп"
    # вордмарк героя: самый светлый стоп ≥3:1 на бумаге
    assert "--accent-2) 52%" not in css, "в вордмарке остался слишком светлый стоп"
    # градиент монограммы живёт в @supports (background-clip) — ищем сам градиент
    assert (
        "linear-gradient(94deg, var(--brand-blue) 0%, var(--accent-text) 52%, "
        "var(--brand-violet) 100%)" in css
    ), "в градиенте монограммы нет контрастных стопов"


def test_route_card_is_not_hidden_on_mobile():
    """Совет совета: карточка маршрута не должна исчезать на телефоне —
    мобильный герой терял объяснение продукта."""
    assert ".route-card { display: none; }" not in CSS
    mobile = CSS[CSS.index("@media (max-width: 900px)") :]
    assert ".route-card {" in mobile


def test_print_and_forced_colors_cover_new_blocks():
    print_css = CSS[CSS.index("@media print") :]
    assert ".route-card { background: none !important;" in print_css
    assert ".intro-wordmark" in CSS[CSS.index("@media (forced-colors: active)") :]


def test_intro_is_short_and_rail_is_inside_composition():
    """v31: сцена 2400 мс, шкала — элемент композиции, а не полоса браузера."""
    assert "INTRO_MS = 2400" in (WEB / "lib/intro.ts").read_text(encoding="utf-8")
    # шкала внутри сцены: не position:fixed, а элемент композиции
    rail = CSS[CSS.index(".intro-rail {") :]
    rail = rail[: rail.index("}")]
    assert "position: fixed" not in rail, "шкала не должна быть полосой по краю экрана"
    assert "width:" in rail and "margin-top:" in rail
    # разметка: шкала внутри .intro-scene (между открытием сцены и кнопкой скипа)
    scene = SCENE[SCENE.index('className="intro-scene"') :]
    scene = scene[: scene.index('className="intro-skip"')]
    assert "intro-rail" in scene
