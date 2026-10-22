import React from 'react'
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
  // v29: поиск по навыкам — 67 чипов одним списком не прочитать
  const [query, setQuery] = React.useState('')

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const reset = () => setSelected(new Set<string>())

  // v29: видимые чипы = все навыки, отфильтрованные поиском
  const visibleSkills = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SKILL_OPTIONS
    return SKILL_OPTIONS.filter((s) => s.name.toLowerCase().includes(q))
  }, [query])

  // v29: организации — из учебной базы (для витрины в герое)
  const orgCount = React.useMemo(() => {
    const set = new Set<string>()
    for (const spec of SPECS) for (const e of spec.employers) set.add(e)
    return set.size
  }, [])

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

      <main id="main" className="container" style={{ paddingTop: 40, paddingBottom: 88 }}>
        {/* v29: герой в две колонки — как на главной */}
        <section className="hero-grid fade-in">
          <div className="hero-main">
            <p className="supernova">SUPERNOVA</p>
            <h1 className="hero-title">
              Кого готовит <span className="grad">колледж?</span>
            </h1>
            <p className="hero__sub">
              Каталог из {SPECS.length} направлений: навыки выпускника и
              организации, где он может работать. Отметьте навыки — покажу
              подходящие направления.
            </p>
            <div className="hero__actions">
              <a className="btn btn-primary" href="#employer-filters">
                Отметить навыки ↓
              </a>
            </div>
          </div>
          <aside className="hero-side">
            <div className="preview-card">
              <span className="preview-card__eyebrow">Учебная база</span>
              <p className="preview-card__title">Что умеет выпускник</p>
              <p className="preview-card__sub">
                Данные сайта колледжа: навыки, роли и организации
              </p>
              <div className="preview-list">
                <div className="preview-row">
                  <div>
                    <div className="preview-row__name">{SPECS.length} направлений</div>
                    <div className="preview-row__meta">сгруппированы по сферам</div>
                  </div>
                </div>
                <div className="preview-row">
                  <div>
                    <div className="preview-row__name">{SKILL_OPTIONS.length} навыков</div>
                    <div className="preview-row__meta">с фильтром и поиском</div>
                  </div>
                </div>
                <div className="preview-row">
                  <div>
                    <div className="preview-row__name">{orgCount} организаций</div>
                    <div className="preview-row__meta">где работают выпускники</div>
                  </div>
                </div>
              </div>
              <p className="preview-foot">
                Без персональных данных: только учебная база колледжа.
              </p>
            </div>
          </aside>
        </section>

        <section
          className="card picker employer-filters"
          id="employer-filters"
          style={{ marginTop: 28 }}
          aria-labelledby="filter-heading"
        >
          <div className="picker__head">
            <span className="label" id="filter-heading" style={{ marginBottom: 0 }}>
              Навыки для отбора
            </span>
            <span className="picker__count" aria-live="polite">
              {selected.size === 0
                ? `Показано направлений: ${SPECS.length}`
                : `Найдено ${filtered.length} из ${SPECS.length}`}
            </span>
          </div>
          {/* v29: поиск по навыкам — 67 чипов не прочитать одним списком */}
          <div className="employer-search">
            <input
              type="search"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск навыка: html, 1с, бухучёт…"
              aria-label="Поиск навыка"
            />
          </div>
          <div className="chips" style={{ marginTop: 12 }}>
            {visibleSkills.map((skill) => {
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
          {query && visibleSkills.length === 0 && (
            <p className="small" style={{ marginTop: 10 }}>
              По запросу «{query}» навыков не найдено — попробуйте другое слово.
            </p>
          )}
          {selected.size > 0 && (
            <div className="row-between" style={{ marginTop: 14 }}>
              <span className="small">
                Выбрано навыков: {selected.size} — подходят направления, где есть
                все они
              </span>
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Сбросить фильтр
              </button>
            </div>
          )}
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
