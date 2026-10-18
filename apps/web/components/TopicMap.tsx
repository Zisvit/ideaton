/**
 * v7: «Карта тем» — мини-граф в стиле Obsidian: SVG-рёбра + HTML-узлы.
 * Узлы-темы — настоящие кнопки (фокус с клавиатуры, 44px-зона), центр и
 * недели — статичные подписи. Никаких библиотек и новых keyframes.
 * На узких экранах карта не сжимается до нечитаемого: обёртка даёт
 * горизонтальный скролл (карта фиксированной ширины), см. globals.css.
 */

import React from 'react'
import type { TopicGraph } from '../lib/topicGraph'

type TopicMapProps = {
  graph: TopicGraph
  selected: string | null
  onSelect: (key: string) => void
}

export default function TopicMap({ graph, selected, onSelect }: TopicMapProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  // На узком экране карта шире вьюпорта: стартуем с центра, чтобы
  // направление и лучи были видны без «слепого» свайпа. На десктопе
  // scrollWidth == clientWidth и скрипт ничего не делает.
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const centered = (el.scrollWidth - el.clientWidth) / 2
    if (centered > 0) el.scrollLeft = centered
  }, [graph])

  return (
    <div className="topic-map-scroll" ref={scrollRef}>
      <div className="topic-map" role="group" aria-label="Карта тем тестирований">
        <svg
          className="topic-map__edges"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {graph.edges.map((edge, i) => (
            <line
              key={i}
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              className={
                edge.kind === 'topic'
                  ? 'topic-map__edge topic-map__edge--skill'
                  : 'topic-map__edge'
              }
            />
          ))}
        </svg>

        {graph.nodes.map((node) => {
          const style = {
            left: `${node.x}%`,
            top: `${node.y}%`,
          } as React.CSSProperties

          if (node.kind === 'center') {
            return (
              <div
                key={node.key}
                className="topic-node topic-node--center"
                style={style}
                title={node.label}
              >
                {node.label}
              </div>
            )
          }
          if (node.kind === 'week') {
            return (
              <div
                key={node.key}
                className="topic-node topic-node--week"
                style={style}
              >
                {node.label}
              </div>
            )
          }
          return (
            <button
              key={node.key}
              type="button"
              className={`topic-node topic-node--topic${
                node.testable ? ' is-testable' : ''
              }${selected === node.key ? ' is-selected' : ''}`}
              style={style}
              onClick={() => onSelect(node.key)}
              aria-pressed={selected === node.key}
              title={node.label}
            >
              <span className="topic-node__dot" aria-hidden="true" />
              <span className="topic-node__text">{node.label}</span>
            </button>
          )
        })}

        <div className="topic-map__legend" aria-hidden="true">
          <span className="topic-map__legend-item">
            <i className="topic-map__legend-line" /> луч недели
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
