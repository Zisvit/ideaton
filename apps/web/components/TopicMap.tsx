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

/** v13: квадратичная кривая ребра — лёгкая «дуга», детерминированная по индексу.
 *  v32: концы ребра берём из актуальных координат — перетащенный узел тянет
 *  за собой свои связи (как в графе Obsidian). */
function edgePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  i: number
): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const bend = (((i * 7919) % 13) - 6) / 45
  const cx = (from.x + to.x) / 2 - dy * bend
  const cy = (from.y + to.y) / 2 + dx * bend
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`
}

export default function TopicMap({ graph, selected, onSelect }: TopicMapProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<HTMLDivElement | null>(null)
  // v13: наведённый узел — как в Obsidian: соседи подсвечены, остальное гаснет.
  const [hover, setHover] = React.useState<string | null>(null)
  // v32: перетаскивание узлов (в графе Obsidian точки можно таскать мышью).
  // Позиции перетащенных узлов живут в состоянии — до перезагрузки страницы.
  const [moved, setMoved] = React.useState<Record<string, { x: number; y: number }>>({})
  const dragRef = React.useRef<{
    key: string
    pointerId: number
    dx: number
    dy: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const suppressClick = React.useRef(false)
  // v32: какой узел сейчас тянут (для курсора и отключения перехода)
  const [dragging, setDragging] = React.useState<string | null>(null)

  /** Актуальная точка узла: перетащенная — из состояния, иначе из графа. */
  const pointOf = (key: string, x: number, y: number) => moved[key] ?? { x, y }

  // На узком экране карта шире вьюпорта: стартуем с центра, чтобы
  // направление и лучи были видны без «слепого» свайпа. На десктопе
  // scrollWidth == clientWidth и скрипт ничего не делает.
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const centered = (el.scrollWidth - el.clientWidth) / 2
    if (centered > 0) el.scrollLeft = centered
  }, [graph])

  // v32: указатель в процентах холста — по нему двигаем узел
  const pointFromEvent = (e: React.PointerEvent) => {
    const map = mapRef.current
    if (!map) return null
    const rect = map.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>, key: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const p = pointFromEvent(e)
    if (!p) return
    const node = graph.nodes.find((n) => n.key === key)
    if (!node) return
    const at = pointOf(key, node.x, node.y)
    dragRef.current = {
      key,
      pointerId: e.pointerId,
      dx: p.x - at.x,
      dy: p.y - at.y,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* захват указателя не обязателен */
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    // порог 4px: короткое смещение — это клик, а не перетаскивание
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return
      d.moved = true
      suppressClick.current = true
      setDragging(d.key)
    }
    const p = pointFromEvent(e)
    if (!p) return
    const x = Math.min(98, Math.max(2, p.x - d.dx))
    const y = Math.min(98, Math.max(2, p.y - d.dy))
    setMoved((cur) => ({ ...cur, [d.key]: { x, y } }))
  }

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    dragRef.current = null
    setDragging(null)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* указатель мог быть уже отпущен */
    }
  }

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
        ref={mapRef}
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
          {graph.edges.map((edge, i) => {
            const from = pointOf(edge.fromKey, edge.from.x, edge.from.y)
            const to = pointOf(edge.toKey, edge.to.x, edge.to.y)
            return (
            <path
              key={i}
              d={edgePath(from, to, i)}
              className={`topic-map__edge${
                edge.kind === 'topic' ? ' topic-map__edge--skill' : ''
              }${edgeState(edge)}`}
            />
            )
          })}
        </svg>

        {graph.nodes.map((node) => {
          const at = pointOf(node.key, node.x, node.y)
          const color =
            node.kind === 'center'
              ? 'var(--graph-focus)'
              : WEEK_COLOR[(node.week ?? 1) - 1] ?? 'var(--brand-blue)'
          const style = {
            left: `${at.x}%`,
            top: `${at.y}%`,
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
              }${dragging === node.key ? ' is-dragging' : ''}`}
              style={style}
              onClick={() => {
                // после перетаскивания клик не должен открывать проверку
                if (suppressClick.current) {
                  suppressClick.current = false
                  return
                }
                onSelect(node.key)
              }}
              onPointerDown={(e) => onPointerDown(e, node.key)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
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
