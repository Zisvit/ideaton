#!/usr/bin/env python3
"""v6: генератор печатающей плёнки (noise-64.png) — запечённый шум-ассет.

Совет v6 (декодирование): PNG-плитка вместо SVG feTurbulence в CSS —
детерминированные пиксели, кэшируется, гейт проверяет файл байтами.
Alpha запечена В ПИКСЕЛИ (CSS opacity не нужен → слой не промоутится,
композит-цена ноль). Использование: повторяем 64×64 тайл (background-size
64px). Пиксели: тёмно-серый зерно на прозрачном фоне, ~5% coverage
(дельта яркости 3–14/255 на светлом фоне — «плёнка», не грязь).
"""

import random
import struct
import zlib

SIZE = 64  # 64×64 тайл (bg repeat, 1px зерно)
# палитра-зерно: индексы цветов (P-mode + tRNS — маленький файл)
#  0 = полностью прозрачно
#  1..4 = тёмные точки c alpha 56..96 (едва различимое зерно)
PALETTE = [
    (255, 255, 255),  # 0: прозрачный заполнитель (идёт через tRNS)
    (36, 36, 36),  # 1: alpha  56
    (28, 28, 28),  # 2: alpha  76
    (20, 20, 20),  # 3: alpha  96
    (44, 44, 44),  # 4: alpha  40 — самое лёгкое зерно
]
TRNS = [0, 56, 76, 96, 40]  # alpha по индексам палитры


def make_seed_noise(size: int, seed: int = 20260217):
    rng = random.Random(seed)
    # двухшумовое зерно: базовое середнечастотное + редкие яркие одиночки
    density = []
    for _ in range(size * size):
        r = rng.random()
        if r < 0.035:  # 3.5% — заметное зерно
            density.append(rng.choice([1, 2, 3]))
        elif r < 0.120:  # 8.5% — лёгкое зерно
            density.append(4)
        else:
            density.append(0)
    return density


def png_chunk(tag: bytes, body: bytes) -> bytes:
    return (
        struct.pack(">I", len(body))
        + tag
        + body
        + struct.pack(">I", zlib.crc32(tag + body) & 0xFFFFFFFF)
    )


def write_palette_png(path: str, size: int, indices: list) -> None:
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 3, 0, 0, 0)  # 8-bit палитра
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


if __name__ == "__main__":
    import os

    out = os.path.join(
        os.path.dirname(__file__), "..", "apps", "web", "public", "noise-64.png"
    )
    os.makedirs(os.path.dirname(out), exist_ok=True)
    idx = make_seed_noise(SIZE)
    write_palette_png(out, SIZE, idx)
    lab = os.path.getsize(out)
    print(f"noise-64.png: {SIZE}x{SIZE}, {lab} bytes")
    assert lab <= 8192, f"PNG > 8KB: {lab}"
