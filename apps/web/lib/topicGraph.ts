/**
 * v7 + v13 + v32: «Карта тем» — детерминированный layout без библиотек и без
 * новых keyframes. Вход — пункты плана (те же taskKey, что у чекбоксов),
 * выход — узлы/рёбра для components/TopicMap.tsx.
 *
 * v32: раскладка стала силовой — как граф Obsidian: пружины по рёбрам плюс
 * отталкивание, поэтому узлы лежат свободным созвездием, а не «солнцем» с
 * лучами. Симуляция детерминированная (Math.random запрещён — SSR-стабильность):
 * стартовые позиции считаются из джиттера, дальше только арифметика.
 *
 * Структура: центр — направление; 4 луча — недели; темы — рядом со своей
 * неделей. Рёбра topic↔topic — общий навык (skill из MiniCheck); у рёбер
 * есть ключи концов (fromKey/toKey), у узлов — degree: размер точки и
 * подсветка соседей. Позиции — в процентах (0..100) по осям.
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
  /** v13: число рёбер узла — размер точки в obsidian-виде TopicMap. */
  degree?: number
}

export type GraphEdge = {
  from: { x: number; y: number }
  to: { x: number; y: number }
  kind: 'week' | 'topic'
  /** v13: ключи концов ребра — подсветка соседей при hover/выборе. */
  fromKey: string
  toKey: string
}

export type TopicGraph = { nodes: GraphNode[]; edges: GraphEdge[] }

const CENTER = { x: 50, y: 50 }
const WEEK_R = 25
const TOPIC_R = 45
const RAD = Math.PI / 180

/** v32: холст графа 16:9 — x считаем в «визуальных» единицах (домножаем на
 *  аспект), иначе пружины смещают узлы вбок и облако вытягивается. */
const ASPECT = 16 / 9
/** Параметры силовой раскладки (подобраны на глаз по рендеру). */
const RELAX_ITER = 220
const REPULSE = 215
const SPRING = 0.05
const REST = 14
const GRAVITY = 0.008
const DAMP = 0.32

/** v13: детерминированный хэш (без Math.random — SSR-стабильность). */
function hashInt(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Джиттер −span…+span: темы уходят с идеальной окружности — «созвездие». */
function jitter(key: string, span: number): number {
  return ((hashInt(key) % 1001) / 1000 - 0.5) * 2 * span
}

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

/**
 * v32: детерминированная силовая раскладка (граф Obsidian).
 *
 * Пружины по рёбрам (у каждой — своя длина покоя) + попарное отталкивание +
 * слабая гравитация к центру. Никаких библиотек и Math.random: результат
 * одинаков на сервере и клиенте (SSR-стабильность — гейт v13).
 */
function relax(nodes: GraphNode[], edges: GraphEdge[]): void {
  const index = new Map(nodes.map((n, i) => [n.key, i]))
  const pos = nodes.map((n) => ({ x: n.x, y: n.y }))
  const disp = nodes.map(() => ({ x: 0, y: 0 }))

  for (let step = 0; step < RELAX_ITER; step++) {
    for (const d of disp) {
      d.x = 0
      d.y = 0
    }
    // отталкивание всех пар
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = (pos[j].x - pos[i].x) * ASPECT
        const dy = pos[j].y - pos[i].y
        const d2 = Math.max(dx * dx + dy * dy, 0.05)
        const d = Math.sqrt(d2)
        const f = REPULSE / d2
        // силы считаем в визуальных единицах, а позиции — в процентах:
        // x делим на аспект, иначе горизонтальная часть силы в 1.78 раза
        // сильнее нужной и граф схлопывается по горизонтали
        disp[i].x -= ((dx / d) * f) / ASPECT
        disp[i].y -= (dy / d) * f
        disp[j].x += ((dx / d) * f) / ASPECT
        disp[j].y += (dy / d) * f
      }
    }
    // пружины по рёбрам
    for (const edge of edges) {
      const a = index.get(edge.fromKey)
      const b = index.get(edge.toKey)
      if (a === undefined || b === undefined) continue
      const dx = (pos[b].x - pos[a].x) * ASPECT
      const dy = pos[b].y - pos[a].y
      const d = Math.max(Math.hypot(dx, dy), 0.01)
      // неделя держит темы короче, чем тема — соседа по навыку
      const rest = edge.kind === 'week' ? REST : REST * 1.35
      const f = (d - rest) * SPRING
      disp[a].x += ((dx / d) * f) / ASPECT
      disp[a].y += (dy / d) * f
      disp[b].x -= ((dx / d) * f) / ASPECT
      disp[b].y -= (dy / d) * f
    }
    // гравитация: направление — в центр, недели — крепче, темы — слабее
    for (let i = 0; i < nodes.length; i++) {
      const kind = nodes[i].kind
      const g = kind === 'center' ? 0.004 : GRAVITY * (kind === 'week' ? 1.8 : 0.85)
      disp[i].x -= (pos[i].x - 50) * g
      disp[i].y -= (pos[i].y - 50) * g
    }
    // интеграция с затуханием + рамка поля
    for (let i = 0; i < nodes.length; i++) {
      pos[i].x = clampPct(pos[i].x + disp[i].x * DAMP, 8, 92)
      pos[i].y = clampPct(pos[i].y + disp[i].y * DAMP, 11, 89)
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    nodes[i].x = Math.round(pos[i].x * 10) / 10
    nodes[i].y = Math.round(pos[i].y * 10) / 10
  }
  // рёбра переезжают вместе с узлами
  for (const edge of edges) {
    const a = nodes[index.get(edge.fromKey)!]
    const b = nodes[index.get(edge.toKey)!]
    edge.from = { x: a.x, y: a.y }
    edge.to = { x: b.x, y: b.y }
  }
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
    edges.push({ from: CENTER, to: pos, kind: 'week', fromKey: 'center', toKey: `week-${week}` })
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
      // v13: детерминированный джиттер — «облако» вместо строгого кольца
      const angle = base + (offset + jitter(item.key + ':a', 5)) * RAD
      const radius = TOPIC_R + jitter(item.key + ':r', 5)
      const pos = {
        x: clampPct(CENTER.x + radius * Math.cos(angle), 16, 84),
        y: clampPct(CENTER.y + radius * Math.sin(angle), 10, 90),
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
      edges.push({
        from: anchor,
        to: pos,
        kind: 'week',
        fromKey: weekPos.has(week) ? `week-${week}` : 'center',
        toKey: item.key,
      })
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
        fromKey: first.key,
        toKey: second.key,
      })
    }
  }

  // v13: степень узла (число рёбер) — размер точки в TopicMap
  const degree = new Map<string, number>()
  for (const edge of edges) {
    degree.set(edge.fromKey, (degree.get(edge.fromKey) || 0) + 1)
    degree.set(edge.toKey, (degree.get(edge.toKey) || 0) + 1)
  }
  for (const node of nodes) node.degree = degree.get(node.key) || 0

  // v32: свободная силовая раскладка вместо «солнца с лучами» — граф Obsidian
  relax(nodes, edges)

  return { nodes, edges }
}
