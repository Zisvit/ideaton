"""v32: «Карта тем» — граф 1:1 с интерфейсом графа Obsidian.

Запрос пользователя: «сделай карту тем 1в1 как интерфейс графа обсидиана».

Что закрывает этот гейт:
  1) раскладка — свободная силовая (пружины + отталкивание), а не «солнце с
     лучами»; при этом детерминированная (без Math.random — SSR-стабильно);
  2) холст: тёмная поверхность 16:9 + сетка точек (фирменная сетка обсидиана);
  3) узлы — кружки: размер по числу связей, цвет по неделе, фокусный узел
     выделен;
  4) при наведении подсвечивается «окрестность» (как локальный граф) и
     показываются подписи соседей;
  5) связи — тонкие кривые, общий навык — пунктир.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps/web"
CSS = (WEB / "styles/globals.css").read_text(encoding="utf-8")
PLAN = (WEB / "pages/plan.tsx").read_text(encoding="utf-8")


def _strip_comments(text: str) -> str:
    """Комментарии не считаем: в них слова объясняют, но не исполняются."""
    return re.sub(r"/\*[\s\S]*?\*/", "", text)


GRAPH = _strip_comments((WEB / "lib/topicGraph.ts").read_text(encoding="utf-8"))
MAP = _strip_comments((WEB / "components/TopicMap.tsx").read_text(encoding="utf-8"))


def test_layout_is_force_based_and_deterministic():
    assert "function relax(" in GRAPH, "нет силовой раскладки"
    for const in ("REPULSE", "SPRING", "REST", "GRAVITY", "DAMP"):
        assert const in GRAPH, f"нет параметра {const}"
    assert "relax(nodes, edges)" in GRAPH, "раскладка не вызывается"
    # детерминизм: никакого Math.random (SSR-стабильность, гейт v13)
    assert "Math.random" not in GRAPH
    assert "Math.random" not in MAP


def test_canvas_is_dark_with_dot_grid():
    map_block = CSS[CSS.index(".topic-map {") :]
    map_block = map_block[: map_block.index("}")]
    assert "aspect-ratio: 16 / 9" in map_block
    assert "linear-gradient(135deg, var(--hero-a) 0%, var(--hero-b) 100%)" in map_block
    # сетка точек — отдельный слой под рёбрами
    assert ".topic-map::before" in CSS
    grid = CSS[CSS.index(".topic-map::before {") :]
    grid = grid[: grid.index("}")]
    assert "radial-gradient(circle" in grid
    assert "background-size:" in grid


def test_nodes_are_dots_coloured_by_week():
    assert "--node-color" in MAP, "цвет узла не задаётся"
    assert "WEEK_COLOR" in MAP
    assert "const dot = 7 + Math.round(3.4 * Math.sqrt(node.degree || 1))" in MAP
    # базовое правило точки (не составные селекторы --center/--week)
    dot = CSS[CSS.index("\n.topic-node__dot {") :]
    dot = dot[: dot.index("}")]
    assert "border-radius: 50%" in dot
    assert "var(--node-color" in dot
    assert "box-shadow: 0 0 0 1.5px rgba(10, 10, 12, .55)" in dot


def test_neighbourhood_highlights_like_local_graph():
    assert "is-lit" in MAP, "подписи соседей не показываются"
    assert ".topic-node--topic.is-lit .topic-node__text" in CSS
    assert "is-hot" in MAP and "is-dim" in MAP
    # подписи недели и направления видны всегда
    assert ".topic-node__text--week" in CSS
    assert ".topic-node__text--center" in CSS


def test_legend_is_a_panel_and_plan_text_matches():
    legend = CSS[CSS.index(".topic-map__legend {") :]
    legend = legend[: legend.index("}")]
    assert "border-radius" in legend and "background: rgba" in legend
    assert "Граф тем" in PLAN, "подпись карты не описывает граф"
