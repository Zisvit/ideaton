import React from 'react'
import Link from 'next/link'
import {
  apiFetch,
  getChecks,
  getDone,
  getMini,
  getRoles,
  getStoredProfile,
  getStoredRoleId,
  saveMini,
  PlanResponse,
  saveChecks,
  saveDone,
} from '../lib/api'
import { buildMiniCheck, MiniCheck, MiniKind } from '../lib/planChecks'
import { buildTopicGraph, TopicInput } from '../lib/topicGraph'
import TopicMap from '../components/TopicMap'

export default function Plan() {
  const [plan, setPlan] = React.useState<PlanResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<Record<string, boolean>>({})
  // Результат самопроверки — отдельное хранилище (не подмешивается в done,
  // иначе doneCount считает чужие ключи → ложное «Маршрут пройден»)
  const [checked, setChecked] = React.useState<Record<string, boolean>>({})
  // v7: kind выбранного направления — подпись «специальность» под заголовком
  const [roleKind, setRoleKind] = React.useState<'role' | 'specialty' | null>(null)
  // v11: план посчитан локально (сервер недоступен) — баннер + «Повторить»
  const [offline, setOffline] = React.useState(false)
  const roleId = React.useRef<string>('')

  // Контракт: POST /plan { role_id, profile } → { weeks[], checklist[], title, disclaimer }
  // v10: reqRef — тот же seq-guard, что на /result: поздний ответ не затирает
  // свежий план, анмаунт инкрементом отменяет setState после размонтирования.
  const reqRef = React.useRef(0)
  const fetchPlan = async () => {
    const reqId = ++reqRef.current
    setLoading(true)
    setError(null)
    const res = await apiFetch<PlanResponse>('/plan', {
      method: 'POST',
      body: { role_id: getStoredRoleId(), profile: getStoredProfile() },
      // v10: LLM-ветке /plan нужно больше дефолтных 15 с — 30 с, чтобы
      // медленный сбор шагов не падал в таймаут на середине
      timeout: 30000,
    })
    if (reqId !== reqRef.current) return // устаревший ответ — стейт не трогаем
    if (res.success && res.data && Array.isArray(res.data.weeks)) {
      setPlan({
        ...res.data,
        // аддитивное поле: без нормализации рендер падает на .length/.map
        checklist: Array.isArray(res.data.checklist) ? res.data.checklist : [],
      })
      setOffline(false)
    } else if (
      res.reason === 'network' ||
      res.reason === 'timeout' ||
      res.reason === 'server' ||
      res.reason === 'bad-json'
    ) {
      // v11: API недоступен — план собирает локальный движок (отдельный чанк).
      const local = await import('../lib/localEngine')
      if (reqId !== reqRef.current) return
      const out = local.planLocal(getStoredRoleId(), getStoredProfile())
      if (out && out.ok) {
        setPlan({
          ...out.data,
          checklist: Array.isArray(out.data.checklist) ? out.data.checklist : [],
        })
        setOffline(true)
      } else {
        setPlan(null)
        setError('Для этой роли нет плана — выбери другое направление.')
      }
    } else {
      setPlan(null)
      setOffline(false)
      setError(res.error || 'Неизвестная ошибка')
    }
    setLoading(false)
  }

  React.useEffect(() => {
    roleId.current = getStoredRoleId()
    // «Прогресс сохраняется в браузере» теперь говорит правду: done-набор
    // хранится по роли (localStorage или память в гостевом режиме)
    setDone(getDone(roleId.current))
    setChecked(getChecks(roleId.current))
    setMini(getMini(roleId.current))
    const roleRef = getRoles().find((item) => item.role_id === roleId.current)
    setRoleKind(roleRef?.kind ?? null)
    fetchPlan()
    return () => { reqRef.current++ } // анмаунт: поздний ответ не трогает стейт
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Переключение чекбокса сразу пишет в хранилище — F5 ничего не теряет.
  const toggle = (key: string) =>
    setDone((d) => {
      const next = { ...d, [key]: !d[key] }
      saveDone(roleId.current, next)
      return next
    })

  // Проверка поняла себя (CHOICE верно / SELF «Разобрался») — пишет в своё хранилище.
  const settle = (id: string) =>
    setChecked((c) => {
      const next = { ...c, [id]: true }
      saveChecks(roleId.current, next)
      return next
    })

  // v6: мини-проверки пунктов (stored mini:v1) — отдельный стейт, НЕ влияет на done.
  const [mini, setMini] = React.useState<Record<string, boolean>>({})
  // Аккордеон: раскрыта ровно одна карточка (совет раунд 2: минимум reflow-потоков).
  const [openMini, setOpenMini] = React.useState<string | null>(null)
  // v7: выбранная тема на «Карте тем» (ключ = taskKey пункта плана).
  const [topicSel, setTopicSel] = React.useState<string | null>(null)

  const settleMini = (key: string) =>
    setMini((m) => {
      const next = { ...m, [key]: true }
      saveMini(roleId.current, next)
      return next
    })

  // Ключ задачи: неделя + позиция + хэш ТЕКСТА задачи. Индекс-ключ (${n}-${i})
  // сдвигался тихо, когда персональные вставки меняли состав недели при смене
  // профиля → «галочки на чужих задачах». Хэш делает ключ привязанным к смыслу.
  const taskKey = (weekN: number, i: number, task: string) => {
    let h = 0
    for (let c = 0; c < task.length; c++) h = (h * 31 + task.charCodeAt(c)) | 0
    return `${weekN}-${i}:${h}`
  }
  const totalTasks = plan ? plan.weeks.reduce((a, w) => a + w.tasks.length, 0) : 0
  // Счёт только по КЛЮЧАМ текущего плана: stale-записи (смена роли/профиля)
  // физически не считаются → isComplete и конфетти не срабатывают «впустую».
  const taskKeys = plan
    ? plan.weeks.flatMap((w) => w.tasks.map((t, i) => taskKey(w.n, i, t)))
    : []
  const doneCount = taskKeys.filter((k) => done[k]).length
  const isComplete = totalTasks > 0 && doneCount >= totalTasks
  // Аддитивное поле /plan: рендерим блок только при непустом массиве.
  // Слепой каст apiFetch -> T не валидирует форму, поэтому рантайм-гвард тут.
  const checks = Array.isArray(plan && plan.checks) ? (plan as PlanResponse).checks ?? [] : []

  // v7: темы «Карты тем» — тот же taskKey, что у чекбоксов; мини-проверка
  // считается один раз на задачу и переиспользуется в неделях и в графе.
  const miniByKey: Record<string, MiniCheck | null> = {}
  const graphItems: TopicInput[] = []
  if (plan) {
    for (const week of plan.weeks) {
      week.tasks.forEach((task, i) => {
        const key = taskKey(week.n, i, task)
        const miniCheck = buildMiniCheck(task)
        miniByKey[key] = miniCheck
        graphItems.push({ key, week: week.n, task, mini: miniCheck })
      })
    }
  }
  const topicGraph = plan ? buildTopicGraph(plan.title, graphItems) : null
  const selectedTopic = topicSel
    ? graphItems.find((item) => item.key === topicSel && item.mini) || null
    : null

  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link href="/" className="brand">Карьерный трекер</Link>
          <span className="step-pill">Шаг 3 из 3</span>
        </div>
        <div className="step-line" style={{ '--p': '100%' } as React.CSSProperties} />
      </header>

      <main id="main" className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
        <section className="fade-in">
          <h1>
            <span className="grad">План на 30 дней</span>
            {plan ? `: ${plan.title}` : ''}
          </h1>
          <p className="hero__sub">
            Конкретные шаги по неделям. Отмечай выполненные — прогресс сохраняется в браузере.
          </p>
          {roleKind === 'specialty' && (
            <p className="small" style={{ marginTop: 8 }}>
              Направление из базы специальностей колледжа — план собран под него.
            </p>
          )}
        </section>

        {offline && (
          <div className="offline-note" role="status">
            <span className="offline-pill">Офлайн-расчёт</span>
            <span>Сервер недоступен — показан локальный расчёт.</span>
            <button type="button" onClick={fetchPlan} className="btn btn-ghost">
              Повторить через сервер
            </button>
          </div>
        )}

        {loading && (
          <div style={{ marginTop: 32, display: 'grid', gap: 14 }} role="status" aria-live="polite">
            <div className="skeleton" style={{ height: 120 }} />
            <div className="skeleton" style={{ height: 120 }} />
            <div className="skeleton" style={{ height: 120 }} />
            <span className="sr-only">Загружаем план…</span>
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
            <div
              className="card"
              style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="small" style={{ marginBottom: 6 }}>Прогресс</div>
                <div className="progress">
                  <span style={{ width: `${totalTasks ? (doneCount / totalTasks) * 100 : 0}%` }} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }} aria-live="polite">
                <div className="num" style={{ fontSize: 22 }}>
                  {doneCount}/{totalTasks}
                </div>
                <div className="small">задач выполнено</div>
              </div>
            </div>

            {topicGraph && topicGraph.nodes.length > 5 && (
              <section
                className="card topic-map-card plan-print-hide"
                style={{ marginTop: 20 }}
                aria-label="Карта тем тестирований"
              >
                <div className="topic-map-head">
                  <h2>Карта тем</h2>
                  <p className="small">
                    Клик по теме — мини-проверка. Центр — направление, лучи — недели,
                    пунктир — темы с общим навыком.
                  </p>
                </div>
                <TopicMap
                  graph={topicGraph}
                  selected={topicSel}
                  onSelect={(key) => setTopicSel((cur) => (cur === key ? null : key))}
                />
                <p className="small topic-map-hint">
                  Проведи пальцем по карте — видны все недели и темы.
                </p>
                {selectedTopic && selectedTopic.mini && (
                  <div className="topic-panel">
                    <div className="topic-panel__head">
                      <span className="small">Неделя {selectedTopic.week}</span>
                      <span className="topic-panel__title">
                        {selectedTopic.mini.label || selectedTopic.task}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost topic-panel__open"
                        onClick={() => {
                          setOpenMini(selectedTopic.key)
                          const el = document.getElementById(
                            `task-${selectedTopic.key}`
                          )
                          const reduced =
                            typeof window !== 'undefined' &&
                            window.matchMedia('(prefers-reduced-motion: reduce)').matches
                          el?.scrollIntoView({
                            behavior: reduced ? 'auto' : 'smooth',
                            block: 'center',
                          })
                        }}
                      >
                        Открыть в плане →
                      </button>
                    </div>
                    <MiniCheckBody
                      mini={selectedTopic.mini}
                      solved={!!mini[selectedTopic.key]}
                      onSolve={() => settleMini(selectedTopic.key)}
                    />
                  </div>
                )}
              </section>
            )}

            {isComplete && (
              <div>
                <p className="milestone">
                  <b aria-hidden>✓</b> Маршрут пройден — прогресс сохранён
                </p>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginTop: 8, padding: '8px 14px', fontSize: 14 }}
                  onClick={() => window.print()}
                >
                  Забрать карту (PDF) →
                </button>
              </div>
            )}

            <div className="stagger" style={{ marginTop: 24, display: 'grid', gap: 14 }}>
              {plan.weeks.map((week) => (
                <section key={week.n} className="week fade-in">
                  <div className="week__title">
                    <span className="week__num">{week.n}</span>
                    Неделя {week.n}
                  </div>
                  <ul>
                    {week.tasks.map((task, i) => {
                      const key = taskKey(week.n, i, task)
                      // v7: мини-проверка уже посчитана для графа (тот же taskKey);
                      // нет контента в глоссарии → нет теста и нет кнопки.
                      const miniCheck = miniByKey[key]
                      return (
                        <React.Fragment key={key}>
                          <li id={`task-${key}`} className={done[key] ? 'done is-done' : ''}>
                            <button
                              type="button"
                              className="check"
                              onClick={() => toggle(key)}
                              aria-pressed={!!done[key]}
                              aria-label={`Неделя ${week.n}, шаг ${i + 1}: ${task}`}
                            />
                            <span>{task}</span>
                          </li>
                          {miniCheck && (
                            <MiniRow
                              taskKey={key}
                              mini={miniCheck}
                              solved={!!mini[key]}
                              open={openMini === key}
                              onToggle={() =>
                                setOpenMini((cur) => (cur === key ? null : key))
                              }
                              onSolve={() => settleMini(key)}
                            />
                          )}
                        </React.Fragment>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>

            {checks.length > 0 && (
              <section
                className="card plan-print-hide"
                style={{ marginTop: 24, display: 'grid', gap: 16 }}
                aria-label="Проверь, что понял"
              >
                <div>
                  <h2 style={{ fontSize: 18, marginBottom: 6 }}>Проверь, что понял</h2>
                  <p className="small" style={{ margin: 0 }}>
                    Не экзамен и не оценка: проверка для тебя. Ответ берётся из той же закрытой
                    базы ролей, повторить можно сколько угодно.
                  </p>
                </div>
                {checks.map((check) =>
                  check.kind === 'choice' ? (
                    <ChoiceCard key={check.id} check={check} settled={!!checked[check.id]} onSettle={settle} />
                  ) : (
                    <SelfCard key={check.id} check={check} settled={!!checked[check.id]} onSettle={settle} />
                  )
                )}
              </section>
            )}

            {plan.checklist.length > 0 && (
              <section className="checklist" style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 18, marginBottom: 12 }}>Чек-лист пробелов</h2>
                <ul>
                  {plan.checklist.map((item, i) => (
                    <li key={i}>
                      <span className="check" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {plan.disclaimer && (
              <p className="disclaimer" style={{ marginTop: 20 }}>{plan.disclaimer}</p>
            )}

            {/* подвал печатной карты: виден только на бумаге (@media print) */}
            <div className="page-foot">
              Карьерный трекер · план на 30 дней{plan ? ` · ${plan.title}` : ''} ·
              распечатано {new Date().toLocaleDateString('ru-RU')}
              <br />
              План построен по закрытой базе ролей, не обещает трудоустройство.
            </div>

            <div className="cta-bar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/consultant" className="btn btn-primary">Задать вопрос консультанту →</Link>
              <Link href="/result" className="btn btn-ghost">Сменить направление</Link>
            </div>

            {isComplete && (
              <div className="confetti" aria-hidden>
                {Array.from({ length: 8 }).map((_, i) => (
                  <i key={i} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}

type Check = {
  id: string
  prompt: string
  kind: 'self' | 'choice'
  options?: string[]
  correct?: number | null
  hint?: string
  source?: string
  skill?: string
  week?: number
}

type CheckCardProps = {
  check: Check
  settled: boolean
  onSettle: (id: string) => void
}

// Кнопка-вариант CHOICE: состояния нейтральные (без красного/ошибок по UX.md),
// верный ответ даёт фразу «Разобрался», неверный — молча reveal точного текста
// из рубрики + source; повтор клика разрешён, счётов и процентов нет.
// Варианты/состояния размечены классами (.opt-list/.opt/.is-*) — анимации
// (лесенка входа, поп reveal) правит CSS в globals.css (микро-слой v5).

function ChoiceCard({ check, settled, onSettle }: CheckCardProps) {
  const [picked, setPicked] = React.useState<number | null>(null)
  const options = Array.isArray(check.options) ? check.options : []
  const correct = typeof check.correct === 'number' ? check.correct : -1

  if (settled) {
    return (
      <div className="small is-settled" style={{ color: 'var(--accent)' }}>
        ✓ Разобрался — {check.prompt}
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 600 }}>{check.prompt}</div>
      <div className="opt-list" style={{ display: 'grid', gap: 8 }}>
        {options.map((option, i) => {
          const revealed = picked !== null && i === correct
          return (
            <button
              key={i}
              type="button"
              className={`btn btn-ghost opt${picked === i ? ' is-active' : ''}${revealed ? ' is-reveal' : ''}`}
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                textAlign: 'left',
                height: 'auto',
                padding: '10px 14px',
                borderRadius: 12,
                whiteSpace: 'normal',
                ...(revealed ? { background: 'var(--accent-soft)', borderColor: 'var(--accent)' } : {}),
              }}
              aria-pressed={picked === i}
              onClick={() => {
                setPicked(i)
                if (i === correct) onSettle(check.id)
              }}
            >
              {option}
            </button>
          )
        })}
      </div>
      {picked !== null && picked !== correct && correct >= 0 && (
        <div className="small is-hint fade-in" role="status">
          Вот как это записано в базе: <b>{options[correct]}</b>
          {check.source ? ` · ${check.source}` : ''}
        </div>
      )}
    </div>
  )
}

function SelfCard({ check, settled, onSettle }: CheckCardProps) {
  const [open, setOpen] = React.useState(false)
  if (settled) {
    return (
      <div className="small is-settled" style={{ color: 'var(--accent)' }}>
        ✓ Разобрался — объяснил своими словами
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 600 }}>{check.prompt}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ border: '1px solid var(--line)' }}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Скрыть ориентир' : 'Показать ориентир'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ border: '1px solid var(--line)' }}
          onClick={() => onSettle(check.id)}
        >
          Разобрался
        </button>
      </div>
      {open && check.hint && (
        <div className="small fade-in" role="note">
          Ориентир из рубрики: «{check.hint}»
          {check.source ? ` · ${check.source}` : ''}
        </div>
      )}
    </div>
  )
}

type MiniRowProps = {
  taskKey: string
  mini: MiniCheck
  solved: boolean
  open: boolean
  onToggle: () => void
  onSolve: () => void
}

// v6: мини-проверка пункта — строка-чип под задачей (44px тач) + тело,
// раскрывающееся transition'ом ПО ГРИД-РЯДАМ grid-template-rows 0fr→1fr:
// единственное согласованное layout-исключение волны (big-pickle/mimo/beam),
// закрытие предыдущей карточки мгновенно (аккордеон, 1 открытая).
// Внутри тела — зарезервированные слоты (hint/ок/по 22–24px) ⇒ CLS = 0.
// no-score: неверный выбор — не красный, а подсказка; повтор безлимитный.
function MiniRow({ taskKey, mini, solved, open, onToggle, onSolve }: MiniRowProps) {
  const label = solved
    ? '✓ Разобрался'
    : open
    ? 'Проверка — скрыть'
    : 'Проверить'
  return (
    <li
      className={`mini-row plan-print-hide${open ? ' is-open' : ''}`}
      aria-label={`Мини-проверка: ${mini.prompt}`}
    >
      <button
        type="button"
        className="mini__head"
        aria-expanded={open}
        aria-controls={`mini-body-${taskKey}`}
        onClick={onToggle}
      >
        <span className={`mini__mark ${kindIcon(mini.kind)}`} aria-hidden>
          {solved ? '✓' : mini.kind === 'choice' ? '?' : mini.kind === 'self' ? '✎' : '☐'}
        </span>
        <span className="mini__head-text">{label}</span>
        <span className="mini__chev" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      <div className="mini__body" id={`mini-body-${taskKey}`}>
        <div className="mini__inner">
          <MiniCheckBody mini={mini} solved={solved} onSolve={onSolve} />
        </div>
      </div>
    </li>
  )
}

type MiniCheckBodyProps = {
  mini: MiniCheck
  solved: boolean
  onSolve: () => void
}

// v7: тело мини-проверки вынесено из MiniRow, чтобы тот же интерактив жил в
// панели «Карты тем». Классы и слоты v6 сохранены (CLS = 0, no-score).
function MiniCheckBody({ mini, solved, onSolve }: MiniCheckBodyProps) {
  const [picked, setPicked] = React.useState<number | null>(null)
  const [hintShown, setHintShown] = React.useState(false)
  const options = Array.isArray(mini.options) ? mini.options : []
  const correct = typeof mini.correct === 'number' ? mini.correct : -1

  return (
    <>
      <div className="mini__task">{mini.prompt}</div>
      {mini.kind === 'choice' && !solved && (
        <div className="mini__opts">
          {options.map((option, i) => {
            const revealed = picked !== null && i === correct
            return (
              <button
                key={i}
                type="button"
                className={`mini__v${picked === i ? ' is-picked' : ''}${
                  revealed ? ' is-reveal' : ''
                }`}
                onClick={() => {
                  setPicked(i)
                  if (i === correct) onSolve()
                }}
              >
                {option}
              </button>
            )
          })}
        </div>
      )}
      {mini.kind === 'self' && !solved && (
        <div className="mini__actions">
          <button type="button" className="mini__v" onClick={() => setHintShown(true)}>
            Показать ориентир
          </button>
          <button type="button" className="mini__v is-go" onClick={onSolve}>
            Объяснил — Разобрался
          </button>
        </div>
      )}
      {mini.kind === 'do' && !solved && (
        <div className="mini__actions">
          <button type="button" className="mini__v is-go" onClick={onSolve}>
            Готово, могу показать
          </button>
          <button
            type="button"
            className="mini__v"
            onClick={() => setHintShown(true)}
          >
            Ещё собираю
          </button>
        </div>
      )}
      {/* зарезервированный слот подсказки: min-height в CSS ⇒ нет сдвига;
          сообщения взаимоисключающие (один span) ⇒ высота слота не растёт */}
      <div className="mini__hint" role="note">
        {hintShown && mini.hint ? (
          <span>Ориентир: {mini.hint}</span>
        ) : (!solved && picked !== null && picked !== correct && correct >= 0) ? (
          <span>Смотри, как это записано в базе: {options[correct]}</span>
        ) : null}
      </div>
      {/* зарезервированный слот статуса: visibility, не display ⇒ CLS 0 */}
      <div className="mini__gotcha">
        {solved && '✓ Разобрался — теперь можно отметить галочку слева'}
      </div>
    </>
  )
}

// Иконка типа мини-проверки (aria-hidden): CHOICE «?», SELF «✎», DO «☐».
function kindIcon(kind: MiniKind): string {
  return kind === 'choice' ? 'mini__mark--choice' : kind === 'self' ? 'mini__mark--self' : 'mini__mark--do'
}
