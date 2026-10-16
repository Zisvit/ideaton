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

  const top = roles[0]
  const rest = roles.slice(1)

  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href="/" className="brand">Карьерный трекер</Link>
          <span className="step-pill">Шаг 2 из 3</span>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
        <section className="fade-in">
          <h1>Твои 5 направлений</h1>
          <p className="hero__sub">
            Отсортированы по совпадению с твоим профилем. Выбери одно — получишь план на 30 дней.
          </p>
        </section>

        {loading && (
          <div style={{ marginTop: 32, display: 'grid', gap: 14 }}>
            <div className="skeleton" style={{ height: 180 }} />
            <div className="skeleton" style={{ height: 110 }} />
            <div className="skeleton" style={{ height: 110 }} />
          </div>
        )}

        {error && (
          <div className="alert alert-warn" style={{ marginTop: 24 }} role="alert">
            {error}
            <div style={{ marginTop: 10 }}>
              <button onClick={fetchResults} className="btn btn-ghost">Повторить</button>
            </div>
          </div>
        )}

        {!loading && !error && roles.length === 0 && (
          <div className="empty">
            <h3>Профиль пуст</h3>
            <p>Заполни навыки на первой странице — и получишь рекомендации.</p>
            <div style={{ marginTop: 16 }}>
              <Link href="/" className="btn btn-primary">Заполнить профиль</Link>
            </div>
          </div>
        )}

        {!loading && top && (
          <div className="stagger" style={{ marginTop: 32, display: 'grid', gap: 14 }}>
            <article className="hero-card fade-in">
              <div className="row-between">
                <span className="tag tag-match">Лучшее совпадение</span>
                <span className="score-ring" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>
                  {top.score}% совпадение
                </span>
              </div>
              <h2 style={{ marginTop: 16, fontSize: 'clamp(26px,4vw,40px)', color: '#fff' }}>{top.title}</h2>
              <ul style={{ marginTop: 16, display: 'grid', gap: 6, listStyle: 'none', padding: 0 }}>
                {top.why.map((w, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'rgba(255,255,255,.85)', fontSize: 15 }}>
                    <span style={{ color: '#6EE7B7', fontWeight: 700 }}>✓</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
              {top.gaps.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span className="small" style={{ color: 'rgba(255,255,255,.6)' }}>Не хватает:</span>
                  {top.gaps.map((g, i) => (
                    <span key={i} className="tag tag-gap">{g}</span>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 22 }}>
                <Link href="/plan" onClick={() => saveRoleId(top.role_id)} className="btn btn-primary" style={{ background: '#fff', color: '#12141A', boxShadow: 'none' }}>
                  Сделать план на 30 дней →
                </Link>
              </div>
            </article>

            {rest.map((role, idx) => (
              <article key={role.role_id} className="role-card fade-in">
                <div className="role-card__top">
                  <div>
                    <div className="small" style={{ marginBottom: 4 }}>#{idx + 2}</div>
                    <h3 className="role-card__title">{role.title}</h3>
                  </div>
                  <span className="score-ring">{role.score}%</span>
                </div>
                <p className="role-card__why">{role.why.join(' · ')}</p>
                {role.gaps.length > 0 && (
                  <div className="role-card__gaps">
                    {role.gaps.map((g, i) => (
                      <span key={i} className="tag tag-gap">{g}</span>
                    ))}
                  </div>
                )}
                <div className="role-card__foot">
                  <span className="small">Совпадение {role.score}%</span>
                  <Link href="/plan" onClick={() => saveRoleId(role.role_id)} className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 14 }}>
                    План →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && roles.length > 0 && (
          <div className="cta-bar">
            <button onClick={fetchResults} className="btn btn-ghost">
              Обновить рекомендации
            </button>
          </div>
        )}
      </main>
    </>
  )
}
