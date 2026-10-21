"""v24: полировка карточки лиса (совет mix, раунд 2); v25 — карточка стала
вырезкой (PNG с альфой), гейт обновлён под новый ассет.

Что закрывает этот гейт:
1) md5-пин ассета — ловит молчаливую подмену картинки (при смене снимка пин
   пересчитывается осознанно, вместе с правкой комментария в IntroScene);
2) прелоад + fetchPriority — карточка не пустует первые секунды интро;
3) onError-фолбэк — вместо битой картинки нейтральная карточка (legacy-SVG
   в разметку не возвращаем: гейт v22 требует, чтобы он не рендерился);
4) тёмная тема — своя тень и свой фон карточки через токены (dark-блок
   правит только переменные, гейт v12);
5) docker-образ — components/styles/public копируются, .dockerignore есть
   (иначе образ не собирается, а /fox-cutout.png отдаёт 404).
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTO = ROOT / "apps/web/public/fox-cutout.png"
INTRO = (ROOT / "apps/web/components/IntroScene.tsx").read_text(encoding="utf-8")
CSS = (ROOT / "apps/web/styles/globals.css").read_text(encoding="utf-8")
DOCKERFILE = (ROOT / "apps/web/Dockerfile").read_text(encoding="utf-8")
DOCKERIGNORE = ROOT / "apps/web/.dockerignore"

# md5 запечённой вырезки (900×650 RGBA, public domain USFWS «Red fox (52869982404)»).
PHOTO_MD5 = "ed6a88f9b58f74ceec1fe803f0bdab53"


def _dark_block() -> str:
    """Тело первого блока html[data-theme="dark"] — по балансу скобок.

    Не ищем просто первую "}": вложенная конструкция внутри блока обрезала
    бы его (longcat, раунд 2)."""
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
    return CSS[i + 1 : j]


def _flat(text: str) -> str:
    """Схлопнутые пробелы: атрибуты JSX могут разъехаться переносом строки."""
    return re.sub(r"\s+", " ", text)


def test_photo_asset_pinned_by_md5():
    digest = hashlib.md5(PHOTO.read_bytes()).hexdigest()
    assert digest == PHOTO_MD5, (
        f"картинка лиса изменилась ({digest}) — пересчитай пин и обнови комментарий"
    )


def test_photo_preloaded_and_high_priority():
    intro = _flat(INTRO)
    assert 'rel="preload"' in intro
    assert 'as="image"' in intro
    assert 'href="/fox-cutout.png"' in intro
    assert "fetchPriority" in intro


def test_photo_has_error_fallback_not_svg():
    assert "onError" in INTRO, "нет фолбэка на неудачную загрузку картинки"
    assert "intro-photo--fallback" in INTRO
    assert "intro-photo--fallback" in CSS
    # legacy-SVG в разметку не возвращаем
    assert "<Fox />" not in INTRO


def test_photo_card_shadow_and_bg_are_tokens():
    assert "--photo-shadow" in CSS
    assert "--photo-bg" in CSS
    dark = _dark_block()
    assert "--photo-shadow:" in dark, "в тёмном блоке нет своей тени карточки"
    assert "--photo-bg:" in dark, "в тёмном блоке нет своего фона карточки"
    assert "box-shadow: var(--photo-shadow)" in CSS
    assert "background: var(--photo-bg)" in CSS
    # фон карточки — обычный градиент, без filter/blend (контракт v20/v22; в
    # комментариях эти слова тоже встречаются — сканируем CSS без комментариев)
    css = re.sub(r"/\*[\s\S]*?\*/", "", CSS)
    for bad in ("mix-blend-mode", "backdrop-filter", "filter:"):
        assert bad not in css, f"в стилях запрещён {bad}"


def test_motion_budget_untouched():
    assert len(re.findall(r"@keyframes\s+[A-Za-z0-9-]+", CSS)) == 30


def test_docker_image_ships_static_and_components():
    for line in (
        "COPY components ./components",
        "COPY styles ./styles",
        "COPY public ./public",
        "COPY --from=build /app/public ./public",
    ):
        assert line in DOCKERFILE, f"в Dockerfile нет: {line}"
    assert DOCKERIGNORE.exists(), "нет apps/web/.dockerignore"
    ignored = DOCKERIGNORE.read_text(encoding="utf-8")
    assert "node_modules" in ignored
    assert ".next" in ignored
