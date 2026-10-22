"""v24: целостность сборки (docker-образ) и бюджет моушна.

История: гейт закрывал полировку карточки персонажа (md5-пин ассета, прелоад,
фолбэк на onError, свои тень/фон в тёмной теме). v31 персонаж убран из
продукта целиком, поэтому из гейта остались только контракты, которые всё
ещё значат:

  1) docker-образ: components/styles/public копируются, .dockerignore есть
     (иначе образ не собирается, а статика отдаёт 404);
  2) бюджет @keyframes не превышен (≤ 30, гейт моушна проверяет детальнее).
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = (ROOT / "apps/web/styles/globals.css").read_text(encoding="utf-8")
DOCKERFILE = (ROOT / "apps/web/Dockerfile").read_text(encoding="utf-8")
DOCKERIGNORE = ROOT / "apps/web/.dockerignore"


def test_motion_budget_untouched():
    assert len(re.findall(r"@keyframes\s+[A-Za-z0-9-]+", CSS)) <= 30


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
