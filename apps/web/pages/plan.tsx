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
  const [done, setDone] = React.useState<Record<string, boolean>>({})

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

  const toggle = (key: string) => setDone((d) => ({ ...d, [key]: !d[key] }))
  const totalTasks = plan ? plan.weeks.reduce((a, w) => a + w.tasks.length, 0) : 0
  const doneCount = Object.values(done).filter(Boolean).length

  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href="/" className="brand">Карьерный трекер</Link>
          <span className="step-pill">Шаг 3 из 3</span>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
        <section className="fade-in">
          <h1>План на 30 дней{plan ? `: ${plan.title}` : ''}</h1>
          <p className="hero__sub">
            Конкретные шаги по неделям. Отмечай выполненные — прогресс сохраняется в браузере.
          </p>
        </section>

        {loading && (
          <div style={{ marginTop: 32, display: 'grid', gap: 14 }}>
            <div className="skeleton" style={{ height: 120 }} />
            <div className="skeleton" style={{ height: 120 }} />
            <div className="skeleton" style={{ height: 120 }} />
          </div>
        )}

        {error && (
          <div className="alert alert-warn" style={{ marginTop: 24 }} role="alert">
            {error}
            <div style={{ marginTop: 10 }}>
              <button onClick={fetchPlan} className="btn btn-ghost">Повторить</button>
            </div>
          </div>
        )}

        {plan && (
          <>
            <div className="card" style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="small" style={{ marginBottom: 6 }}>Прогресс</div>
                <div className="progress">
                  <span style={{ width: `${totalTasks ? (doneCount / totalTasks) * 100 : 0}%` }} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{doneCount}/{totalTasks}</div>
                <div className="small">задач выполнено</div>
              </div>
            </div>

            <div className="stagger" style={{ marginTop: 24, display: 'grid', gap: 14 }}>
              {plan.weeks.map((week) => (
                <section key={week.n} className="week fade-in">
                  <div className="week__title">
                    <span className="week__num">{week.n}</span>
                    Неделя {week.n}
                  </div>
                  <ul>
                    {week.tasks.map((task, i) => {
                      const key = `${week.n}-${i}`
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            className="check"
                            onClick={() => toggle(key)}
                            aria-pressed={!!done[key]}
                            style={done[key] ? { background: 'var(--match)', borderColor: 'var(--match)' } : {}}
                          />
                          <span style={done[key] ? { textDecoration: 'line-through', color: 'var(--muted)' } : {}}>{task}</span>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>

            {plan.checklist.length > 0 && (
              <section className="checklist" style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 18, marginBottom: 12 }}>Чек-лист пробелов</h2>
                <ul>
                  {plan.checklist.map((item, i) => (
                    <li key={i}>
                      <span className="check" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {plan.disclaimer && (
              <p className="disclaimer" style={{ marginTop: 20 }}>{plan.disclaimer}</p>
            )}

            <div className="cta-bar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/consultant" className="btn btn-primary">Задать вопрос консультанту →</Link>
              <Link href="/result" className="btn btn-ghost">Сменить направление</Link>
            </div>
          </>
        )}
      </main>
    </>
  )
}
