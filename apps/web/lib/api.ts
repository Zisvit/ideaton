/**
 * API client for the Career Tracker application.
 * Контракт: packages/contracts/openapi.yaml (источник истины).
 */

type Profile = {
  skills: string[]
  interests: string[]
  subjects: string[]
  course?: number
  specialty?: string
}

type RoleScore = {
  role_id: string
  // v7: role — карьерная роль, specialty — специальность колледжа
  kind?: 'role' | 'specialty'
  title: string
  score: number
  why: string[]
  matched?: string[]
  gaps: string[]
  // «N из M навыков» вместо голого процента (UX.md:74) — бэкенд отдаёт всегда
  matched_count?: number
  needed_count?: number
}

type RecommendResponse = {
  roles: RoleScore[]
}

type Week = { n: number; tasks: string[] }

type Check = {
  id: string
  prompt: string
  kind: 'self' | 'choice'
  options?: string[]
  correct?: number | null
  hint?: string
  source?: string
  skill?: string
  week?: number
}

type PlanResponse = {
  weeks: Week[]
  checklist: string[]
  role_id: string
  title: string
  summary?: string
  disclaimer?: string
  cached?: boolean
  // Аддитивное поле /plan: рендерим только при непустом массиве (no-signal)
  checks?: Check[]
}

type ChatResponse = {
  reply: string
  sources: string[]
  // режим консультанта: stub (демо) | external (живой LLM) — для честного бейджа
  llm_used?: 'stub' | 'external'
}

const PROFILE_KEY = 'career-tracker-profile'
const ROLE_KEY = 'career-tracker-role'
const doneKey = (roleId: string) => `career-tracker-done:${roleId}`

const EXAMPLE_PROFILE: Profile = {
  skills: ['python', 'git', 'html'],
  interests: ['веб-разработка', 'аналитика'],
  subjects: ['базы данных', 'алгоритмы'],
  course: 4,
  specialty: 'Информационные системы и технологии',
}

// ---- Хранилище: localStorage, иначе in-memory (гостевой/приватный режим) ----
// Гостевой браузер выбрасывает на любом обращении к localStorage — берём в
// Map в памяти (живёт до перезагрузки), а isGuestMode() даёт UI сказать правду.
const memoryStore = new Map<string, string>()
let storageProbe: boolean | null = null

function storageAvailable(): boolean {
  if (typeof window === 'undefined') return false
  if (storageProbe !== null) return storageProbe
  try {
    const probe = '__tracker_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    storageProbe = true
  } catch {
    storageProbe = false
  }
  return storageProbe
}

export function isGuestMode(): boolean {
  return typeof window !== 'undefined' && !storageAvailable()
}

function readStore(key: string): string | null {
  if (typeof window === 'undefined') return null
  if (storageAvailable()) return window.localStorage.getItem(key)
  return memoryStore.get(key) ?? null
}

function writeStore(key: string, value: string): void {
  if (typeof window === 'undefined') return
  if (storageAvailable()) {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      /* квота переполнена — без падения уходит в память */
      memoryStore.set(key, value)
    }
  } else {
    memoryStore.set(key, value)
  }
}

function getStoredProfile(): Profile {
  if (typeof window === 'undefined') return { ...EXAMPLE_PROFILE }
  const raw = readStore(PROFILE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Profile>
      return {
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        interests: Array.isArray(parsed.interests) ? parsed.interests : [],
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
        course: typeof parsed.course === 'number' ? parsed.course : undefined,
        specialty: typeof parsed.specialty === 'string' ? parsed.specialty : undefined,
      }
    } catch {
      /* битый JSON — откат к примеру */
    }
  }
  return { ...EXAMPLE_PROFILE }
}

function saveProfile(profile: Profile) {
  writeStore(PROFILE_KEY, JSON.stringify(profile))
}

function getStoredRoleId(): string {
  if (typeof window === 'undefined') return 'web'
  return readStore(ROLE_KEY) || 'web'
}

function saveRoleId(roleId: string) {
  writeStore(ROLE_KEY, roleId)
}

// ---- v7: последние рекомендации (id/title/kind) — подпись на /plan ----
// Храним только «визитки» направлений: план не тянет /recommend повторно,
// а бейдж «специальность/роль» переживает F5. Полные карточки — на /result.
type RoleRef = { role_id: string; title: string; kind?: 'role' | 'specialty' }
const ROLES_KEY = 'career-tracker-roles:v1'

function getRoles(): RoleRef[] {
  const raw = readStore(ROLES_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => item as RoleRef)
      .filter((item) => typeof item.role_id === 'string')
  } catch {
    return []
  }
}

function saveRoles(roles: RoleRef[]): void {
  if (!Array.isArray(roles)) return
  const slim = roles.map((role) => ({
    role_id: role.role_id,
    title: role.title,
    kind: role.kind,
  }))
  writeStore(ROLES_KEY, JSON.stringify(slim))
}

// ---- Прогресс плана: done-отметки живут по роли (раньше терялись при F5) ----
function getDone(roleId: string): Record<string, boolean> {
  const raw = readStore(doneKey(roleId))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const clean: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(parsed)) clean[k] = v === true
    return clean
  } catch {
    return {}
  }
}

function saveDone(roleId: string, done: Record<string, boolean>): void {
  writeStore(doneKey(roleId), JSON.stringify(done))
}

// ---- Самопроверка понимания: результат хранится по роли, НЕ подмешивается в done ----
// (pickle, красная команда: чужой ключ сдвигает doneCount → ложное «пройдено»)
const checksKey = (roleId: string) => `career-tracker-checks:${roleId}`

function getChecks(roleId: string): Record<string, boolean> {
  const raw = readStore(checksKey(roleId))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const clean: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(parsed)) clean[k] = v === true
    return clean
  } catch {
    return {}
  }
}

function saveChecks(roleId: string, checks: Record<string, boolean>): void {
  writeStore(checksKey(roleId), JSON.stringify(checks))
}

// ---- v6: мини-проверки пунктов плана — СВОЁ хранилище, versioned (deepseek) ----
// Отдельно от done («сделал») и checks («Проверь, что понял»); ключ mini:v1 —
// контракт формы мог бы измениться: старая карта не читается, а не врёт.
const miniKey = (roleId: string) => `career-tracker-mini:v1:${roleId}`

function getMini(roleId: string): Record<string, boolean> {
  const raw = readStore(miniKey(roleId))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const clean: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(parsed)) clean[k] = v === true
    return clean
  } catch {
    return {} // битый JSON → пустая карта (deepseek, раунд 2)
  }
}

function saveMini(roleId: string, mini: Record<string, boolean>): void {
  writeStore(miniKey(roleId), JSON.stringify(mini))
}

type ApiResponse<T> = { success: boolean; data?: T; error?: string }

type FetchOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
  timeout?: number
}

// v9: 127.0.0.1, а не localhost — на Linux ::1 идёт первым (reads IPv6),
// API слушает только IPv4 → флапающий «Failed to fetch» (space-bunny, раунд 2).
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

// Safari < 16.4 не знает AbortSignal.timeout: прямой вызов бросал TypeError
// ДО try и /result висел вечным скелетоном без кнопки «Повторить»
// (space-bunny, раунд 2). Фолбэк ручной и живёт внутри try.
function makeTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms)
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

// Тело читаем как текст: не-JSON (500 text/plain, HTML) ронял
// response.json() в SyntaxError, и сырой английский текст уходил в UI.
async function readJsonBody(
  response: Response
): Promise<{ error?: string; detail?: string } | null> {
  try {
    const text = await response.text()
    if (!text) return null
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object'
      ? (parsed as { error?: string; detail?: string })
      : null
  } catch {
    return null
  }
}

// Сеть/таймаут — человеческий текст вместо сырого «Failed to fetch»;
// диагностика уходит в console.warn (таблица совета, раунд 2).
function humanNetworkError(error: unknown): string {
  const name = (error as { name?: string } | null)?.name
  if (name === 'AbortError' || name === 'TimeoutError') {
    return 'Превышено время ожидания ответа сервера'
  }
  return 'Не удалось связаться с сервером. Проверь, запущен ли API, и попробуй ещё раз.'
}

export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {}, timeout = 15000 } = options
  try {
    const config: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      cache: 'no-store',
      signal: makeTimeoutSignal(timeout),
    }
    if (body !== undefined) config.body = JSON.stringify(body)

    const response = await fetch(`${BASE_URL}${endpoint}`, config)
    const data = await readJsonBody(response)
    if (!response.ok) {
      if (data?.error || data?.detail) {
        return { success: false, error: data.error || data.detail }
      }
      if (response.status >= 500) {
        return { success: false, error: 'Сервер временно недоступен. Попробуй чуть позже.' }
      }
      return { success: false, error: `HTTP ${response.status}` }
    }
    if (!data) {
      return { success: false, error: 'Сервер вернул неожиданный ответ. Попробуй ещё раз.' }
    }
    return { success: true, data: data as T }
  } catch (error) {
    console.warn('apiFetch', error)
    return { success: false, error: humanNetworkError(error) }
  }
}

export {
  BASE_URL,
  EXAMPLE_PROFILE,
  getStoredProfile,
  saveProfile,
  getStoredRoleId,
  saveRoleId,
  getRoles,
  saveRoles,
  getDone,
  saveDone,
  getChecks,
  saveChecks,
  getMini,
  saveMini,
}
export type { Profile, RoleScore, RecommendResponse, Week, PlanResponse, ChatResponse, Check, RoleRef }
