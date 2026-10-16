import React from 'react'
import Link from 'next/link'
import {
  apiFetch,
  getStoredProfile,
  RecommendResponse,
  RoleScore,
  saveRoleId,
} from '../lib/api'

export default function Result() {
  const [roles, setRoles] = React.useState<RoleScore[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Контракт: POST /recommend { profile } → { roles: [5 × RoleScore] }
  const fetchResults = async () => {
    setLoading(true)
    setError(null)
    const res = await apiFetch<RecommendResponse>('/recommend', {
      method: 'POST',
      body: { profile: getStoredProfile() },
    })
    if (res.success && res.data) {
      setRoles(res.data.roles)
    } else {
      setRoles([])
      setError(res.error || 'Неизвестная ошибка')
    }
    setLoading(false)
  }

  React.useEffect(() => {
    fetchResults()
  }, [])

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Топ-5 подходящих направлений</h1>

        {loading && (
          <div className="animate-pulse rounded bg-white p-8">
            <span className="sr-only">Загрузка...</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded bg-red-100 text-red-800">
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {roles.map((role) => (
            <div
              key={role.role_id}
              className="p-6 rounded-xl bg-white shadow-sm border-l-4 border-primary-500 hover:shadow-md transition-shadow"
            >
              <h2 className="text-xl font-bold mb-2">{role.title}</h2>
              <p className="text-gray-600 line-clamp-3">
                {role.why.join(' · ')}
              </p>
              {role.gaps.length > 0 && (
                <p className="mt-2 text-sm text-amber-700">
                  Пробелы: {role.gaps.join('; ')}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-500">Соответствие: </span>
                  <span
                    className={`text-primary-600 font-medium px-2 py-1 rounded text-xs ${role.score > 80 ? 'bg-primary-100' : ''}`}
                  >
                    {role.score}%
                  </span>
                </div>
                <Link
                  href="/plan"
                  onClick={() => saveRoleId(role.role_id)}
                  className="text-primary-600 hover:underline text-sm font-medium"
                >
                  План на 30 дней →
                </Link>
              </div>
            </div>
          ))}

          {roles.length === 0 && !loading && !error && (
            <p className="text-gray-500">
              Заполните профиль на странице «Ввод», чтобы получить
              рекомендации.
            </p>
          )}
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <button
            onClick={fetchResults}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg text-lg font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-opacity"
          >
            Обновить рекомендации
          </button>
        </div>
      </div>
    </main>
  )
}
