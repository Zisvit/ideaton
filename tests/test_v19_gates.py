"""Гейты волны v19: шапка над контентом (z-index/opaque/bevel).

v31: контракт токенов персонажа снят — персонаж убран из продукта целиком
(см. tests/test_v31_no_mascot.py).
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = (ROOT / "apps/web/styles/globals.css").read_text()


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


