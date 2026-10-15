import React from 'react'

type ConsultantState = {
  response: string | null
  loading: boolean
  error: string | null
  input: string
}

export default function Consultant() {
  const [state, setState] = React.useState<ConsultantState>({
    response: null,
    loading: false,
    error: null,
    input: '',
  })

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const ask = async (question: string) => {
    setState({ ...state, loading: true, error: null })
    try {
      const res = await fetch(`${apiBase}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
        cache: 'no-store',
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Ошибка консультанта')
      }

      const data = await res.json()
      setState({ ...state, response: data.answer || 'Нет ответа', loading: false })
    } catch (e: any) {
      setState({ ...state, error: e.message || 'Неизвестная ошибка', loading: false })
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Консультант</h1>

        <div className="space-y-4">
          <div>
            <textarea
              placeholder="Задайте вопрос консультанту..."
              rows={3}
              value={state.input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setState({ ...state, input: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
            />
            <button
              onClick={() => state.input && ask(state.input)}
              className="mt-2 px-6 py-3 bg-primary-600 text-white rounded-lg text-lg font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-opacity"
              disabled={state.loading}
            >
              {state.loading ? 'Отправка...' : 'Отправить'}
            </button>
          </div>

          {state.error && (
            <div className="p-4 rounded bg-red-100 text-red-800">
              <p>{state.error}</p>
            </div>
          )}

          {state.response && (
            <div className="p-4 rounded bg-gray-800 text-white">
              <p><strong>Консультант:</strong> {state.response}</p>
            </div>
          )}

          {state.loading && !state.response && (
            <p className="text-gray-500">Формируется ответ...</p>
          )}
        </div>
      </div>
    </main>
  )
}
