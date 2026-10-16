import React from 'react'
import {
  apiFetch,
  ChatResponse,
  getStoredProfile,
  getStoredRoleId,
} from '../lib/api'

type ConsultantState = {
  chat: ChatResponse | null
  loading: boolean
  error: string | null
  input: string
}

export default function Consultant() {
  const [state, setState] = React.useState<ConsultantState>({
    chat: null,
    loading: false,
    error: null,
    input: '',
  })

  // Контракт: POST /chat { message, profile, role_id } → { reply, sources }
  const ask = async (question: string) => {
    setState({ ...state, loading: true, error: null })
    const res = await apiFetch<ChatResponse>('/chat', {
      method: 'POST',
      body: {
        message: question,
        profile: getStoredProfile(),
        role_id: getStoredRoleId(),
      },
    })
    if (res.success && res.data) {
      setState({ ...state, chat: res.data, loading: false })
    } else {
      setState({
        ...state,
        chat: null,
        error: res.error || 'Неизвестная ошибка',
        loading: false,
      })
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

          {state.chat && (
            <div className="p-4 rounded bg-gray-800 text-white">
              <p>
                <strong>Консультант:</strong> {state.chat.reply}
              </p>
              {state.chat.sources.length > 0 && (
                <p className="mt-3 text-xs text-gray-400">
                  Источники: {state.chat.sources.join('; ')}
                </p>
              )}
            </div>
          )}

          {state.loading && !state.chat && (
            <p className="text-gray-500">Формируется ответ...</p>
          )}
        </div>
      </div>
    </main>
  )
}
