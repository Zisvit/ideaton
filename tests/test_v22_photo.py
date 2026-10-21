"""v22: лис в интро — реальное фото (public domain) в карточке, не SVG.

Фото запечено в JPEG и лежит в public; SVG-лис v20 остаётся в файле как
legacy для гейтов v9/v19/v20 и быстрого отката, но в разметке сцены не
рендерится. У фото-карточки нет runtime-фильтров/blend: только transform
(зум/посадка через transition, бюджет @keyframes не тратится).
"""

from __future__ import annotations

import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTO = ROOT / "apps/web/public/fox-photo.jpg"
INTRO = (ROOT / "apps/web/components/IntroScene.tsx").read_text(encoding="utf-8")
CSS = (ROOT / "apps/web/styles/globals.css").read_text(encoding="utf-8")


def _jpeg_size(raw: bytes) -> tuple[int, int]:
    """Ширина/высота из SOF0/SOF1/SOF2; без внешних библиотек."""
    i = 2
    while i + 9 < len(raw):
        if raw[i] != 0xFF:
            i += 1
            continue
        marker = raw[i + 1]
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        seglen = struct.unpack(">H", raw[i + 2 : i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2):
            height, width = struct.unpack(">HH", raw[i + 5 : i + 9])
            return width, height
        i += 2 + seglen
    raise AssertionError("в JPEG не найден SOF-маркер")


def test_photo_asset_is_baked_jpeg():
    raw = PHOTO.read_bytes()
    assert raw[:2] == b"\xff\xd8", "fox-photo.jpg — не JPEG"
    assert len(raw) < 250_000, f"фото слишком тяжёлое: {len(raw)} байт"
    assert _jpeg_size(raw) == (900, 650), "фото должно быть 900×650 (3× карточки 300)"


def test_intro_renders_photo_not_svg():
    assert "<FoxPhoto />" in INTRO, "сцена не рендерит фото-карточку"
    assert "<Fox />" not in INTRO, "SVG-лис всё ещё рендерится в сцене"
    assert 'src="/fox-photo.jpg"' in INTRO, "нет ссылки на запечённое фото"
    assert "width={900}" in INTRO and "height={650}" in INTRO
    # провенанс: public domain, источник указан в коде
    assert "public domain" in INTRO
    assert "Vulpes_vulpes_standing_in_snow" in INTRO
    # legacy-лис остаётся для старых гейтов, но не в рендере
    assert "export function Fox()" in INTRO


def test_photo_card_css_is_transform_only():
    assert ".intro-photo {" in CSS
    assert ".is-run .intro-photo {" in CSS
    assert "object-fit: cover" in CSS
    start = CSS.index(".intro-photo {")
    end = CSS.index(".is-run .intro-photo__img", start)
    block = CSS[start:end]
    assert "transition: transform" in block
    for bad in ("filter:", "mix-blend-mode", "backdrop-filter"):
        assert bad not in block, f"в фото-карточке запрещён {bad}"
