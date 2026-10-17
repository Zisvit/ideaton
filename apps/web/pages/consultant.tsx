import React from 'react'
import Link from 'next/link'
import {
  apiFetch,
  ChatResponse,
  getStoredProfile,
  getStoredRoleId,
} from '../lib/api'

const SUGGESTIONS = [
  'С чего начать учить React?',
  'Где взять первую практику?',
  'Что показать в портфолио?',
]

export default function Consultant() {
  const [input, setInput] = React.useState('')
  const [chat, setChat] = React.useState<ChatResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Контракт: POST /chat { message, profile, role_id } → { reply, sources[] }
  const ask = async (question: string) => {
    if (!question.trim()) return
    setLoading(true)
    setError(null)
    const res = await apiFetch<ChatResponse>('/chat', {
      method: 'POST',
      body: {
        message: question,
        profile: getStoredProfile(),
        role_id: getStoredRoleId(),
      },
    })
    if (res.success && res.data) {
      setChat(res.data)
    } else {
      setError(res.error || 'Неизвестная ошибка')
    }
    setLoading(false)
  }

  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href="/" className="brand">Карьерный трекер</Link>
          <span className="step-pill">Консультант</span>
        </div>
        <div className="step-line" style={{ '--p': '100%' } as React.CSSProperties} />
      </header>

      <main id="main" className="container" style={{ paddingTop: 40, paddingBottom: 80, maxWidth: 760 }}>
        <section className="fade-in">
          <h1>
            <span className="grad">Консультант</span>
          </h1>
          <p className="hero__sub">
            Задай вопрос по выбранному направлению — отвечу только по рубрике, без выдумок.
          </p>
        </section>

        <section className="card" style={{ marginTop: 28 }}>
          <textarea
            placeholder="Например: с чего начать учить React?"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="input"
            aria-label="Вопрос консультанту"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                ask(input)
              }
            }}
          />
          <div className="row-between" style={{ marginTop: 12, alignItems: 'center' }}>
            <div className="suggest" style={{ marginTop: 0 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => { setInput(s); ask(s) }}>
                  {s}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => ask(input)}
              className="btn btn-primary"
              disabled={loading || !input.trim()}
            >
              {loading ? 'Думаю…' : 'Отправить'}
            </button>
          </div>
        </section>

        {error && (
          <div className="alert alert-warn" style={{ marginTop: 20 }} role="alert">
            {error}
          </div>
        )}

        {loading && !chat && (
          <div
            role="status"
            aria-live="polite"
            style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)' }}
          >
            <span className="loader" aria-hidden><span /><span /><span /></span>
            Формируется ответ…
          </div>
        )}

        {chat && (
          <div className="chat-bubble fade-in" style={{ marginTop: 24 }} aria-live="polite">
            <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{chat.reply}</p>
            {chat.sources.length > 0 && (
              <p className="sources">Источники: {chat.sources.join('; ')}</p>
            )}
          </div>
        )}

        <div className="cta-bar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/plan" className="btn btn-ghost">← К плану</Link>
          <Link href="/result" className="btn btn-ghost">Сменить направление</Link>
        </div>
      </main>
    </>
  )
}
