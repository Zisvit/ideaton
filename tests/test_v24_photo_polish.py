"""v24: полировка фото-карточки лиса (совет mix, раунд 2).

Что закрывает этот гейт:
1) md5-пин ассета — ловит молчаливую подмену фото (при смене снимка пин
   пересчитывается осознанно, вместе с правкой комментария в IntroScene);
2) прелоад + fetchPriority — карточка не пустует первые секунды интро;
3) onError-фолбэк — вместо битой картинки нейтральная карточка (legacy-SVG
   в разметку не возвращаем: гейт v22 требует, чтобы он не рендерился);
4) тёмная тема — своя тень и скрим через токены (dark-блок правит только
   переменные, гейт v12);
5) docker-образ — components/styles/public копируются, .dockerignore есть
   (иначе образ не собирается, а /fox-photo.jpg отдаёт 404).
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTO = ROOT / "apps/web/public/fox-photo.jpg"
INTRO = (ROOT / "apps/web/components/IntroScene.tsx").read_text(encoding="utf-8")
CSS = (ROOT / "apps/web/styles/globals.css").read_text(encoding="utf-8")
DOCKERFILE = (ROOT / "apps/web/Dockerfile").read_text(encoding="utf-8")
DOCKERIGNORE = ROOT / "apps/web/.dockerignore"

# md5 запечённого фото (900×650, public domain USFWS «Red Fox at Puale Bay»).
PHOTO_MD5 = "867a398af20211d89c84c9d9cbfa35c3"


def _dark_block() -> str:
    m = re.search(r'html\[data-theme="dark"\]\s*\{', CSS)
    assert m, 'нет блока html[data-theme="dark"]'
    i = CSS.index("{", m.end() - 1)
    j = CSS.index("}", i)
    return CSS[i + 1 : j]


def test_photo_asset_pinned_by_md5():
    digest = hashlib.md5(PHOTO.read_bytes()).hexdigest()
    assert digest == PHOTO_MD5, (
        f"фото лиса изменилось ({digest}) — пересчитай пин и обнови комментарий"
    )


def test_photo_preloaded_and_high_priority():
    assert 'rel="preload"' in INTRO
    assert 'as="image"' in INTRO
    assert 'href="/fox-photo.jpg"' in INTRO
    assert "fetchPriority" in INTRO


def test_photo_has_error_fallback_not_svg():
    assert "onError" in INTRO, "нет фолбэка на неудачную загрузку фото"
    assert "intro-photo--fallback" in INTRO
    assert "intro-photo--fallback" in CSS
    # legacy-SVG в разметку не возвращаем
    assert "<Fox />" not in INTRO


def test_photo_card_shadow_and_scrim_are_tokens():
    assert "--photo-shadow" in CSS
    assert "--photo-scrim" in CSS
    dark = _dark_block()
    assert "--photo-shadow:" in dark, "в тёмном блоке нет своей тени карточки"
    assert "--photo-scrim:" in dark, "в тёмном блоке нет скрима карточки"
    assert "box-shadow: var(--photo-shadow)" in CSS
    # скрим — обычный фон, без filter/blend (контракт v20/v22; в комментариях
    # эти слова тоже встречаются — сканируем CSS без комментариев)
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
