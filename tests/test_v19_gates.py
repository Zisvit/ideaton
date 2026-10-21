"""Гейты волны v19: шапка над контентом (z-index/opaque/bevel) и токены
лиса для тёмной темы. Без новых @keyframes и без правок светлой палитры.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = (ROOT / "apps/web/styles/globals.css").read_text()
FOX = (ROOT / "apps/web/components/IntroScene.tsx").read_text()


def _block(selector: str) -> str:
    m = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", CSS)
    assert m, f"нет правила {selector}"
    return m.group(1)


def test_header_is_above_main() -> None:
    # Причина бага: main, .site-header { z-index:1 } ниже по файлу перебивал
    # z-index:40; main (позже в DOM) рисовался поверх шапки.
    assert "main, .site-header" not in CSS
    assert re.search(r"^main \{ position: relative; z-index: 1; \}$", CSS, re.M)
    header = _block(".site-header")
    assert "z-index: 40" in header
    assert "background: var(--bg)" in header


def test_header_top_edge_is_bevel() -> None:
    header = _block(".site-header")
    assert "border-top: 1px solid var(--line)" in header
    assert ".site-header::after { top: 1px; }" in CSS
    # HCM: настоящий border, sheen скрыт
    assert ".site-header { border-top: 1px solid CanvasText; }" in CSS
    assert ".site-header::after { display: none; }" in CSS


def test_fox_theme_tokens() -> None:
    # Светлые значения
    for token in ("--fox-ink:", "--fox-ao:", "--fox-rim:", "--fox-contact:"):
        assert token in CSS, f"нет {token}"
    # Тёмная тема: чулки/лапы не растворяются, нос/глаз не чёрные на чёрном
    assert "--fox-ink: #3A2A20;" in CSS
    assert "--fox-nose: #4A3026;" in CSS
    assert "--fox-eye: #E8A63D;" in CSS


def test_fox_new_anatomy_marks() -> None:
    # Крупные тональные массы вместо микро-штрихов + чёрные чулки.
    assert FOX.count("var(--fox-rim)") >= 3
    assert "M120 213 C118 219 116 225 113 229" in FOX  # чулок от скакательного
    assert "M255 207 C254 213 253 218 252 222" in FOX  # передний чулок
    # Никаких новых keyframes/анимаций в SVG
    assert "@keyframes" not in FOX
