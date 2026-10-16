/**
 * API client for the Career Tracker application.
 * Handles fetching with error handling, loading states, and type safety.
 */

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
      detail?: string
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.detail || `HTTP ${response.status}`,
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

export { BASE_URL }