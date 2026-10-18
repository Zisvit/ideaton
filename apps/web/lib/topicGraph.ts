/**
 * v7 (совет: раунд 2): «Карта тем» — детерминированный полярный layout без
 * библиотек и без новых keyframes. Вход — пункты плана (те же taskKey, что у
 * чекбоксов), выход — узлы/рёбра для components/TopicMap.tsx.
 *
 * Структура: центр — направление; 4 луча — недели (сверху по часовой);
 * темы — на внешнем кольце вокруг своего луча; рёбра topic↔topic — общий
 * навык (skill из MiniCheck), т.е. «одна тема встречается в разных шагах».
 * Позиции считаются в процентах (0..100) — компонент раскладывает абсолютно.
 */

import type { MiniCheck } from './planChecks'

export type TopicInput = {
  key: string
  week: number
  task: string
  mini: MiniCheck | null
}

export type GraphNode = {
  key: string
  kind: 'center' | 'week' | 'topic'
  label: string
  week?: number
  x: number
  y: number
  testable: boolean
  skill?: string
}

export type GraphEdge = {
  from: { x: number; y: number }
  to: { x: number; y: number }
  kind: 'week' | 'topic'
}

export type TopicGraph = { nodes: GraphNode[]; edges: GraphEdge[] }

const CENTER = { x: 50, y: 50 }
const WEEK_R = 25
const TOPIC_R = 45
const RAD = Math.PI / 180

/** Держим центр узла внутри поля: пилюля шириной до 170 px не должна
 *  вылезать за скруглённую рамку карты (крайние лучи горизонтали). */
function clampPct(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Короткая подпись узла: без «…» внутри слова, хвост обрезается по границе. */
export function shortLabel(text: string, max = 24): string {
  const t = String(text || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

/** Угол луча недели: неделя 1 — сверху, дальше по часовой стрелке. */
function weekAngle(week: number): number {
  return (-90 + (week - 1) * 90) * RAD
}

export function buildTopicGraph(title: string, items: TopicInput[]): TopicGraph {
  const nodes: GraphNode[] = [
    {
      key: 'center',
      kind: 'center',
      label: shortLabel(title || 'Направление', 26),
      x: CENTER.x,
      y: CENTER.y,
      testable: false,
    },
  ]
  const edges: GraphEdge[] = []
  const weekPos = new Map<number, { x: number; y: number }>()

  for (const week of [1, 2, 3, 4]) {
    const angle = weekAngle(week)
    const pos = {
      x: clampPct(CENTER.x + WEEK_R * Math.cos(angle), 16, 84),
      y: clampPct(CENTER.y + WEEK_R * Math.sin(angle), 10, 90),
    }
    weekPos.set(week, pos)
    nodes.push({
      key: `week-${week}`,
      kind: 'week',
      label: `Неделя ${week}`,
      week,
      x: pos.x,
      y: pos.y,
      testable: false,
    })
    edges.push({ from: CENTER, to: pos, kind: 'week' })
  }

  const byWeek = new Map<number, TopicInput[]>()
  for (const item of items) {
    const list = byWeek.get(item.week) || []
    list.push(item)
    byWeek.set(item.week, list)
  }

  for (const [week, list] of byWeek) {
    const base = weekAngle(week)
    const n = list.length
    // дуга вокруг луча: одна тема — ровно на луче, несколько — веером ±38°
    const step = n <= 1 ? 0 : Math.min(26, 76 / (n - 1))
    list.forEach((item, idx) => {
      const offset = n <= 1 ? 0 : (idx - (n - 1) / 2) * step
      const angle = base + offset * RAD
      const pos = {
        x: clampPct(CENTER.x + TOPIC_R * Math.cos(angle), 16, 84),
        y: clampPct(CENTER.y + TOPIC_R * Math.sin(angle), 10, 90),
      }
      nodes.push({
        key: item.key,
        kind: 'topic',
        label: shortLabel(item.mini?.label || item.task),
        week,
        x: pos.x,
        y: pos.y,
        testable: Boolean(item.mini),
        skill: item.mini?.skill,
      })
      const anchor = weekPos.get(week) || CENTER
      edges.push({ from: anchor, to: pos, kind: 'week' })
    })
  }

  // рёбра topic↔topic по общему навыку (детерминированно, без дублей)
  const topics = nodes.filter((n) => n.kind === 'topic')
  const seen = new Set<string>()
  for (let i = 0; i < topics.length; i++) {
    for (let j = i + 1; j < topics.length; j++) {
      const a = topics[i]
      const b = topics[j]
      if (!a.skill || a.skill !== b.skill) continue
      const [first, second] = a.key < b.key ? [a, b] : [b, a]
      const id = `${a.skill}|${first.key}|${second.key}`
      if (seen.has(id)) continue
      seen.add(id)
      edges.push({
        from: { x: first.x, y: first.y },
        to: { x: second.x, y: second.y },
        kind: 'topic',
      })
    }
  }

  return { nodes, edges }
}
