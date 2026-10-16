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
  title: string
  score: number
  why: string[]
  matched?: string[]
  gaps: string[]
}

type RecommendResponse = {
  roles: RoleScore[]
}

type Week = { n: number; tasks: string[] }

type PlanResponse = {
  weeks: Week[]
  checklist: string[]
  role_id: string
  title: string
  summary?: string
  disclaimer?: string
}

type ChatResponse = {
  reply: string
  sources: string[]
}

const PROFILE_KEY = 'career-tracker-profile'
const ROLE_KEY = 'career-tracker-role'

const EXAMPLE_PROFILE: Profile = {
  skills: ['python', 'git', 'html'],
  interests: ['веб-разработка', 'аналитика'],
  subjects: ['базы данных', 'алгоритмы'],
  course: 4,
  specialty: 'Информационные системы и технологии',
}

function getStoredProfile(): Profile {
  if (typeof window === 'undefined') return { ...EXAMPLE_PROFILE }
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Profile>
      return {
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        interests: Array.isArray(parsed.interests) ? parsed.interests : [],
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
        course: typeof parsed.course === 'number' ? parsed.course : undefined,
        specialty: typeof parsed.specialty === 'string' ? parsed.specialty : undefined,
      }
    }
  } catch {
    /* битый localStorage — откат к примеру */
  }
  return { ...EXAMPLE_PROFILE }
}

function saveProfile(profile: Profile) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

function getStoredRoleId(): string {
  if (typeof window === 'undefined') return 'web'
  return window.localStorage.getItem(ROLE_KEY) || 'web'
}

function saveRoleId(roleId: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ROLE_KEY, roleId)
}

type ApiResponse<T> = { success: boolean; data?: T; error?: string }

type FetchOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
  timeout?: number
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {}, timeout = 15000 } = options
  const signal = AbortSignal.timeout(timeout)
  const config: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    cache: 'no-store',
    signal,
  }
  if (body !== undefined) config.body = JSON.stringify(body)

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config)
    const data = (await response.json()) as { error?: string; detail?: string }
    if (!response.ok) {
      return { success: false, error: data.error || data.detail || `HTTP ${response.status}` }
    }
    return { success: true, data: data as T }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Превышено время ожидания ответа сервера' }
    }
    return { success: false, error: error.message || 'Произошла ошибка при подключении к серверу' }
  }
}

export {
  BASE_URL,
  EXAMPLE_PROFILE,
  getStoredProfile,
  saveProfile,
  getStoredRoleId,
  saveRoleId,
}
export type { Profile, RoleScore, RecommendResponse, Week, PlanResponse, ChatResponse }
