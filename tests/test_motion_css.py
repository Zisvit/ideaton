"""Гейты моушна v5 (совет: только transform/opacity, бюджет keyframes ≤ 30).

Читайте исходники веба, а не билд: тест ловит регрессии на уровне исходного
CSS — собранный бандл проверяется отдельно (npm build + grep-сигнатуры).
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = (ROOT / "apps/web/styles/globals.css").read_text(encoding="utf-8")
INTRO = (ROOT / "apps/web/lib/intro.ts").read_text(encoding="utf-8")
FOX = (ROOT / "apps/web/components/IntroScene.tsx").read_text(encoding="utf-8")


def keyframe_bodies():
    """[(имя, тело)] — парсер по балансу скобок (mimo/glm, раунд 2)."""
    out = []
    for m in re.finditer(r"@keyframes\s+([A-Za-z0-9-]+)", CSS):
        i = CSS.index("{", m.end())
        depth = 0
        j = i
        while j < len(CSS):
            if CSS[j] == "{":
                depth += 1
            elif CSS[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        out.append((m.group(1), CSS[i + 1 : j]))
    return out


def test_keyframes_budget():
    names = [n for n, _ in keyframe_bodies()]
    assert len(names) <= 30, f"перебор @keyframes: {len(names)} {names}"


def test_required_and_legacy_keyframes():
    required = {
        "fixDrift5",
        "dotDrift",
        "bgShape",
        "foxRun",
        "foxBob",
        "foxLand",
        "headBob",
        "headScan",
        "legStride",
        "shinBend",
        "toeLift",
        "tailWave",
        "tailIdle",
        "earFlick",
        "breath",
        "blink",
        "dust",
        "whiskTw",
        "markReact",
        "markSweep",
        "introVeil",
        "introIn",
        "mPop",
        "mSweep",
        "mGrowX",
        "shimmer",
        "fadeIn",
        "bounce",
        "confetti-fall",
    }
    names = {n for n, _ in keyframe_bodies()}
    missing = required - names
    assert not missing, f"нет обязательных keyframes: {missing}"
    # легаси v4-лисицы удалены полностью (совет: без хвостов, super-vl)
    dead = ("legPhaseA", "legPhaseB", "shapeA", "shapeB", "shapeC")
    leftover = [n for n in names if n in dead or re.fullmatch(r"fixDrift", n)]
    assert not leftover, f"легаси-ключи остались: {leftover}"


def test_no_paint_or_layout_properties_in_keyframes():
    forbidden = (
        r"\b(width|height|top|left|right|bottom|margin\w*|padding\w*|"
        r"font-size|letter-spacing|background-position|box-shadow|filter|"
        r"stroke-width)\s*:"
    )
    bad = re.compile(forbidden)
    hits = []
    for name, body in keyframe_bodies():
        for m in bad.finditer(body):
            hits.append((name, m.group(0)))
    assert not hits, f"paint/layout в @keyframes (v5-контракт): {hits}"


def test_intro_scale_is_4200_and_v2_key():
    assert "INTRO_MS = 4200" in INTRO
    assert "career-tracker-intro:v2" in INTRO
    # единая шкала: сцена и знак живут от --tl
    assert "animation: introVeil var(--tl) linear 1 both" in CSS
    assert "animation: markReact var(--tl) linear 1 both" in CSS


def test_fox_classes_are_wired_between_tsx_and_css():
    for cls in (
        "fox-bob",
        "fox-tail-a",
        "fox-tail-b",
        "fx-tail-idle-a",
        "fx-tail-idle-b",
        "fx-leg-fh",
        "fx-leg-ff",
        "fx-thigh-nh",
        "fx-thigh-nf",
        "fx-shin-nh",
        "fx-shin-nf",
        "fx-paw-nh",
        "fx-paw-nf",
        "fx-head",
        "fx-eye",
        "fx-whiskers",
        "fx-ear",
        "fx-ear-far",
        "fox-chest",
        "fx-dust",
    ):
        assert cls in FOX, f"класс {cls} отсутствует в Fox SVG"
        assert cls in CSS, f"класс {cls} отсутствует в стилях сцены"


def test_print_is_static():
    # зачёркивание на бумаге статично; сцены и микро-блик скрыты (big-pickle K4)
    # v6: блоков print в файле теперь два (v1 + хвост v6) — собираем ВСЕ,
    # чтобы «последний блок» не ломал контракты (гейт устойчив к хвостовым
    # блокам v6)
    print_block = "\n".join(CSS.split("@media print")[1:])
    assert "text-decoration: line-through !important" in print_block
    assert "week li.done span::after { display: none !important; }" in print_block
    assert "display: none !important; }" in "\n".join(
        CSS.split("@media (prefers-reduced-motion: reduce)")[1:]
    )


def test_dust_stagger_is_css_side_and_origin_is_fill_box():
    """Пыль приземления: стаггер d2/d3 живёт в CSS, не в inline-style (space-bunny).

    Механика бага: inline `animationDelay` в JSX перебивает только longhand
    delay шортката `animation: ... 1740ms 1 ...` — кружки срабатывают на
    40/70мс вместо 1740+40/1810. Правильная схема: классы .d2/.d3 в CSS с
    абсолютными delay 1780/1810мс; fill-mode forwards (не both: backwards-fill
    виден в 1740мс бега); transform-box fill-box (иначе origin = центр
    viewBox и пыль растёт из брюха, ниже земли).
    """
    assert ".is-run .fx-dust.d2" in CSS and ".is-run .fx-dust.d3" in CSS
    assert "1780ms" in CSS and "1810ms" in CSS
    # inline-диспетчеризация в TSX не вернулась (слово в комментарии ок)
    assert "style={{ animationDelay" not in FOX, (
        "inline animationDelay перебивает delay 1740ms из CSS-шортката"
    )
    # forwards, не both: backwards-fill держит 0%-кадр (opacity .45) в беге
    assert re.search(r"\.is-run \.fx-dust \{[^}]*forwards", CSS), (
        "анимация dust должна быть forwards (both показывает 0%-кадр до задержки)"
    )
    # fill-box у пыли: origin круга, не центр viewBox
    assert re.search(r"\.intro-fox \.fx-dust \{[^}]*transform-box:\s*fill-box", CSS), (
        "у .fx-dust обязан быть transform-box: fill-box (origin = центр круга)"
    )
