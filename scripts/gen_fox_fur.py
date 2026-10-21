#!/usr/bin/env python3
"""v20: бесшовный тайл шерсти лиса (fox-fur-128.png).

Растровая текстура для SVG-рига: печём PNG-плитку 128×128, чтобы не
гонять feTurbulence/фильтры по анимируемым группам (совет v20: фильтры
на transform-анимации = перерисовка filter-region каждый кадр).
Штрихи двуполярные (тёмные/светлые/подшёрсток), низкий контраст, фон
прозрачный. Плитка seamless: каждый штрих рисуется с wrap-копиями ±SIZE,
поэтому на стыках pattern нет швов.
"""

import math
import random
import struct
import zlib

SIZE = 128
SEED = 20261021

# 0 — прозрачный; 1..3 — тёмные ости; 4..5 — светлые блики; 6 — подшёрсток.
PALETTE = [
    (255, 255, 255),
    (58, 22, 8),
    (58, 22, 8),
    (58, 22, 8),
    (255, 217, 160),
    (255, 217, 160),
    (122, 58, 26),
]
TRNS = [0, 70, 105, 140, 55, 85, 80]

DARK = (1, 2, 3)
LIGHT = (4, 5)
MID = (6,)


def png_chunk(tag: bytes, body: bytes) -> bytes:
    return (
        struct.pack(">I", len(body))
        + tag
        + body
        + struct.pack(">I", zlib.crc32(tag + body) & 0xFFFFFFFF)
    )


def write_palette_png(path: str, size: int, indices: list) -> None:
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 3, 0, 0, 0)
    plte = b"".join(struct.pack("BBB", *c) for c in PALETTE)
    trns = bytes(TRNS)
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter: No
        raw.extend(indices[y * size : (y + 1) * size])
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(sig)
        f.write(png_chunk(b"IHDR", ihdr))
        f.write(png_chunk(b"PLTE", plte))
        f.write(png_chunk(b"tRNS", trns))
        f.write(png_chunk(b"IDAT", idat))
        f.write(png_chunk(b"IEND", b""))


def plot_line(
    canvas: list, x0: float, y0: float, x1: float, y1: float, idx: int, width: float
) -> None:
    """Штрих-капсула: пиксели в радиусе width/2 от отрезка."""
    r = width / 2.0
    minx = max(0, int(math.floor(min(x0, x1) - r)))
    maxx = min(SIZE - 1, int(math.ceil(max(x0, x1) + r)))
    miny = max(0, int(math.floor(min(y0, y1) - r)))
    maxy = min(SIZE - 1, int(math.ceil(max(y0, y1) + r)))
    dx, dy = x1 - x0, y1 - y0
    ln = dx * dx + dy * dy
    if ln == 0:
        return
    for y in range(miny, maxy + 1):
        for x in range(minx, maxx + 1):
            t = ((x - x0) * dx + (y - y0) * dy) / ln
            t = max(0.0, min(1.0, t))
            px, py = x0 + t * dx, y0 + t * dy
            if (x - px) ** 2 + (y - py) ** 2 <= r * r:
                canvas[y * SIZE + x] = idx


def stroke(
    canvas: list,
    x: float,
    y: float,
    angle: float,
    length: float,
    idx: int,
    width: float,
) -> None:
    # wrap-копии: штрих, пересекающий край, продолжается с другой стороны
    for ox in (-SIZE, 0, SIZE):
        for oy in (-SIZE, 0, SIZE):
            plot_line(
                canvas,
                x + ox,
                y + oy,
                x + ox + math.cos(angle) * length,
                y + oy + math.sin(angle) * length,
                idx,
                width,
            )


def make_fur() -> list:
    rng = random.Random(SEED)
    canvas = [0] * (SIZE * SIZE)

    # подшёрсток — короткие мягкие штрихи
    for _ in range(220):
        stroke(
            canvas,
            rng.uniform(0, SIZE),
            rng.uniform(0, SIZE),
            math.radians(rng.uniform(70, 92)),
            rng.uniform(3.0, 7.0),
            rng.choice(MID),
            1.2,
        )
    # остевые волосы — длиннее и темнее
    for _ in range(520):
        stroke(
            canvas,
            rng.uniform(0, SIZE),
            rng.uniform(0, SIZE),
            math.radians(rng.uniform(65, 100)),
            rng.uniform(5.0, 11.0),
            rng.choice(DARK),
            rng.uniform(1.0, 2.0),
        )
    # световые пряди — редкие, тёплые
    for _ in range(180):
        stroke(
            canvas,
            rng.uniform(0, SIZE),
            rng.uniform(0, SIZE),
            math.radians(rng.uniform(60, 105)),
            rng.uniform(4.0, 9.0),
            rng.choice(LIGHT),
            rng.uniform(0.9, 1.6),
        )
    return canvas


if __name__ == "__main__":
    import os

    out = os.path.join(
        os.path.dirname(__file__), "..", "apps", "web", "public", "fox-fur-128.png"
    )
    os.makedirs(os.path.dirname(out), exist_ok=True)
    write_palette_png(out, SIZE, make_fur())
    lab = os.path.getsize(out)
    print(f"fox-fur-128.png: {SIZE}x{SIZE}, {lab} bytes")
    assert lab <= 12288, f"PNG > 12KB: {lab}"
