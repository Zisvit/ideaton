import React from 'react'
import Link from 'next/link'
import { isGuestMode, pickExample, Profile, saveProfile } from '../lib/api'
import { INTRO_MS, prefersReducedMotion, shouldShowIntro } from '../lib/intro'
import ThemeToggle from '../components/ThemeToggle'
import DirectionGroups from '../components/DirectionGroups'
import { SpecialtyCardData } from '../components/DirectionCard'
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
    // пропущено). v17c: сцену закрыли раньше — стартуем по событию intro:done,
    // не ждём страховочный +120. is-swept-done снимает слой (teardown).
    const card = document.querySelector('.fx-conic')
    const delay =
      shouldShowIntro() && !prefersReducedMotion() ? INTRO_MS + 120 : 300
    let sweepTimer = 0
    let doneTimer = 0
    const startConic = () => {
      window.clearTimeout(sweepTimer)
      window.clearTimeout(doneTimer)
      // bfcache: index не перемонтируется, teardown-класс с прошлого показа
      // остался — снимаем его, иначе conic не сделает новый оборот
      card?.classList.remove('is-swept-done')
      card?.classList.add('is-swept')
      doneTimer = window.setTimeout(
        () => card?.classList.add('is-swept-done'),
        12300
      )
    }
    sweepTimer = window.setTimeout(startConic, delay)
    doneTimer = window.setTimeout(
      () => card?.classList.add('is-swept-done'),
      delay + 12300
    )
    window.addEventListener('intro:done', startConic)
    return () => {
      window.clearTimeout(sweepTimer)
      window.clearTimeout(doneTimer)
      window.removeEventListener('intro:done', startConic)
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
              className="btn btn-ghost header-employer-link"
              style={{ padding: '6px 12px', fontSize: 13 }}
            >
              Я работодатель
            </Link>
            <span className="step-pill">Шаг 1 из 3</span>
          </div>
        </div>
        <div className="step-line" style={{ '--p': '33%' } as React.CSSProperties} />
      </header>

      <main id="main" className="container page-index" style={{ paddingTop: 40, paddingBottom: 88 }}>
        {/* v31: герой в две колонки — слева обещание и действия, справа
            «стеклянное» превью выдачи и карточка «маршрут». Чистый CSS, без blur. */}
        <section className="hero-grid fade-in">
          <div className="hero-main">
            {/* v16: капсовый вордмарк; «переливание» — два градиентных слоя
                на opacity (fadeIn), без новых keyframes. v17c: второй слой —
                ::after, в innerText/копировании одна «SUPERNOVA». */}
            <p className="supernova">SUPERNOVA</p>
            <h1 className="hero-title">
              Куда тебе <span className="grad">расти?</span>
            </h1>
            <p className="hero__sub">
              Отметь навыки, которые уже есть — покажу до 12 направлений: карьерные
              роли и специальности колледжа — и план на 30 дней. Без резюме и
              тестов: просто карта маршрута.
            </p>
            <div className="hero__actions">
              <a className="btn btn-primary" href="#skills">
                Отметить навыки ↓
              </a>
              <button type="button" onClick={fillExample} className="btn btn-ghost">
                Подставить пример
              </button>
            </div>
            <ul className="hero__facts">
              <li>
                <b>21</b> направление в базе
              </li>
              <li>
                <b>12</b> ролей в подборе
              </li>
              <li>
                <b>30</b> дней в плане
              </li>
            </ul>
          </div>

          <aside className="hero-side">
            <div className="preview-card">
              <span className="preview-card__eyebrow">Пример подбора</span>
              <p className="preview-card__title">Направления за пару секунд</p>
              <p className="preview-card__sub">
                Так выглядит выдача для навыков «html, css, python, 1с»
              </p>
              <div className="preview-list">
                <div className="preview-row">
                  <div>
                    <div className="preview-row__name">Веб-разработчик</div>
                    <div className="preview-row__meta">совпало 8 навыков из 10</div>
                  </div>
                  <span className="preview-row__score">92%</span>
                </div>
                <div className="preview-row">
                  <div>
                    <div className="preview-row__name">1С-разработчик</div>
                    <div className="preview-row__meta">совпало 6 навыков из 10</div>
                  </div>
                  <span className="preview-row__score preview-row__score--mid">74%</span>
                </div>
                <div className="preview-row">
                  <div>
                    <div className="preview-row__name">QA-инженер</div>
                    <div className="preview-row__meta">совпало 5 навыков из 10</div>
                  </div>
                  <span className="preview-row__score preview-row__score--mid">63%</span>
                </div>
              </div>
              <p className="preview-foot">
                Пример для показа. Реальный подбор считает совпадения по базе
                навыков и объясняет, чего не хватает.
              </p>
            </div>
            {/* v31: маршрут из трёх шагов. Карточка объясняет путь
                пользователя и держит правую колонку героя. */}
            <div className="route-card">
              <span className="route-card__eyebrow">Как это работает</span>
              <ol className="route">
                <li className="route__step">
                  <span className="route__num">1</span>
                  <span className="route__text">
                    Отметь навыки, которые уже есть
                  </span>
                </li>
                <li className="route__step">
                  <span className="route__num">2</span>
                  <span className="route__text">
                    Получи до 12 подходящих направлений
                  </span>
                </li>
                <li className="route__step">
                  <span className="route__num">3</span>
                  <span className="route__text">Иди по плану на 30 дней</span>
                </li>
              </ol>
            </div>
          </aside>
        </section>

        {guest && (
          <p className="small" role="status" style={{ marginTop: 12 }}>
            Гостевой режим: профиль сохранится только до перезагрузки страницы.
          </p>
        )}

        {/* v26: пикер разложен по смысловым группам (чипы 44px, подписи-разделители) */}
        <section className="card picker fx-conic" id="skills" style={{ marginTop: 28 }}>
          <div className="picker__head">
            <label className="label" htmlFor="skills-text" style={{ marginBottom: 0 }}>
              Твои навыки
            </label>
            <span className="picker__count">
              {hasSelection
                ? `${selected.length} выбрано — этого достаточно`
                : 'Можно выбрать чипы или написать текстом'}
            </span>
          </div>
          <textarea
            id="skills-text"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="например: html, css, python, 1с"
            className="input"
            style={{ marginTop: 12 }}
          />

          <div className="picker-group">
            <div className="picker-group__label">Разработка и IT</div>
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
          </div>

          <div className="picker-group">
            <div className="picker-group__label">Профессии вне IT</div>
            <div className="chips">
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
          </div>

          <div className="picker-group">
            <div className="picker-group__label">Специальности колледжа</div>
            <div className="chips">
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
          </div>

          <div className="picker-group">
            <div className="picker-group__label">Курс</div>
            <div className="chips">
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

          <p className="small picker-note">
            Не только IT: специальности колледжа — в той же базе направлений.
          </p>

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
            «Где/Кем можно работать» со страниц сайта колледжа.
            v15: карточки сгруппированы по сферам — общий DirectionGroups
            (те же секции на /employer), подписи и порядок — из данных. */}
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
          <DirectionGroups specs={SPECS} />
        </section>

        {/* v18: вход в версию для работодателя — внизу, после каталога;
            ссылка в шапке остаётся как быстрый доступ. */}
        <section
          className="cta-bar employer-cta"
          aria-labelledby="employer-cta-heading"
          style={{ marginTop: 36 }}
        >
          <h2 id="employer-cta-heading" style={{ fontSize: 20, marginBottom: 6 }}>
            Вы работодатель?
          </h2>
          <p className="small" style={{ margin: '0 0 14px' }}>
            Каталог направлений колледжа и навыки выпускников — без персональных
            данных.
          </p>
          <Link href="/employer" className="btn btn-primary">
            Версия для работодателя →
          </Link>
        </section>

        {/* v31: футер — бренд, разделы и обещание приватности */}
        <footer className="site-footer">
          <span className="site-footer__brand">Карьерный трекер СИУЭиП</span>
          <span className="site-footer__links">
            <Link href="/employer">Версия для работодателя</Link>
            <Link href="/consultant">Помощник</Link>
          </span>
          <span className="site-footer__note">
            Работает офлайн · без регистрации · данные не уходят в сеть
          </span>
        </footer>
      </main>
    </>
  )
}
