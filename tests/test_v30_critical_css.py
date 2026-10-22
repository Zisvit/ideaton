"""v30: аварийный «критический» CSS встроен в <head>.

Зачем: стили Next отдаются файлом с хешем в имени; после пересборки вкладка,
открытая ДО сборки, получает 404 и страница выглядит как стена текста.
Встроенный набор правил рисует базовый вид приложения даже без основного CSS.

Гейт проверяет, что: набор не пустой, покрывает базу (палитра, типографика,
сетка героя, карточка, кнопка), подключён в _document и не содержит
запрещённых конструкций (filter/backdrop-filter/mix-blend-mode).
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps/web"
CRITICAL = (WEB / "lib/criticalCss.ts").read_text(encoding="utf-8")
DOC = (WEB / "pages/_document.tsx").read_text(encoding="utf-8")
CSS = (WEB / "styles/globals.css").read_text(encoding="utf-8")


def _css_body() -> str:
    m = re.search(r"export const CRITICAL_CSS = `(.*?)`", CRITICAL, re.S)
    assert m, "нет CRITICAL_CSS"
    return m.group(1)


def test_critical_css_embedded():
    assert "CRITICAL_CSS" in DOC, "критический CSS не подключён в _document"
    assert "dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }}" in DOC
    # должен идти после boot-скрипта темы, иначе первая отрисовка без темы
    assert DOC.index("__html: THEME_BOOT }}") < DOC.index("__html: CRITICAL_CSS }}")


def test_critical_css_covers_base():
    body = _css_body()
    for token in (
        ".intro-overlay{",
        ".intro-mark{",
        ".intro-skip{",
        "--bg",
        "--surface",
        "--ink",
        "--accent",
        'html[data-theme="dark"]',
        "body{",
        ".container{",
        "h1{",
        ".card{",
        ".btn{",
        ".hero-grid{",
        ".preview-card{",
        ".route-card{",
        ".route__num{",
    ):
        assert token in body, f"в аварийном CSS нет {token}"


def test_critical_css_matches_tokens():
    """Значения страховки не должны разойтись с основной палитрой."""
    body = _css_body().replace(" ", "")
    css = CSS.replace(" ", "")
    for pair in (
        "--bg:#F2EFE8;",
        "--surface:#FFFFFF;",
        "--ink:#14161C;",
        "--accent:#5B4CFF;",
        # v31: маршрут и интро-сцена в аварийном CSS ссылаются на эти токены —
        # без них значения невалидны и карточка остаётся без тени/заливки
        "--accent-soft:#EDEBFF;",
        "--hairline:rgba(255,255,255,.9);",
        "--skip-bg:rgba(18,20,26,.86);",
        "--skip-ink:#FFFFFF;",
    ):
        assert pair in body, f"в аварийном CSS нет {pair}"
        assert pair in css, f"в globals.css нет {pair}"


def test_critical_css_has_no_forbidden_techniques():
    body = _css_body()
    for bad in ("filter:", "backdrop-filter", "mix-blend-mode", "@import"):
        assert bad not in body, f"в аварийном CSS запрещён {bad}"
