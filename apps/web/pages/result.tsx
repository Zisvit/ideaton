import React from 'react'
import Image from 'next/image'

type Match = {
  title: string
  why: string
  matchScore: number
}

export default function Result() {
  const [matches, setMatches] = React.useState<Match[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const fetchResults = async (query: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        cache: 'no-store',
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Ошибка сервера')
      }

      const data = await res.json()
      setMatches(data)
    } catch (e: any) {
      setError(e.message || 'Неизвестная ошибка')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    const storedQuery = localStorage.getItem('career-tracker-query')
    if (storedQuery) {
      fetchResults(storedQuery)
    } else {
      fetchResults('Python TypeScript React')
    }
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
          {matches.map((match, i) => (
            <div
              key={i}
              className="p-6 rounded-xl bg-white shadow-sm border-l-4 border-primary-500 hover:shadow-md transition-shadow"
            >
              <h2 className="text-xl font-bold mb-2">{match.title}</h2>
              <p className="text-gray-600 line-clamp-3">{match.why}</p>
              <div className="mt-4">
                <span className="text-sm text-gray-500">Соответствие: </span>
                <span
                  className={`text-primary-600 font-medium px-2 py-1 rounded text-xs ${match.matchScore > 80 ? 'bg-primary-100' : ''}`}
                >
                  {match.matchScore}%
                </span>
              </div>
            </div>
          ))}

          {matches.length === 0 && (
            <p className="text-gray-500">Введите запрос на странице «Ввод», чтобы получить рекомендации.</p>
          )}
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <button
            onClick={() => {
              const input = document.querySelector('textarea') as HTMLTextAreaElement | null
              if (input && input.value.trim()) {
                fetchResults(input.value.trim())
                localStorage.setItem('career-tracker-query', input.value.trim())
              } else {
                fetchResults('Python TypeScript React')
                localStorage.setItem('career-tracker-query', 'Python TypeScript React')
              }
            }}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg text-lg font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-opacity"
          >
            Обновить рекомендации
          </button>
        </div>
      </div>
    </main>
  )
}
