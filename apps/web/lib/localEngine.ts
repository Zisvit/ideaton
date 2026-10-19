/**
 * Локальный офлайн-движок (волна v11): точный порт services/api/scoring.py и
 * ручек /recommend, /plan — фолбэк, когда API недоступен.
 *
 * Подключается ТОЛЬКО динамическим import() из result.tsx/plan.tsx, поэтому
 * данные offlineData.json (генерирует scripts/gen_web_data.py) не попадают
 * в основной бандл. Чистые функции: без доступа к DOM и браузерному
 * хранилищу; детерминированно (pyRound, тай-брейк по role_id).
 */

import raw from './offlineData.json'

type SkillReq = { id: string; weight: number }
type ResourceOut = {
  title: string
  url: string
  type?: string | null
  minutes?: number | null
}
type RoleData = {
  id: string
  kind: string
  title: string
  description: string
  skills_required: SkillReq[]
  related_specialties: string[]
  tags: string[]
  development_steps: string[]
  resources: ResourceOut[]
}

// Типы — структурно совместимы с lib/api.ts (RoleScore/PlanResponse/Check).
export type LocalProfile = {
  skills: string[]
  interests: string[]
  subjects: string[]
  course?: number
  specialty?: string
}
export type LocalKind = 'role' | 'specialty'
export type LocalRoleScore = {
  role_id: string
  kind: LocalKind
  title: string
  score: number
  why: string[]
  matched: string[]
  gaps: string[]
  matched_count: number
  needed_count: number
}
export type LocalCheck = {
  id: string
  prompt: string
  kind: 'self' | 'choice'
  options: string[]
  correct: number | null
  hint: string
  source: string
  skill: string
  week: number
}
export type LocalWeek = { n: number; tasks: string[] }
export type LocalPlan = {
  weeks: LocalWeek[]
  checklist: string[]
  role_id: string
  title: string
  steps: string[]
  resources: ResourceOut[]
  gaps: string[]
  summary: string
  disclaimer: string
  profile_hash: string
  llm_used: 'stub'
  cached: boolean
  checks: LocalCheck[]
}

const ROLES = raw.roles as unknown as RoleData[]
const ALIASES = raw.aliases as Record<string, string>
const SKILL_NAMES = raw.skill_names as Record<string, string>
const STR = raw.strings as Record<string, string>
const CONST = raw.constants as {
  defaultLimit: number
  interestBonusCap: number
  gapTaskLimit: number
  checkForbiddenWords: string[]
}
const BONUS_CAP = CONST.interestBonusCap

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** str().strip().lower() из Python — ключ нормализации. */
const nkey = (s: unknown) => String(s).trim().toLowerCase()

/** Банковское округление Python (round half to even), x ≥ 0. */
export function pyRound(x: number): number {
  const f = Math.floor(x)
  const d = x - f
  if (d === 0.5) return f % 2 === 0 ? f : f + 1
  return d < 0.5 ? f : f + 1
}

/** Подстановка {name}-плейсхолдеров (без replaceAll — target ES2017). */
const fmt = (tpl: string, vars: Record<string, string | number>): string =>
  Object.keys(vars).reduce(
    (s, k) => s.split(`{${k}}`).join(String(vars[k])),
    tpl
  )

/** scoring.normalize_skill: alias → canonical id (иначе lower/strip). */
const normalize = (skill: string): string => {
  const k = nkey(skill)
  return ALIASES[k] ?? k
}

function roleTags(role: RoleData): Set<string> {
  const tags = new Set<string>()
  for (const t of role.tags || []) {
    const s = nkey(t)
    if (s) tags.add(s)
  }
  for (const s of role.related_specialties || []) {
    const s2 = nkey(s)
    if (s2) tags.add(s2)
  }
  return tags
}

type Scored = {
  score: number
  matched: string[]
  gaps: string[]
  overlap: string[]
  matched_count: number
  needed_count: number
}
type Row = Scored & { role_id: string; title: string; role: RoleData }

function scoreRole(profile: LocalProfile, role: RoleData): Scored {
  const profileSkills = new Set((profile.skills || []).map(normalize))
  const matched: string[] = []
  let weightsSum = 0
  let rawScore = 0
  for (const req of role.skills_required || []) {
    const rid = nkey(req.id ?? '')
    const weight = Number(req.weight ?? 0)
    weightsSum += weight
    if (rid && profileSkills.has(rid)) {
      matched.push(rid)
      rawScore += weight
    }
  }
  const interests = new Set((profile.interests || []).map(nkey))
  const tags = roleTags(role)
  const overlap: string[] = []
  for (const i of interests) if (tags.has(i)) overlap.push(i)
  rawScore += Math.min(overlap.length, BONUS_CAP)
  const maxRaw = weightsSum + BONUS_CAP
  let score = maxRaw > 0 ? pyRound((100 * rawScore) / maxRaw) : 0
  score = Math.max(0, Math.min(100, score))

  const needed = new Set<string>()
  for (const req of role.skills_required || []) {
    if (req.id) needed.add(nkey(req.id))
  }
  const gaps = [...needed].filter((g) => !profileSkills.has(g)).sort(cmp)
  const covered = new Set<string>()
  for (const m of matched) {
    const k = nkey(m)
    if (m && needed.has(k)) covered.add(k)
  }
  return {
    score,
    matched,
    gaps,
    overlap: overlap.sort(cmp),
    matched_count: covered.size,
    needed_count: needed.size,
  }
}

function buildWhy(
  profile: LocalProfile,
  role: RoleData,
  matched: string[],
  overlap: string[]
): string[] {
  const why: string[] = []
  if (matched.length) {
    const shown: string[] = []
    for (const req of role.skills_required || []) {
      const rid = nkey(req.id ?? '')
      if (matched.includes(rid)) shown.push(SKILL_NAMES[rid] ?? rid)
    }
    why.push(STR.whyMatched + (shown.length ? shown.join(', ') : matched.join(', ')))
  }
  if (overlap.length) why.push(STR.whyInterests + overlap.join(', '))
  const specialty = nkey(profile.specialty ?? '')
  if (specialty) {
    for (const spec of role.related_specialties || []) {
      if (specialty === nkey(spec)) {
        why.push(
          fmt(STR.whySpecialty, { specialty: String(profile.specialty ?? '') })
        )
        break
      }
    }
  }
  const subjects = new Set((profile.subjects || []).map(nkey))
  if (subjects.size) {
    // Порт 1:1: в Python описание склеивается по СИМВОЛАМ (" ".join(строка))
    // и приводится к нижнему регистру; теги уже нормализованы в roleTags.
    const joined =
      Array.from(String(role.description ?? '')).join(' ').toLowerCase() +
      ' ' +
      Array.from(roleTags(role)).join(' ')
    const hit = [...subjects].filter((s) => s && joined.includes(s)).sort(cmp)
    if (hit.length) why.push(STR.whySubjects + hit.join(', '))
  }
  if (!why.length) why.push(STR.whyNoMatch)
  return why
}

/** scoring.rank_roles: полный проход по ROLES, сортировка (−score, role_id). */
function rankRows(profile: LocalProfile): Row[] {
  const rows: Row[] = ROLES.map((role) => {
    const scored = scoreRole(profile, role)
    return { ...scored, role_id: role.id, title: role.title || role.id, role }
  })
  rows.sort((a, b) => b.score - a.score || cmp(a.role_id, b.role_id))
  return rows
}

/** scoring.gap_tasks: пробелы по (−weight, id), лимит 3. Без дедупа — как в Python. */
function gapTasks(profile: LocalProfile, role: RoleData): string[] {
  if (
    !(profile.skills?.length || profile.interests?.length || profile.subjects?.length)
  ) {
    return []
  }
  const prof = new Set((profile.skills || []).map(normalize))
  const missing: { weight: number; id: string }[] = []
  for (const req of role.skills_required || []) {
    const rid = nkey(req.id ?? '')
    if (rid && !prof.has(rid)) {
      missing.push({ weight: Number(req.weight ?? 0), id: rid })
    }
  }
  missing.sort((a, b) => b.weight - a.weight || cmp(a.id, b.id))
  return missing
    .slice(0, CONST.gapTaskLimit)
    .map((m) => fmt(STR.gapTask, { name: SKILL_NAMES[m.id] ?? m.id }))
}

const EMPTY_PROFILE_ERROR =
  'Пустой профиль: заполните хотя бы skills, interests или subjects'

export type LocalRecommendData = {
  roles: LocalRoleScore[]
  items: LocalRoleScore[]
  profile_hash: string
  cached: boolean
}
export type LocalFallbackData = {
  error: string
  profile_hash: string
  fallback: {
    role_id: string
    kind: string
    title: string
    score: number
    why: string[]
    matched: string[]
    gaps: string[]
  }[]
}
export type LocalResponse<T> = { ok: boolean; status: number; data: T }
export type LocalRecommendResult =
  | { ok: true; status: number; data: LocalRecommendData }
  | { ok: false; status: number; data: LocalFallbackData }

/** Порт POST /recommend: пустой профиль → 400 + fallback (по id, лимит 12). */
export function recommendLocal(profile: LocalProfile): LocalRecommendResult {
  const limit = CONST.defaultLimit
  if (
    !(profile.skills?.length || profile.interests?.length || profile.subjects?.length)
  ) {
    const fallback = [...ROLES]
      .sort((a, b) => cmp(a.id, b.id))
      .slice(0, limit)
      .map((r) => ({
        role_id: r.id,
        kind: r.kind || 'role',
        title: r.title || r.id,
        score: 0,
        why: [STR.emptyProfileWhy],
        matched: [] as string[],
        gaps: [] as string[],
      }))
    return {
      ok: false,
      status: 400,
      data: { error: EMPTY_PROFILE_ERROR, profile_hash: '', fallback },
    }
  }
  const roles: LocalRoleScore[] = rankRows(profile)
    .slice(0, limit)
    .map((row) => ({
      role_id: row.role_id,
      kind: (row.role.kind || 'role') as LocalKind,
      title: row.title,
      score: row.score,
      why: buildWhy(profile, row.role, row.matched, row.overlap),
      matched: row.matched,
      gaps: row.gaps.map((g) => fmt(STR.gapHuman, { name: SKILL_NAMES[g] ?? g })),
      matched_count: row.matched_count,
      needed_count: row.needed_count,
    }))
  return {
    ok: true,
    status: 200,
    data: { roles, items: roles, profile_hash: '', cached: false },
  }
}

/** main._build_checks: CHOICE «Что делает X?» + SELF «объясни своими словами». */
function buildChecks(role: RoleData): LocalCheck[] {
  const rid = role.id || ''
  const title = role.title || rid
  const description = role.description || ''
  if (!description) return []
  const forbidden = CONST.checkForbiddenWords
  const bad = (s: string) => forbidden.some((w) => s.toLowerCase().includes(w))
  if (bad(description)) return []

  const ownKind = role.kind || 'role'
  const others = ROLES.filter(
    (r) => r.id !== rid && r.description && !bad(String(r.description))
  )
  others.sort((a, b) => {
    const ka = (a.kind || 'role') !== ownKind ? 1 : 0
    const kb = (b.kind || 'role') !== ownKind ? 1 : 0
    return ka - kb || cmp(a.id, b.id)
  })
  const checks: LocalCheck[] = []
  if (others.length >= 2) {
    const pos = rid.length % 3 // web→1, 1c→2, qa→0, support→1, startup→2
    const options = [others[0].description, others[1].description]
    options.splice(pos, 0, description)
    checks.push({
      id: `${rid}-what-is`,
      kind: 'choice',
      prompt: fmt(STR.checkChoicePrompt, { title }),
      options,
      correct: pos,
      hint: '',
      source: fmt(STR.checkSource, { id: rid }),
      skill: '',
      week: 4,
    })
  }

  const sk = (role.skills_required || [])
    .filter((s) => s.id)
    .slice()
    .sort((a, b) => b.weight - a.weight || cmp(String(a.id), String(b.id)))
  let skillId = sk.length ? String(sk[0].id) : ''
  const skillName = skillId ? SKILL_NAMES[skillId] ?? skillId : ''
  let prompt: string
  if (skillName) {
    prompt = fmt(STR.checkSelfSkillPrompt, { skill: skillName, title })
  } else {
    prompt = fmt(STR.checkSelfRolePrompt, { title })
    skillId = ''
  }
  checks.push({
    id: `${rid}-own-words`,
    kind: 'self',
    prompt,
    options: [],
    correct: null,
    hint: description,
    source: fmt(STR.checkSource, { id: rid }),
    skill: skillId,
    week: 3,
  })
  return checks
}

/** Порт POST /plan: null — если роли нет или у неё нет рубрики (API отдал бы 404). */
export function planLocal(
  roleId: string,
  profile: LocalProfile
): LocalResponse<LocalPlan> | null {
  const role = ROLES.find((r) => r.id === roleId)
  if (!role) return null
  const steps = (role.development_steps || []).map((s) => String(s))
  if (!steps.length) return null

  const scored = scoreRole(profile, role)
  const personal = gapTasks(profile, role)
  const personalSlots: Record<number, string[]> = {
    1: personal.slice(0, 2),
    2: personal.slice(2, 3),
  }
  const weeks: LocalWeek[] = []
  for (let n = 1; n <= 4; n++) {
    let tasks: string[] = []
    for (let i = n - 1; i < steps.length; i += 4) tasks.push(steps[i])
    for (const extra of personalSlots[n] ?? []) {
      if (!tasks.includes(extra)) tasks.unshift(extra)
    }
    if (!tasks.length) tasks = [steps[(n - 1) % steps.length]]
    weeks.push({ n, tasks })
  }

  const gaps = scored.gaps
  const checklist = gaps.length
    ? gaps.map((g) => fmt(STR.checklistDone, { id: g }))
    : [STR.checklistFull]
  const resources = (role.resources || [])
    .filter((r) => r.title && r.url)
    .map((r) => ({
      title: r.title,
      url: r.url,
      type: r.type ?? null,
      minutes: r.minutes ?? null,
    }))
  const title = role.title || roleId
  let summary = fmt(STR.summary, {
    title,
    steps: steps.length,
    gaps: gaps.length,
  })
  if (personal.length) summary += fmt(STR.summaryPersonal, { n: personal.length })

  const data: LocalPlan = {
    weeks,
    checklist,
    role_id: roleId,
    title,
    steps,
    resources,
    gaps: gaps.map((g) => fmt(STR.gapHuman, { name: SKILL_NAMES[g] ?? g })),
    summary,
    disclaimer: STR.disclaimer,
    profile_hash: '',
    llm_used: 'stub',
    cached: false,
    checks: buildChecks(role),
  }
  return { ok: true, status: 200, data }
}
