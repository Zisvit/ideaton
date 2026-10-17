import React from 'react'
import Link from 'next/link'
import { EXAMPLE_PROFILE, Profile, saveProfile } from '../lib/api'

const SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'React',
  'Node.js', 'FastAPI', 'Docker', 'Kubernetes',
]
const COURSES = [1, 2, 3, 4]

export default function Home() {
  const [selected, setSelected] = React.useState<string[]>([])
  const [course, setCourse] = React.useState<number | null>(null)
  const [text, setText] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const toggleChip = (chip: string) => {
    setSelected((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    )
  }

  const fillExample = () => {
    saveProfile(EXAMPLE_PROFILE)
    setSelected(EXAMPLE_PROFILE.skills)
    setCourse(EXAMPLE_PROFILE.course ?? null)
    setText('')
    setError(null)
  }

  // Собираем профиль (контракт Profile) и кладём в localStorage → /result.
  const goResult = (e: React.MouseEvent) => {
    const typed = text
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const skills = Array.from(new Set([...selected, ...typed]))
    if (skills.length === 0) {
      e.preventDefault()
      setError('Выбери хотя бы один навык — или нажми «Подставить пример».')
      return
    }
    setError(null)
    const profile: Profile = {
      skills,
      interests: [],
      subjects: [],
      ...(course ? { course } : {}),
    }
    saveProfile(profile)
  }

  const hasSelection = selected.length > 0 || text.trim().length > 0

  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <span className="brand">Карьерный трекер</span>
          <span className="step-pill">Шаг 1 из 3</span>
        </div>
        <div className="step-line" style={{ '--p': '33%' } as React.CSSProperties} />
      </header>

      <main id="main" className="container" style={{ paddingTop: 40, paddingBottom: 24 }}>
        <section className="band fade-in" style={{ paddingTop: 16, paddingBottom: 8 }}>
          <h1 style={{ maxWidth: 660 }}>
            Куда тебе <span className="grad">расти?</span>
          </h1>
          <p className="hero__sub">
            Отметь навыки, которые уже есть — покажу 5 траекторий и план на 30 дней.
            Без резюме и тестов: просто карта маршрута.
          </p>
        </section>

        <section className="card" style={{ marginTop: 28 }}>
          <label className="label" htmlFor="skills-text">Твои навыки</label>
          <textarea
            id="skills-text"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="например: html, css, python, 1с"
            className="input"
          />

          <div className="chips">
            {SKILLS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => toggleChip(chip)}
                className={`chip ${selected.includes(chip) ? 'on' : ''}`}
                aria-pressed={selected.includes(chip)}
              >
                {selected.includes(chip) && <span aria-hidden>✓</span>}
                {chip}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <span className="label">Курс</span>
            <div className="chips" style={{ marginTop: 0 }}>
              {COURSES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCourse(course === c ? null : c)}
                  className={`chip ${course === c ? 'on' : ''}`}
                  aria-pressed={course === c}
                >
                  {c} курс
                </button>
              ))}
            </div>
          </div>

          <div className="row-between" style={{ marginTop: 18 }}>
            <span className="small">
              {hasSelection
                ? `${selected.length} выбрано — этого достаточно`
                : 'Можно выбрать чипы или написать текстом'}
            </span>
            <button type="button" onClick={fillExample} className="btn btn-ghost">
              Подставить пример
            </button>
          </div>

          {error && (
            <div className="alert alert-warn" role="alert" style={{ marginTop: 16 }}>
              {error}
            </div>
          )}
        </section>

        <div className="cta-sticky">
          <Link
            href="/result"
            onClick={goResult}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Показать мои 5 направлений →
          </Link>
          <p className="small" style={{ textAlign: 'center', margin: '10px 0 0' }}>
            Без регистрации. Профиль хранится в браузере.
          </p>
        </div>
      </main>
    </>
  )
}
