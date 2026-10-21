"""v26: контракт редизайна интерфейса.

Пользователь попросил «идеальный интерфейс». Редизайн зафиксирован гейтом,
чтобы следующая правка не откатила его в «учебный» вид молча:

1) палитра и контраст: ключевые пары токенов — по формуле WCAG (текст ≥4.5:1,
   границы/графика ≥3:1);
2) интерактивные цели: чипы/кнопки/переключатель — не меньше 44px,
   чекбокс — 24px + хит-зона;
3) мобильная липкая CTA не перекрывает контент (fixed + safe-area + отступ);
4) новые блоки интерфейса на месте: герой в две колонки, превью подбора,
   сгруппированный пикер, футер с атрибуцией фото;
5) глубина строится плоскостями и хайрлайнами: filter/backdrop-filter/
   mix-blend-mode в стилях нет, conic-слой не раздут до 220%;
6) талисман отдаётся в WebP (LCP), PNG остаётся запасным вариантом.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps/web"
CSS = (WEB / "styles/globals.css").read_text(encoding="utf-8")
INDEX = (WEB / "pages/index.tsx").read_text(encoding="utf-8")


def _strip_comments(css: str) -> str:
    return re.sub(r"/\*[\s\S]*?\*/", "", css)


def _strip_media(css: str) -> str:
    """Убрать все @media-блоки: токены внутри них (печать, prefers-contrast)
    не действуют в обычном режиме и не должны «побеждать» в каскаде."""
    out, i = [], 0
    while True:
        j = css.find("@media", i)
        if j < 0:
            out.append(css[i:])
            return "".join(out)
        out.append(css[i:j])
        k = css.index("{", j)
        depth, p = 0, k
        while p < len(css):
            if css[p] == "{":
                depth += 1
            elif css[p] == "}":
                depth -= 1
                if depth == 0:
                    break
            p += 1
        i = p + 1


def _blocks(css: str, selector: str) -> list[str]:
    """Тела всех top-level блоков с селектором (в т.ч. внутри @media — нет)."""
    out = []
    for m in re.finditer(re.escape(selector) + r"\s*\{", css):
        i = css.index("{", m.end() - 1)
        depth, j = 0, i
        while j < len(css):
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        out.append(css[i + 1 : j])
    return out


def _tokens(dark: bool = False) -> dict[str, str]:
    """ЭФФЕКТИВНЫЕ токены темы: последнее объявление побеждает в каскаде.

    Раньше гейт брал первое вхождение — и проверял мёртвые значения из
    первого :root, пока ниже был переопределяющий блок (minimax, раунд 2:
    «зелёный гейт при фактическом провале 2.54:1»)."""
    top = _strip_media(_strip_comments(CSS))
    darks = _blocks(top, 'html[data-theme="dark"]')
    if dark:
        assert darks, "нет тёмного блока"
        src = darks[0]
    else:
        src = top
        for blk in darks:
            src = src.replace(blk, "")
    out: dict[str, str] = {}
    for name, value in re.findall(r"--([a-z0-9-]+):\s*([^;]+);", src):
        out[name] = value.strip()
    return out


def _rgb(hex_color: str) -> tuple[float, float, float]:
    h = hex_color.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def _luminance(rgb: tuple[float, float, float]) -> float:
    def ch(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (ch(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _contrast(fg: str, bg: str) -> float:
    l1, l2 = _luminance(_rgb(fg)), _luminance(_rgb(bg))
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def test_key_palette_contrast_is_aa():
    t = _tokens()
    pairs = [
        ("ink", "bg", 4.5),
        ("ink-2", "bg", 4.5),
        ("muted", "bg", 4.5),
        ("muted-2", "surface", 4.5),
        ("muted-2", "surface-2", 4.5),
        ("accent-text", "bg", 4.5),
        ("on-match", "match", 4.5),
        ("gap-ink", "gap-soft", 4.5),
        ("match-ink", "surface-2", 4.5),
        ("line-strong", "surface", 3.0),
        ("accent", "surface-2", 3.0),
    ]
    for fg, bg, need in pairs:
        assert fg in t and bg in t, f"нет токена {fg}/{bg}"
        got = _contrast(t[fg], t[bg])
        assert got >= need, f"{fg} на {bg}: {got:.2f}:1 < {need}:1"


def test_dark_theme_contrast_is_aa():
    t = _tokens(dark=True)
    pairs = [
        ("ink", "bg", 4.5),
        ("ink-2", "bg", 4.5),
        ("muted", "bg", 4.5),
        ("muted-2", "surface-2", 4.5),
        ("accent-text", "bg", 4.5),
        ("on-match", "match", 4.5),
        ("match-ink", "surface-2", 4.5),
        ("gap-ink", "gap-soft", 4.5),
        ("line-strong", "surface", 3.0),
        ("accent", "surface-2", 3.0),
    ]
    for fg, bg, need in pairs:
        assert fg in t and bg in t, f"в тёмной теме нет токена {fg}/{bg}"
        got = _contrast(t[fg], t[bg])
        assert got >= need, f"тёмная {fg} на {bg}: {got:.2f}:1 < {need}:1"


def test_touch_targets_are_44px():
    assert re.search(r"\.chip \{[^}]*min-height:\s*44px", CSS, re.S), "чип меньше 44px"
    assert re.search(r"\.chip-sm \{[^}]*min-height:\s*44px", CSS, re.S), (
        "chip-sm меньше 44px"
    )
    assert re.search(r"\.btn-ghost \{[^}]*min-height:\s*44px", CSS, re.S), (
        "btn-ghost < 44px"
    )
    # переключатель темы: визуальная высота 30px + хит-зона 44px через ::after
    assert re.search(r"\.theme-toggle__btn \{[^}]*min-height:\s*30px", CSS, re.S), (
        "переключатель темы: нет визуальной высоты"
    )
    assert re.search(r"\.theme-toggle__btn::after \{[^}]*inset:\s*-7px", CSS, re.S), (
        "переключатель темы: нет хит-зоны 44px"
    )
    assert re.search(r"\.check \{[^}]*width:\s*24px", CSS, re.S), "чекбокс < 24px"
    assert ".check::before" in CSS, "нет хит-зоны 44px у чекбокса"


def test_mobile_cta_does_not_cover_content():
    block = re.search(r"@media \(max-width: 900px\) \{(.*?)\n\}", CSS, re.S)
    assert block, "нет мобильного медиа-блока для CTA"
    body = block.group(1)
    assert ".cta-sticky" in body and "position: fixed" in body
    assert "env(safe-area-inset-bottom)" in body
    assert "padding-bottom" in body


def test_new_blocks_exist():
    for cls in (
        ".hero-grid",
        ".hero-side",
        ".preview-card",
        ".preview-row",
        ".picker-group",
        ".mascot-card",
        ".site-footer",
    ):
        assert cls in CSS, f"нет блока {cls}"
    for needle in (
        'className="hero-grid',
        'className="preview-card"',
        'className="picker-group"',
        'className="site-footer"',
        'className="mascot-card"',
    ):
        assert needle in INDEX, f"нет разметки {needle}"
    # футер указывает источник фото (public domain)
    assert "Red Fox at Puale Bay" in INDEX


def test_depth_without_filters_and_heavy_layers():
    css = re.sub(r"/\*[\s\S]*?\*/", "", CSS)
    for bad in ("filter:", "backdrop-filter", "mix-blend-mode"):
        assert bad not in css, f"в стилях запрещён {bad}"
    conic = css[
        css.index(".fx-conic::before") : css.index(".fx-conic.is-swept::before")
    ]
    assert "220%" not in conic, "conic-слой раздут до 220% (25 МБ VRAM)"
    assert "inset: 0" in conic


def test_mascot_ships_webp_and_png():
    webp = WEB / "public/fox-cutout.webp"
    png = WEB / "public/fox-cutout.png"
    assert webp.exists() and png.exists()
    assert webp.stat().st_size < png.stat().st_size / 4, "WebP не дал экономии"
    assert "/fox-cutout.webp" in INDEX
    assert 'src="/fox-cutout.png"' in INDEX


def test_reduced_motion_keeps_done_state_readable():
    assert ".week li.done span { text-decoration: line-through; }" in CSS
