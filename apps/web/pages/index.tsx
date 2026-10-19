import React from 'react'
import Link from 'next/link'
import { isGuestMode, pickExample, Profile, saveProfile } from '../lib/api'
import { INTRO_MS, prefersReducedMotion, shouldShowIntro } from '../lib/intro'
import ThemeToggle from '../components/ThemeToggle'
import DirectionCard, { SpecialtyCardData } from '../components/DirectionCard'
import specialties from '../lib/specialties.json'

// v14 (совет 7/9): FastAPI/Docker/Kubernetes не резолвились ни в одну роль,
// ни в специальность (мёртвые чипы — проверено по offlineData) — заменены на
// Git/HTML/CSS: они есть в базе ролей и подбираются после клика.
const SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'React',
  'Node.js', 'Git', 'HTML', 'CSS',
]
// v7: второй ряд — не-IT сферы 21 специальности СИУЭиП. Значения — синонимы
// из data/roles/skills.yaml (точное совпадение после lowercase в scoring).
const SKILLS_LIFE = [
  'Уход', 'Бухучёт', 'Право', 'Педагогика',
  'Дизайн', 'Электромонтаж', 'Сети', 'Торговля',
]
// v14: третий ряд — навыки специальностей, которым не хватало своего чипа.
// Каждый резолвится в skills.yaml и связан минимум с одним направлением
// колледжа; вместе с первыми двумя рядами покрытие витрины — 21/21.
const SKILLS_SPEC = [
  'Банковские продукты', 'Услуги красоты', 'Графические редакторы',
  'Инфокоммуникационные системы', 'Судебное делопроизводство',
  'Лекарственные средства', 'Тренировочный процесс', 'Социальная помощь',
]
const COURSES = [1, 2, 3, 4]

// v13 (совет 7/9): витрина всех 21 специальности колледжа на главной.
// Данные — сгенерированный specialties.json (тот же источник, что offlineData);
// статический импорт: маленький файл, полный SSR, чанк движка не тронут.
// v14: разметка карточки — в общем DirectionCard (её же получает /employer),
// внутри — блок «Где/Кем можно работать» со страниц сайта колледжа.
const SPECS = specialties as SpecialtyCardData[]

export default function Home() {
  const [selected, setSelected] = React.useState<string[]>([])
  const [course, setCourse] = React.useState<number | null>(null)
  const [text, setText] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  // Баннер только когда localStorage реально недоступен (гостевой режим) —
  // в обычном режиме не пугаем «профиль в браузере» пояснениями.
  const [guest, setGuest] = React.useState(false)
  React.useEffect(() => {
    setGuest(isGuestMode())
    // v6: conic-рамка — ЕДИНЫЙ оборот (transition 12s, НЕ keyframe-бесконеч-
    // ность, гейты §8 соблюены), старт после интро (или ≤300ms, если интро
    // пропущено). is-swept-done снимает слой (teardown, big-pickle).
    const card = document.querySelector('.fx-conic')
    const delay =
      shouldShowIntro() && !prefersReducedMotion() ? INTRO_MS + 120 : 300
    const t1 = window.setTimeout(() => card?.classList.add('is-swept'), delay)
    const t2 = window.setTimeout(
      () => card?.classList.add('is-swept-done'),
      delay + 12300
    )
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  const toggleChip = (chip: string) => {
    setSelected((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    )
  }

  // v11: каждый клик — новый пример (без повтора подряд). Чипами подсвечиваем
  // только точные строки SKILLS/SKILLS_LIFE, остальные навыки — в textarea.
  const fillExample = () => {
    const picked = pickExample()
    saveProfile(picked)
    const allChips = [...SKILLS, ...SKILLS_LIFE, ...SKILLS_SPEC]
    const chipFor = (skill: string) =>
      allChips.find((chip) => chip.toLowerCase() === skill.trim().toLowerCase())
    const chips = Array.from(
      new Set(picked.skills.map(chipFor).filter((c): c is string => Boolean(c)))
    )
    const rest = picked.skills.filter((skill) => !chipFor(skill))
    setSelected(chips)
    setText(rest.join(', '))
    setCourse(picked.course ?? null)
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
          <div className="site-header__side">
            <ThemeToggle />
            {/* v14: кросс-ссылка на интерфейс работодателя — маршрут, без JS */}
            <Link
              href="/employer"
              className="btn btn-ghost"
              style={{ padding: '6px 12px', fontSize: 13 }}
            >
              Я работодатель
            </Link>
            <span className="step-pill">Шаг 1 из 3</span>
          </div>
        </div>
        <div className="step-line" style={{ '--p': '33%' } as React.CSSProperties} />
      </header>

      <main id="main" className="container" style={{ paddingTop: 40, paddingBottom: 88 }}>
        <section className="band fade-in" style={{ paddingTop: 16, paddingBottom: 8 }}>
          <h1 style={{ maxWidth: 660 }}>
            Куда тебе <span className="grad">расти?</span>
          </h1>
          <p className="hero__sub">
            Отметь навыки, которые уже есть — покажу до 12 направлений: карьерные
            роли и специальности колледжа — и план на 30 дней. Без резюме и
            тестов: просто карта маршрута.
          </p>
        </section>

        {guest && (
          <p className="small" role="status" style={{ marginTop: 12 }}>
            Гостевой режим: профиль сохранится только до перезагрузки страницы.
          </p>
        )}

        <section className="card fx-conic" style={{ marginTop: 28 }}>
          <label className="label" htmlFor="skills-text">Твои навыки</label>
          <textarea
            id="skills-text"
            rows={2}
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
                {chip}
              </button>
            ))}
          </div>

          <div className="chips" style={{ marginTop: 8 }}>
            {SKILLS_LIFE.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => toggleChip(chip)}
                className={`chip chip-sm ${selected.includes(chip) ? 'on' : ''}`}
                aria-pressed={selected.includes(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="chips" style={{ marginTop: 8 }}>
            {SKILLS_SPEC.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => toggleChip(chip)}
                className={`chip chip-sm ${selected.includes(chip) ? 'on' : ''}`}
                aria-pressed={selected.includes(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
          <p className="small" style={{ margin: '8px 0 0' }}>
            Не только IT: специальности колледжа — в той же базе направлений.
          </p>

          <div style={{ marginTop: 20 }}>
            <span className="label">Курс</span>
            <div className="chips" style={{ marginTop: 0 }}>
              {COURSES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCourse(course === c ? null : c)}
                  className={`chip chip-sm ${course === c ? 'on' : ''}`}
                  aria-pressed={course === c}
                  aria-label={`${c} курс`}
                >
                  {c}
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

        {/* v14: кнопка подбора — сразу под формой (к витрине тянуться не надо);
            сам CTA не менялся, только позиция в DOM. */}
        <div className="cta-sticky">
          <Link
            href="/result"
            onClick={goResult}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', boxShadow: 'none' }}
          >
            Показать мои направления →
          </Link>
        </div>

        {/* v13 (совет 7/9): витрина всех направлений колледжа — 21 карточка
            с навыками. Данные из specialties.json, клик не мутирует профиль.
            v14: карточка — общий DirectionCard (showcase), внутри связка
            «Где/Кем можно работать» со страниц сайта колледжа. */}
        <section
          className="spec-section"
          aria-labelledby="spec-heading"
          style={{ marginTop: 36 }}
        >
          <h2 id="spec-heading" style={{ fontSize: 20, marginBottom: 6 }}>
            Направления колледжа — {SPECS.length}
          </h2>
          <p className="small" style={{ margin: '0 0 14px' }}>
            Навыки каждого направления и места работы его выпускников — данные
            сайта колледжа. Отметь знакомые наверху — подбор покажет, что
            подходит именно тебе.
          </p>
          <div className="spec-grid">
            {SPECS.map((spec) => (
              <DirectionCard key={spec.id} spec={spec} />
            ))}
          </div>
        </section>
      </main>
    </>
  )
}
