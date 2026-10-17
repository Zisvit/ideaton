import React from 'react'
import Link from 'next/link'
import {
  apiFetch,
  getStoredProfile,
  RecommendResponse,
  RoleScore,
  saveRoleId,
} from '../lib/api'

// Цвет-маркер каждой роли (fallback — акцент)
const ROLE_COLORS: Record<string, string> = {
  web: 'var(--role-web)',
  '1c': 'var(--role-1c)',
  qa: 'var(--role-qa)',
  support: 'var(--role-support)',
  startup: 'var(--role-startup)',
}

// Счётчик, плавно бегущий от 0 до target (уважает prefers-reduced-motion)
function useCountUp(target: number, duration = 500): number {
  const [val, setVal] = React.useState(0)
  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

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

  const top = roles[0]
  const rest = roles.slice(1)
  const topScore = useCountUp(top ? top.score : 0)
  // «N из M навыков» — главный счётчик (UX.md:74), % — вторичная строка.
  const hasCounts =
    !!top &&
    typeof top.matched_count === 'number' &&
    typeof top.needed_count === 'number' &&
    top.needed_count > 0
  const topGapCount = top ? top.gaps.length : 0

  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href="/" className="brand">Карьерный трекер</Link>
          <span className="step-pill">Шаг 2 из 3</span>
        </div>
        <div className="step-line" style={{ '--p': '66%' } as React.CSSProperties} />
      </header>

      <main id="main" className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
        <section className="fade-in">
          <h1>Твои 5 направлений</h1>
          <p className="hero__sub">
            Отсортированы по совпадению с твоим профилем. Выбери одно — получишь план на 30 дней.
          </p>
        </section>

        {loading && (
          <div
            style={{ marginTop: 32, display: 'grid', gap: 14 }}
            role="status"
            aria-live="polite"
          >
            <div className="skeleton" style={{ height: 400 }} />
            <div className="skeleton" style={{ height: 120 }} />
            <div className="skeleton" style={{ height: 120 }} />
            <span className="sr-only">Загружаем рекомендации…</span>
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
          <div
            className="stagger"
            style={{ marginTop: 32, display: 'grid', gap: 14 }}
            aria-busy={loading}
          >
            <article className="hero-card fade-in">
              <div className="row-between">
                <span className="tag tag-match">Лучшее совпадение</span>
                {hasCounts ? (
                  <span
                    className="num"
                    style={{ fontSize: 22, lineHeight: 1.2 }}
                    aria-hidden
                  >
                    {top!.matched_count} из {top!.needed_count}
                  </span>
                ) : (
                  <span className="num" style={{ fontSize: 15 }} aria-hidden>
                    {topScore}% совпадение
                  </span>
                )}
                <span className="sr-only">
                  {hasCounts
                    ? `${top!.matched_count} из ${top!.needed_count} ключевых навыков роли`
                    : `${top!.score}% совпадение`}
                </span>
              </div>
              <h2 style={{ marginTop: 16, fontSize: 'clamp(24px,3.4vw,34px)', fontWeight: 600, color: '#fff' }}>
                {top!.title}
              </h2>
              <p className="small" style={{ margin: '10px 0 0', color: 'rgba(255,255,255,.72)' }}>
                {hasCounts
                  ? `${top!.matched_count} из ${top!.needed_count} ключевых навыков роли — в твоём профиле`
                  : ''}
                {hasCounts
                  ? topGapCount > 0
                    ? ` · ${topGapCount} пробелов закрывают недели 1–2 плана`
                    : ' · все ключевые навыки на месте'
                  : ''}
              </p>
              <ul style={{ marginTop: 16, display: 'grid', gap: 6, listStyle: 'none', padding: 0 }}>
                {top.why.map((w, i) => (
                  <li
                    key={i}
                    style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'rgba(255,255,255,.85)', fontSize: 15 }}
                  >
                    <span style={{ color: '#6EE7B7', fontWeight: 700 }} aria-hidden>✓</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
              {top.gaps.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span className="small" style={{ color: 'rgba(255,255,255,.6)' }}>Не хватает:</span>
                  {top.gaps.map((g, i) => (
                    <span key={i} className="tag tag-gap">{g}</span>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 22 }}>
                <Link
                  href="/plan"
                  onClick={() => saveRoleId(top.role_id)}
                  className="btn btn-primary"
                  style={{ background: '#fff', color: '#12141A', boxShadow: 'none' }}
                >
                  Сделать план на 30 дней →
                </Link>
              </div>
            </article>

            {rest.map((role, idx) => (
              <article
                key={role.role_id}
                className="role-card fade-in"
                style={{ '--role': ROLE_COLORS[role.role_id] ?? 'var(--accent)' } as React.CSSProperties}
              >
                <div className="role-card__top">
                  <div>
                    <div className="num-order">#{String(idx + 2).padStart(2, '0')}</div>
                    <h3 className="role-card__title">{role.title}</h3>
                  </div>
                  <span
                    className="score-ring num"
                    title={
                      typeof role.matched_count === 'number' &&
                      typeof role.needed_count === 'number' &&
                      role.needed_count > 0
                        ? `${role.matched_count} из ${role.needed_count} ключевых навыков`
                        : undefined
                    }
                  >
                    {typeof role.matched_count === 'number' &&
                    typeof role.needed_count === 'number' &&
                    role.needed_count > 0
                      ? `${role.matched_count}/${role.needed_count}`
                      : `${role.score}%`}
                  </span>
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
                  <Link
                    href="/plan"
                    onClick={() => saveRoleId(role.role_id)}
                    className="btn btn-ghost"
                    style={{ padding: '8px 14px', fontSize: 14 }}
                  >
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
