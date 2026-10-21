"""Гейты волны v16: SUPERNOVA-вордмарк на главной (переливание без paint).

Волна v16 (точечная правка UI, совет не запускался):
  1) капсовый «SUPERNOVA» — первый блок hero на главной (выше заголовка);
  2) переливание = два слоя градиента палитры бренда, перетекающие по
     opacity на уже существующем keyframe fadeIn (никаких новых keyframes
     и paint-свойств в анимации); фолбэк без background-clip — акцент;
  3) бюджеты v12/v13 не тронуты: keyframes == 30, @media print == 3.

Статические сканы исходников (как test_v15_gates): читаем TSX/CSS.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
CSS = (WEB / "styles" / "globals.css").read_text(encoding="utf-8")
INDEX = (WEB / "pages" / "index.tsx").read_text(encoding="utf-8")


def _strip_comments(text: str) -> str:
    """Комментарии вне скана: гейт смотрит на код, а не на прозу."""
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    return re.sub(r"^\s*//.*$", "", text, flags=re.M)


def test_wordmark_is_first_block_of_home_hero():
    index = _strip_comments(INDEX)
    # v17c: второй слой — ::after, в DOM только одна надпись
    assert '<p className="supernova">SUPERNOVA</p>' in index
    assert "SUPERNOVA" in index
    assert "supernova__alt" not in index
    # вордмарк стоит до заголовка страницы
    assert index.index('className="supernova"') < index.index("<h1")


def test_wordmark_is_gradient_text_with_solid_fallback():
    css = _strip_comments(CSS)
    assert ".supernova {" in css
    assert ".supernova::after" in css
    assert "var(--brand-violet)" in css
    # тот же приём, что у .grad/.intro-mark: фолбэк-цвет вне @supports
    assert "-webkit-text-fill-color: transparent" in css
    assert "text-transform: uppercase" in css


def test_iridescence_reuses_existing_keyframe():
    css = _strip_comments(CSS)
    # новых keyframes нет: перетекание слоёв — на готовом fadeIn
    assert "animation: fadeIn 2.8s var(--ease) infinite alternate" in css
    # из fadeIn нужен только opacity: vertical-сдвиг снят каскадом
    assert "transform: none !important" in css
    # v17c: второй слой — ::after внутри @supports (там же градиент и fadeIn).
    supernova = css.index(".supernova {")
    supports = css.index("@supports ((-webkit-background-clip: text)", supernova)
    alt = css[css.index(".supernova::after {", supports) :]
    alt = alt[: alt.index("}")]
    for banned in (
        "background-position",
        "filter:",
        "mix-blend-mode",
        "animation-delay",
    ):
        assert banned not in alt, banned


def test_budgets_untouched():
    assert CSS.count("@media print") == 3
    names = re.findall(r"@keyframes\s+[A-Za-z0-9_-]+", CSS)
    assert len(names) == 30, names


def test_wordmark_print_is_legible():
    """Риск v16: background-clip:text + прозрачная заливка на бумаге без
    фоновой графики = пустое место. Печать — сплошной чёрный, второй слой скрыт."""
    css = _strip_comments(CSS)
    first_print = css.split("@media print", 1)[1]
    assert (
        ".supernova { background: none; color: #000; -webkit-text-fill-color: #000; }"
        in first_print
    )
    assert ".supernova::after { display: none; }" in first_print


def test_wordmark_forced_colors_fallback():
    """Риск v16: Windows High Contrast гасит фоновые градиенты — без явного
    системного цвета вордмарк исчезает."""
    css = _strip_comments(CSS)
    fc = re.search(r"@media \(forced-colors: active\) \{([\s\S]*?)\n\}", css)
    assert fc, "нет @media (forced-colors: active)"
    assert "CanvasText" in fc.group(1)
    assert ".supernova::after { display: none; }" in fc.group(1)


def test_wordmark_copy_has_no_duplicate():
    """Риск v16/v17c: второй слой — ::after; в DOM/innerText только одна
    надпись, а user-select:none не даёт выделить псевдотекст."""
    css = _strip_comments(CSS)
    assert ".supernova__alt" not in css
    alt_start = css.index(".supernova::after {")
    alt = css[alt_start : css.index("}", alt_start)]
    assert "user-select: none" in alt
    assert 'content: "SUPERNOVA"' in alt


def test_alt_layer_is_pseudo_inside_background_clip_supports():
    """v17c: второй слой — ::after внутри @supports background-clip. Без
    поддержки clip псевдоэлемент не создаётся — второго текста в потоке нет."""
    css = _strip_comments(CSS)
    supports = css.index(
        "@supports ((-webkit-background-clip: text)", css.index(".supernova {")
    )
    alt = css.index(".supernova::after {", supports)
    assert alt > supports
    block = css[alt : css.index("}", alt)]
    assert "position: absolute" in block
    assert "opacity: 0" in block
    assert "user-select: none" in block


def test_gradient_text_print_and_forced_colors_fallback():
    """v17b (совет): .grad — тот же background-clip:text, что и вордмарк;
    на бумаге/в High Contrast он тоже не должен исчезать. Плюс сцена не
    печатается, если пользователь нажал Print во время интро."""
    css = _strip_comments(CSS)
    first_print = css.split("@media print", 1)[1]
    assert (
        ".grad { background: none; color: #000; -webkit-text-fill-color: #000; }"
        in first_print
    )
    assert ".intro-overlay" in first_print
    fc = re.search(r"@media \(forced-colors: active\) \{([\s\S]*?)\n\}", css)
    assert fc, "нет @media (forced-colors: active)"
    assert ".grad, .intro-mark__glyph" in fc.group(1)
    assert "CanvasText" in fc.group(1)


def test_wordmark_blue_stop_meets_large_text_contrast():
    """v17b (совет): #4E8CFF на светлой --bg давал ~2.9:1. Локальный токен
    #3B7AE8 — 3.7:1 (AA для крупного текста); в тёмной теме — brand-blue."""
    css = _strip_comments(CSS)
    assert "--supernova-blue: #3B7AE8;" in css
    assert "--supernova-blue: var(--brand-blue);" in css
    assert "var(--supernova-blue)" in css
    assert "var(--brand-blue) 28%" not in css  # старый стоп не вернулся
