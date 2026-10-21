"""v25: лис в интро — вырезка без заднего фона (PNG с альфой).

Запрос пользователя: «лиса с задним фоном» → «лис без фона (вырезка)».
Источник — тот же public-domain снимок USFWS «Red Fox at Puale Bay»
(оригинал 4000×3000), вырезан ImageMagick'ом: маска «лис/трава» по HSL,
медиана для снятия травинок, связные компоненты оставили только силуэт
лиса, RGB — оригинал с медианной «починкой» зоны травы.

Гейт проверяет, что это честная вырезка, а не картинка с белой подложкой:
альфа-канал реально используется (углы прозрачные, силуэт непрозрачный,
по краям есть полупрозрачные пиксели), картинка вписана целиком
(object-fit: contain — кропить вырезку нельзя), фон карточки — токенный
градиент (без filter/blend), и ничего не сломано в гейтах v6/v9/v12/v19/v20/
v22/v24 (legacy SVG-лис v20 остаётся в коде, но не рендерится).
"""

from __future__ import annotations

import re
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTO = ROOT / "apps/web/public/fox-cutout.png"
CSS = (ROOT / "apps/web/styles/globals.css").read_text(encoding="utf-8")


def _idat(raw: bytes) -> bytes:
    """Склеенные данные IDAT из PNG (stdlib zlib, без внешних библиотек)."""
    pos, chunks = 8, []
    while pos + 8 <= len(raw):
        length = struct.unpack(">I", raw[pos : pos + 4])[0]
        ctype = raw[pos + 4 : pos + 8]
        if ctype == b"IDAT":
            chunks.append(raw[pos + 8 : pos + 8 + length])
        if ctype == b"IEND":
            break
        pos += 12 + length
    return zlib.decompress(b"".join(chunks))


def _unfilter(data: bytes, width: int, rows: int) -> list[bytes]:
    """Развернуть PNG-строки (фильтры 0–4) в RGBA8; нужно первые rows строк."""
    bpp, stride = 4, width * 4
    out: list[bytes] = []
    prev = bytearray(stride)
    i = 0
    for _ in range(rows):
        f = data[i]
        i += 1
        line = bytearray(data[i : i + stride])
        i += stride
        if f == 1:
            for x in range(bpp, stride):
                line[x] = (line[x] + line[x - bpp]) & 0xFF
        elif f == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 0xFF
        elif f == 3:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 0xFF
        elif f == 4:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 0xFF
        prev = line
        out.append(bytes(line))
    return out


def test_cutout_alpha_is_real():
    """Углы прозрачные, силуэт непрозрачный, по краю есть полупрозрачные пиксели."""
    raw = PHOTO.read_bytes()
    width, height = struct.unpack(">II", raw[16:24])
    data = _idat(raw)
    stride = width * 4
    assert len(data) == height * (1 + stride), "PNG обрезан: не все строки на месте"
    rows = _unfilter(data, width, 90)
    alphas = [row[i] for row in rows for i in range(3, len(row), 4)]
    assert alphas[0] == 0, "левый верхний угол не прозрачный — это не вырезка"
    assert any(a == 255 for a in alphas), "нет непрозрачных пикселей — силуэт пуст"
    assert any(0 < a < 255 for a in alphas), (
        "нет полупрозрачных пикселей — край вырезки жёсткий (нет сглаживания)"
    )


def test_cutout_is_fitted_whole():
    assert "object-fit: contain" in CSS
    css = re.sub(r"/\*[\s\S]*?\*/", "", CSS)
    for bad in ("mix-blend-mode", "backdrop-filter", "filter:"):
        assert bad not in css, f"в стилях запрещён {bad}"


def test_card_background_is_token_gradient():
    assert "--photo-bg:" in CSS
    assert "background: var(--photo-bg)" in CSS
    # в тёмной теме фон свой (dark-блок правит только переменные — гейт v12)
    m = re.search(r'html\[data-theme="dark"\]\s*\{', CSS)
    assert m, 'нет блока html[data-theme="dark"]'
    i = CSS.index("{", m.end() - 1)
    depth, j = 0, i
    while j < len(CSS):
        if CSS[j] == "{":
            depth += 1
        elif CSS[j] == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    dark = CSS[i + 1 : j]
    assert "--photo-bg:" in dark, "в тёмной теме фон карточки не переопределён"
