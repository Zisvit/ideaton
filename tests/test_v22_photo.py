"""v22 (→ v25): лис в интро — реальное фото, а не SVG; v25 — вырезка без фона.

История: v22 поставил фото-карточку (public domain, JPEG), v23 перекадрировал
плотнее, v25 заменил снимок на вырезку (PNG с альфой), v27 — по запросу
«лис вообще без фона + более подходящая картинка» — новая вырезка головы
рыжего лиса (USFWS Midwest, public domain): PNG 900×650 с альфой. SVG-лис v20
остаётся в файле как legacy для гейтов v9/v19/v20, но в разметке сцены не
рендерится. У вырезки нет runtime-фильтров/blend: только transform (зум/посадка
через transition, бюджет @keyframes не тратится).
"""

from __future__ import annotations

import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTO = ROOT / "apps/web/public/fox-cutout.png"
INTRO = (ROOT / "apps/web/components/IntroScene.tsx").read_text(encoding="utf-8")
CSS = (ROOT / "apps/web/styles/globals.css").read_text(encoding="utf-8")


def _png_header(raw: bytes) -> tuple[int, int, int, int]:
    """(ширина, высота, глубина бит, тип цвета) из IHDR; без внешних библиотек."""
    assert raw[:8] == b"\x89PNG\r\n\x1a\n", "fox-cutout.png — не PNG"
    assert raw[12:16] == b"IHDR", "первый чанк PNG не IHDR"
    width, height, depth, color = struct.unpack(">IIBB", raw[16 : 16 + 10])
    return width, height, depth, color


def test_photo_asset_is_baked_png():
    raw = PHOTO.read_bytes()
    width, height, depth, color = _png_header(raw)
    assert (width, height) == (900, 650), (
        f"вырезка должна быть 900×650 (3× карточки 300), а не {width}×{height}"
    )
    assert depth == 8, f"ожидаем 8 бит на канал, а не {depth}"
    assert color == 6, f"ожидаем RGBA (тип 6) с альфой, а не тип {color}"
    # v27: вырезка — фото в RGBA (мягкий край требует полупрозрачных пикселей,
    # PNG8 их теряет). Браузеры получают WebP (~37 КБ), PNG — запасной вариант.
    assert len(raw) < 400_000, f"вырезка слишком тяжёлая: {len(raw)} байт"


def test_intro_renders_photo_not_svg():
    assert "<FoxPhoto />" in INTRO, "сцена не рендерит карточку лиса"
    assert "<Fox />" not in INTRO, "SVG-лис всё ещё рендерится в сцене"
    assert 'src="/fox-cutout.png"' in INTRO, "нет ссылки на запечённую вырезку"
    assert "width={900}" in INTRO and "height={650}" in INTRO
    # провенанс: public domain, источник указан в коде
    assert "public domain" in INTRO
    assert "Red_fox_(52869982404)" in INTRO
    # legacy-лис остаётся для старых гейтов, но не в рендере
    assert "export function Fox()" in INTRO


def test_photo_card_css_is_transform_only():
    assert ".intro-photo {" in CSS
    assert ".is-run .intro-photo {" in CSS
    # вырезку нельзя кропить — она вписывается целиком (contain)
    assert "object-fit: contain" in CSS
    start = CSS.index(".intro-photo {")
    end = CSS.index(".is-run .intro-photo__img", start)
    block = CSS[start:end]
    assert "transition: transform" in block
    for bad in ("filter:", "mix-blend-mode", "backdrop-filter"):
        assert bad not in block, f"в фото-карточке запрещён {bad}"
