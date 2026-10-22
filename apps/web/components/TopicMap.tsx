/**
 * v7 + v13 + v32: «Карта тем» — граф в интерфейсе Obsidian.
 *
 * v32: холст-граф 1:1 с обсидиановским — сетка точек на тёмном фоне, узлы-
 * кружки (размер = число связей), цвет недели, тонкие кривые связи, при
 * наведении подсвечивается «окрестность» (как локальный граф Obsidian), а
 * подписи соседей появляются вместе с подсветкой.
 * Узлы-темы — настоящие кнопки (фокус с клавиатуры, 44px-зона), центр и
 * недели — статичные подписи. Никаких библиотек, keyframes и Math.random.
 * На узких экранах карта не сжимается до нечитаемого: обёртка даёт
 * горизонтальный скролл (карта фиксированной ширины), см. globals.css.
 */

import React from 'react'
import type { GraphEdge, TopicGraph } from '../lib/topicGraph'

type TopicMapProps = {
  graph: TopicGraph
  selected: string | null
  onSelect: (key: string) => void
}

/** v32: цвет недели — палитра бренда (синий → фиолетовый → светлый → тёплый). */
const WEEK_COLOR = [
  'var(--brand-blue)',
  'var(--brand-violet)',
  'var(--accent-2)',
  'var(--gap)',
]

/** v13: квадратичная кривая ребра — лёгкая «дуга», детерминированная по индексу. */
function edgePath(edge: GraphEdge, i: number): string {
  const dx = edge.to.x - edge.from.x
  const dy = edge.to.y - edge.from.y
  const bend = (((i * 7919) % 13) - 6) / 45
  const cx = (edge.from.x + edge.to.x) / 2 - dy * bend
  const cy = (edge.from.y + edge.to.y) / 2 + dx * bend
  return `M ${edge.from.x} ${edge.from.y} Q ${cx} ${cy} ${edge.to.x} ${edge.to.y}`
}

export default function TopicMap({ graph, selected, onSelect }: TopicMapProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  // v13: наведённый узел — как в Obsidian: соседи подсвечены, остальное гаснет.
  const [hover, setHover] = React.useState<string | null>(null)

  // На узком экране карта шире вьюпорта: стартуем с центра, чтобы
  // направление и лучи были видны без «слепого» свайпа. На десктопе
  // scrollWidth == clientWidth и скрипт ничего не делает.
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const centered = (el.scrollWidth - el.clientWidth) / 2
    if (centered > 0) el.scrollLeft = centered
  }, [graph])

  // Соседи по рёбрам (v13: у рёбер есть fromKey/toKey): фокус + соседи = «горячие».
  const neighbors = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    const set = neighbors.get(a) ?? new Set<string>()
    set.add(b)
    neighbors.set(a, set)
  }
  for (const edge of graph.edges) {
    link(edge.fromKey, edge.toKey)
    link(edge.toKey, edge.fromKey)
  }
  const focusKey = hover ?? selected
  const lit = focusKey
    ? new Set<string>([focusKey, ...(neighbors.get(focusKey) ?? [])])
    : null
  const nodeState = (key: string) => (lit && !lit.has(key) ? ' is-dim' : '')
  const edgeState = (edge: GraphEdge) =>
    lit ? (edge.fromKey === focusKey || edge.toKey === focusKey ? ' is-hot' : ' is-dim') : ''

  return (
    <div className="topic-map-scroll" ref={scrollRef}>
      <div
        className="topic-map"
        role="group"
        aria-label="Карта тем тестирований"
        onMouseLeave={() => setHover(null)}
      >
        <svg
          className="topic-map__edges"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {graph.edges.map((edge, i) => (
            <path
              key={i}
              d={edgePath(edge, i)}
              className={`topic-map__edge${
                edge.kind === 'topic' ? ' topic-map__edge--skill' : ''
              }${edgeState(edge)}`}
            />
          ))}
        </svg>

        {graph.nodes.map((node) => {
          const color =
            node.kind === 'center'
              ? 'var(--graph-focus)'
              : WEEK_COLOR[(node.week ?? 1) - 1] ?? 'var(--brand-blue)'
          const style = {
            left: `${node.x}%`,
            top: `${node.y}%`,
            '--node-color': color,
          } as React.CSSProperties

          if (node.kind === 'center') {
            // v32: узел-«якорь» — кружок, подпись рядом (как в обсидиане)
            return (
              <div
                key={node.key}
                className={`topic-node topic-node--center${nodeState(node.key)}`}
                style={style}
                title={node.label}
              >
                <span className="topic-node__dot topic-node__dot--center" aria-hidden="true" />
                <span className="topic-node__text topic-node__text--center">
                  {node.label}
                </span>
              </div>
            )
          }
          if (node.kind === 'week') {
            return (
              <div
                key={node.key}
                className={`topic-node topic-node--week${nodeState(node.key)}`}
                style={style}
              >
                <span className="topic-node__dot topic-node__dot--week" aria-hidden="true" />
                <span className="topic-node__text topic-node__text--week">
                  {node.label}
                </span>
              </div>
            )
          }
          // v32: размер точки — по числу связей (degree), как в графе Obsidian.
          const dot = 7 + Math.round(3.4 * Math.sqrt(node.degree || 1))
          const isLit = !!lit && lit.has(node.key)
          return (
            <button
              key={node.key}
              type="button"
              className={`topic-node topic-node--topic${
                node.testable ? ' is-testable' : ''
              }${selected === node.key ? ' is-selected' : ''}${nodeState(node.key)}${
                isLit ? ' is-lit' : ''
              }`}
              style={style}
              onClick={() => onSelect(node.key)}
              onMouseEnter={() => setHover(node.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(node.key)}
              onBlur={() => setHover(null)}
              aria-pressed={selected === node.key}
              aria-label={node.label}
              title={node.label}
            >
              <span
                className="topic-node__dot"
                style={{ width: dot, height: dot }}
                aria-hidden="true"
              />
              <span className={`topic-node__text${node.x > 66 ? ' is-flip' : ''}`}>
                {node.label}
              </span>
            </button>
          )
        })}

        <div className="topic-map__legend" aria-hidden="true">
          <span className="topic-map__legend-item">
            <i className="topic-map__legend-dot" /> тема — клик открывает проверку
          </span>
          <span className="topic-map__legend-item">
            <i className="topic-map__legend-line" /> неделя
          </span>
          <span className="topic-map__legend-item">
            <i className="topic-map__legend-line topic-map__legend-line--skill" />{' '}
            общий навык
          </span>
        </div>
      </div>
    </div>
  )
}
