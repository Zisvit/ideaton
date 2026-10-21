"""v28: шрифты живут в репозитории (public/fonts), а не на Google Fonts.

Причина: fonts.googleapis.com/gstatic.com в РФ часто недоступны — пользователь
молча получал system-ui вместо фирменных шрифтов. Гейт следит, чтобы:
1) все нужные файлы (кириллица + латиница) лежали в public/fonts, вес разумный;
2) @font-face объявлены с unicode-range и font-display;
3) в исходниках не осталось внешних ссылок на Google Fonts;
4) preload шрифтов с crossOrigin (иначе файл качается дважды);
5) лицензии SIL OFL лежат рядом с файлами.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps/web"
FONTS = WEB / "public/fonts"
CSS = (WEB / "styles/globals.css").read_text(encoding="utf-8")
DOC = (WEB / "pages/_document.tsx").read_text(encoding="utf-8")

EXPECTED = {
    "manrope-cyrillic.woff2",
    "manrope-latin.woff2",
    "unbounded-cyrillic.woff2",
    "unbounded-latin.woff2",
}


def test_font_files_present():
    for name in EXPECTED:
        f = FONTS / name
        assert f.exists(), f"нет файла шрифта {name}"
        assert f.stat().st_size < 60_000, f"{name} слишком тяжёлый: {f.stat().st_size}"
    # кириллица обязательна: без неё весь русский UI падает в fallback
    total = sum((FONTS / n).stat().st_size for n in EXPECTED)
    assert total < 150_000, f"шрифты много весят: {total}"


def test_licenses_shipped():
    assert (FONTS / "OFL.txt").exists(), "нет лицензии Manrope (SIL OFL)"
    assert (FONTS / "OFL-unbounded.txt").exists(), "нет лицензии Unbounded (SIL OFL)"


def test_font_face_declared_with_unicode_range():
    faces = re.findall(r"@font-face \{(.*?)\}", CSS, re.S)
    assert faces, "нет @font-face в globals.css"
    for family in ("Manrope", "Unbounded"):
        blocks = [b for b in faces if f'font-family: "{family}"' in b]
        assert blocks, f"нет @font-face для {family}"
        assert any("unicode-range" in b for b in blocks), f"у {family} нет unicode-range"
        assert any("font-display" in b for b in blocks), f"у {family} нет font-display"
    assert "url(\"/fonts/manrope-cyrillic.woff2\")" in CSS
    assert "url(\"/fonts/unbounded-cyrillic.woff2\")" in CSS


def test_no_external_font_cdn():
    for name in ("_document.tsx",):
        src = (WEB / "pages" / name).read_text(encoding="utf-8")
        assert "fonts.googleapis.com" not in src
        assert "fonts.gstatic.com" not in src
    assert "fonts.googleapis.com" not in CSS


def test_preload_has_crossorigin():
    preloads = re.findall(r"<link\s+rel=\"preload\"[^>]*/>", DOC, re.S)
    fonts = [p for p in preloads if "as=\"font\"" in p]
    assert len(fonts) >= 4, f"шрифты не прелоадятся: {len(fonts)}"
    for p in fonts:
        assert "crossOrigin" in p, "preload шрифта без crossOrigin — скачается дважды"
        assert "/fonts/" in p


def test_fallback_metrics_are_measured():
    """Метрики фолбэков — измерены по woff2 (fontTools), а не взяты на глаз.

    Ошибка в ascent-override на 10% даёт видимый прыжок строк при подмене
    шрифта, поэтому значения запинены: пересчитывать только вместе с новой
    версией шрифтов (и обновлением этого теста)."""
    expected = {
        "Manrope Fallback": ("104.14%", "106.60%", "30.00%", "0%"),
        "Unbounded Fallback": ("109.15%", "112.85%", "26.55%", "0%"),
    }
    for family, (size, asc, desc, gap) in expected.items():
        block = re.search(
            r'@font-face \{[^}]*?font-family: "' + re.escape(family) + r'";(.*?)\}',
            CSS,
            re.S,
        )
        assert block, f"нет фолбэка {family}"
        body = block.group(1)
        assert f"size-adjust: {size}" in body, f"{family}: size-adjust изменился"
        assert f"ascent-override: {asc}" in body, f"{family}: ascent-override изменился"
        assert f"descent-override: {desc}" in body, f"{family}: descent-override изменился"
        assert f"line-gap-override: {gap}" in body, f"{family}: line-gap-override изменился"


def test_font_display_strategy():
    """Обе гарнитуры — на swap: брендовый заголовок появляется всегда.

    Чтобы подмена не двигала макет, ширина заголовка зафиксирована так, что
    Unbounded и метрический фолбэк дают одинаковое число строк (замерено в
    браузере: высота блока совпадает)."""
    for block in re.findall(r"@font-face \{(.*?)\}", CSS, re.S):
        if 'font-family: "Manrope"' in block and "font-style" in block:
            assert "font-display: swap" in block
        if 'font-family: "Unbounded"' in block:
            assert "font-display: swap" in block
    # заголовок резервирует две строки: без резерва подмена шрифта (Unbounded
    # против фолбэка) сдвигала бы блок на 58 px
    assert ".hero-title { min-height: 2.08em; }" in CSS
    assert 'className="hero-title"' in (WEB / "pages/index.tsx").read_text(encoding="utf-8")
