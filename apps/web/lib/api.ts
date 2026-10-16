/**
 * API client for the Career Tracker application.
 * Handles fetching with error handling, loading states, and type safety.
 *
 * Типы ниже — контракт packages/contracts/openapi.yaml (источник истины):
 * recommend → { roles: [5 × RoleScore] }, plan → { weeks: [4 × Week], checklist },
 * chat → { reply, sources }, ошибки 400/404/422 → { error }.
 */

// ---- контрактные типы (openapi.yaml) ---------------------------------------

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
  why: string[] // контракт: массив human-причин, minItems 1
  matched?: string[]
  gaps: string[]
}

type RecommendResponse = {
  roles: RoleScore[] // ровно 5, по убыванию score
}

type Week = {
  n: number // 1–4
  tasks: string[]
}

type PlanResponse = {
  weeks: Week[] // ровно 4
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

// ---- профиль в localStorage (перетекает между страницами демо-флоу) --------

const PROFILE_KEY = 'career-tracker-profile'
const ROLE_KEY = 'career-tracker-role'

// Пример профиля — дословно из openapi.yaml (example /recommend).
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

// ---- fetch-обёртка ----------------------------------------------------------

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
}

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
  const {
    method = 'GET',
    body,
    headers = {},
    timeout = 15000,
  } = options

  const signal = AbortSignal.timeout(timeout)

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    cache: 'no-store',
    signal,
  }

  if (body !== undefined) {
    config.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config)

    const data = (await response.json()) as {
      success: boolean
      error?: string // контракт ErrorResponse {error}
      detail?: string // FastAPI-фолбэк
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.detail || `HTTP ${response.status}`,
      }
    }

    return {
      success: true,
      data: data as T,
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Превышено время ожидания ответа сервера',
      }
    }

    const message =
      error.message ||
      (error.error && error.error.message) ||
      'Произошла ошибка при подключении к серверу'

    return {
      success: false,
      error: message,
    }
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