import React from 'react'
import Link from 'next/link'
import {
  apiFetch,
  getStoredProfile,
  getStoredRoleId,
  PlanResponse,
} from '../lib/api'

export default function Plan() {
  const [plan, setPlan] = React.useState<PlanResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Контракт: POST /plan { role_id, profile } → { weeks: [4 × Week], checklist }
  const fetchPlan = async () => {
    setLoading(true)
    setError(null)
    const res = await apiFetch<PlanResponse>('/plan', {
      method: 'POST',
      body: { role_id: getStoredRoleId(), profile: getStoredProfile() },
    })
    if (res.success && res.data) {
      setPlan(res.data)
    } else {
      setPlan(null)
      setError(res.error || 'Неизвестная ошибка')
    }
    setLoading(false)
  }

  React.useEffect(() => {
    fetchPlan()
  }, [])

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">
          План на 30 дней{plan ? `: ${plan.title}` : ''}
        </h1>

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

        {plan && (
          <div className="space-y-6">
            {plan.weeks.map((week) => (
              <section
                key={week.n}
                className="p-6 rounded-xl bg-white shadow-sm"
              >
                <h2 className="text-lg font-bold mb-3">Неделя {week.n}</h2>
                <ul className="list-disc pl-5 space-y-1 text-gray-700">
                  {week.tasks.map((task, i) => (
                    <li key={i}>{task}</li>
                  ))}
                </ul>
              </section>
            ))}

            {plan.checklist.length > 0 && (
              <section className="p-6 rounded-xl bg-white shadow-sm">
                <h2 className="text-lg font-bold mb-3">Чек-лист прогресса</h2>
                <ul className="list-disc pl-5 space-y-1 text-gray-700">
                  {plan.checklist.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </section>
            )}

            {plan.disclaimer && (
              <p className="text-sm text-gray-500">{plan.disclaimer}</p>
            )}

            <div className="pt-4 border-t border-gray-200">
              <Link href="/consultant" className="text-primary-600 hover:underline">
                Задать вопрос консультанту →
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
