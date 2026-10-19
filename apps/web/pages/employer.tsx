import React from 'react'
import Link from 'next/link'
import ThemeToggle from '../components/ThemeToggle'
import DirectionGroups from '../components/DirectionGroups'
import { SpecialtyCardData } from '../components/DirectionCard'
import specialties from '../lib/specialties.json'

// v14 (совет 7/9): интерфейс работодателя — каталог направлений колледжа с
// фильтром по навыкам. Только агрегаты учебной базы (навыки направлений):
// никаких профилей студентов. Данные статические — страница работает и в
// гостевом режиме, и без сети, и не ходит в API (localStorage не использует).
// v15 (совет 7/9): направления сгруппированы по сферам (общий DirectionGroups);
// пустые после фильтра группы не показываются, «Найдено N из 21» — прежний.
const SPECS = specialties as SpecialtyCardData[]

type SkillOption = { id: string; name: string; count: number }

// Опции фильтра: навыки всех направлений, дедуп по id. Порядок — по частоте
// (сколько направлений учат навыку), затем по id: детерминированно, без
// Math.random и без locale-зависимых сортировок.
const SKILL_OPTIONS: SkillOption[] = (() => {
  const byId = new Map<string, SkillOption>()
  for (const spec of SPECS) {
    for (const skill of spec.skills) {
      const cur = byId.get(skill.id)
      if (cur) cur.count += 1
      else byId.set(skill.id, { id: skill.id, name: skill.name, count: 1 })
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => b.count - a.count || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
})()

export default function Employer() {
  const [selected, setSelected] = React.useState<Set<string>>(new Set<string>())

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const reset = () => setSelected(new Set<string>())

  // «И»-логика: направление подходит, если учит ВСЕМ выбранным навыкам.
  // Пустой выбор — весь каталог (21).
  const filtered =
    selected.size === 0
      ? SPECS
      : SPECS.filter((spec) =>
          Array.from(selected).every((id) =>
            spec.skills.some((skill) => skill.id === id)
          )
        )

  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href="/" className="brand">Карьерный трекер</Link>
          <div className="site-header__side">
            <ThemeToggle />
            {/* кросс-ссылка на студенческий интерфейс — маршрут, без JS */}
            <Link
              href="/"
              className="btn btn-ghost"
              style={{ padding: '6px 12px', fontSize: 13 }}
            >
              Я студент
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="container" style={{ paddingTop: 40, paddingBottom: 88 }}>
        <section className="band fade-in" style={{ paddingTop: 16, paddingBottom: 8 }}>
          <h1 style={{ maxWidth: 720 }}>
            Кого готовит <span className="grad">колледж?</span>
          </h1>
          <p className="hero__sub">
            Каталог из {SPECS.length} направлений: навыки выпускника и
            организации, где он может работать. Отметьте навыки — покажу
            подходящие направления.
          </p>
        </section>

        <section
          className="card employer-filters"
          style={{ marginTop: 28 }}
          aria-labelledby="filter-heading"
        >
          <span className="label" id="filter-heading">Навыки для отбора</span>
          <div className="chips" style={{ marginTop: 0 }}>
            {SKILL_OPTIONS.map((skill) => {
              const active = selected.has(skill.id)
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggle(skill.id)}
                  className={`chip chip-sm ${active ? 'on' : ''}`}
                  aria-pressed={active}
                >
                  {skill.name}
                </button>
              )
            })}
          </div>
          <div className="row-between" style={{ marginTop: 14 }}>
            <span className="small" aria-live="polite">
              {selected.size === 0
                ? `Показано направлений: ${SPECS.length}`
                : `Найдено ${filtered.length} из ${SPECS.length}`}
            </span>
            {selected.size > 0 && (
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Сбросить фильтр
              </button>
            )}
          </div>
        </section>

        {filtered.length === 0 ? (
          <div className="empty" role="status" style={{ marginTop: 24 }}>
            <h3>Ничего не найдено</h3>
            <p>
              Ни одно направление не учит всем выбранным навыкам сразу —
              снимите часть фильтров.
            </p>
            <div style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-primary" onClick={reset}>
                Сбросить фильтр
              </button>
            </div>
          </div>
        ) : (
          <DirectionGroups specs={filtered} variant="employer" />
        )}
      </main>
    </>
  )
}
