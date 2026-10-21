"""Гейты v20: растровая шерсть лиса — запечённый PNG, pattern+use, без
фильтров/blend. Шапка v19 и контракты 20 классов/30 keyframes не трогаются.
"""

from __future__ import annotations

import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS_RAW = (ROOT / "apps/web/styles/globals.css").read_text()
FOX = (ROOT / "apps/web/components/IntroScene.tsx").read_text()
PNG = ROOT / "apps/web/public/fox-fur-128.png"


def _strip_comments(text: str) -> str:
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    return re.sub(r"^\s*//.*$", "", text, flags=re.M)


CSS = _strip_comments(CSS_RAW)


def test_fur_asset_is_baked_tile() -> None:
    raw = PNG.read_bytes()
    assert raw[:8] == b"\x89PNG\r\n\x1a\n", "fox-fur-128.png — не PNG"
    w, h = struct.unpack(">II", raw[16:24])
    assert (w, h) == (128, 128), f"плитка должна быть 128×128: {(w, h)}"
    assert raw[25] == 3, "ожидаем палитровый PNG с tRNS"
    assert len(raw) <= 12288, f"PNG > 12KB: {len(raw)}"


def test_fur_is_wired_to_animated_rig() -> None:
    assert 'id="foxFurBody"' in FOX and 'id="foxFurTail"' in FOX
    assert 'href="/fox-fur-128.png"' in FOX
    for base in (
        "foxBodyBase",
        "foxHeadBase",
        "foxTailBase",
        "foxEarFarBase",
        "foxEarNearBase",
    ):
        assert f'id="{base}"' in FOX, f"нет геометрии {base}"
        assert f'href="#{base}"' in FOX, f"нет <use> {base}"
    assert FOX.count("url(#foxFurBody)") >= 3, "текстура не на корпусе/голове/ушах"
    assert "url(#foxFurTail)" in FOX, "текстура не на хвосте"


def test_no_runtime_filters_or_blend() -> None:
    # Фильтры на анимируемых группах = перерисовка filter-region каждый кадр.
    assert "<feTurbulence" not in FOX
    assert "<feDisplacementMap" not in FOX
    assert "<filter" not in FOX
    assert "filter=" not in FOX
    assert "mixBlendMode" not in FOX
    # paint-traps v6: весь globals.css
    assert "mix-blend-mode" not in CSS
    assert "backdrop-filter" not in CSS


def test_rig_contracts_untouched() -> None:
    assert "@keyframes" not in FOX
    assert FOX.count("var(--fox-rim)") >= 3
    assert "M120 213 C118 219 116 225 113 229" in FOX
    assert "M255 207 C254 213 253 218 252 222" in FOX
