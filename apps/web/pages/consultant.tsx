import React from 'react'
import Link from 'next/link'
import {
  USE_LIVE_CHAT,
  GREETING,
  buildMissMessage,
  matchTopic,
  topicById,
  topicToMessage,
  ScriptMessage,
  Topic,
} from '../lib/consultantScripts'
import ThemeToggle from '../components/ThemeToggle'

// Быстрые чипы-подсказки под полем ввода (реюз .suggest, v1)
const QUICK = [
  'С чего начать?',
  'Не знаю, что умею',
  'План большой?',
]

type ChatItem =
  | { role: 'user'; text: string }
  | (ScriptMessage & { role: 'bot' })

// ---- Аватар помощника: монограмма проекта «СИ» в тёплом круге.
// v31: вместо прежнего персонажа — знак проекта (тот же, что в интро-сцене).
// Декор-акцент, статуса не несёт; живой остаётся только медленное
// «дыхание» (реюз breath, без новых @keyframes). ----
function BotAvatar() {
  return (
    <span
      className="bot-avatar"
      role="img"
      aria-label="Помощник карьерного трекера"
    >
      СИ
    </span>
  )
}

function BotHead() {
  return (
    <div className="chatBot__head">
      <BotAvatar />
      <div className="chatBot__head-text">
        <span className="badge badge-demo badge--script">Скриптовый режим</span>
        <span className="chatBot__hint">ответы заготовлены заранее · текст не уходит в сеть</span>
      </div>
    </div>
  )
}

export default function Consultant() {
  const [input, setInput] = React.useState('')
  // Диалог целиком локальный (USE_LIVE_CHAT=false): сетевой вызов не делается
  // ни при каком пути скриптового режима — структурный гейт «0 fetch».
  const [items, setItems] = React.useState<ChatItem[]>([
    { ...GREETING, role: 'bot' },
  ])
  const [error, setError] = React.useState<string | null>(null)
  const logRef = React.useRef<HTMLDivElement | null>(null)

  const pushBot = (topic: Topic): ChatItem => ({
    ...topicToMessage(topic),
    role: 'bot',
  })

  const respond = (raw: string) => {
    const question = raw.trim()
    if (!question) return
    setError(null)
    setInput('')

    if (USE_LIVE_CHAT) {
      // Будущий путь: прежний POST к чат-эндпоинту. Пока флаг false — код
      // ниже не живёт; структурный тест опирается на ранний возврат до fetch.
      setError('Живой режим ещё не включён: ожидаем API.')
      return
    }

    // Guard-зёрна перехватываются раньше любых keyword'ов (space-bunny).
    const match = matchTopic(question)
    const bot: ChatItem =
      match.kind === 'topic'
        ? pushBot(match.topic)
        : { ...buildMissMessage(), role: 'bot' }
    setItems((cur) => [...cur, { role: 'user', text: question }, bot])
  }

  const pickTopic = (topicId: string, label: string) => {
    const topic = topicById(topicId)
    if (!topic) return
    setItems((cur) => [...cur, { role: 'user', text: label }, pushBot(topic)])
  }

  // Авто-скролл лога вниз (порт фиксированной высоты ⇒ CLS 0).
  React.useEffect(() => {
    const node = logRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [items])

  return (
    <>

      <main id="main" className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
        {/* v29: герой в две колонки — как на главной */}
        <section className="hero-grid fade-in">
          <div className="hero-main">
            <p className="supernova">SUPERNOVA</p>
            <h1><span className="grad">Консультант</span></h1>
            <p className="hero__sub">
              Отвечаю по заготовленным памяткам проекта: выбирай чип или спроси словами.
              Честный режим — без подключённого ИИ и без обещаний.
            </p>
            <div className="hero__actions">
              <a className="btn btn-primary" href="#consultant-chat">
                Начать разговор ↓
              </a>
            </div>
          </div>
          <aside className="hero-side">
            <div className="preview-card">
              <span className="preview-card__eyebrow">Как это работает</span>
              <p className="preview-card__title">Три шага до плана</p>
              <div className="preview-list">
                <div className="preview-row">
                  <div>
                    <div className="preview-row__name">1 · Выберите тему</div>
                    <div className="preview-row__meta">чип или свой вопрос</div>
                  </div>
                </div>
                <div className="preview-row">
                  <div>
                    <div className="preview-row__name">2 · Получите памятку</div>
                    <div className="preview-row__meta">заготовленный ответ по проекту</div>
                  </div>
                </div>
                <div className="preview-row">
                  <div>
                    <div className="preview-row__name">3 · Договоритесь о шаге</div>
                    <div className="preview-row__meta">что сделать на этой неделе</div>
                  </div>
                </div>
              </div>
              <p className="preview-foot">
                Честный режим: ответы заготовлены заранее, текст не уходит в сеть.
              </p>
            </div>
          </aside>
        </section>

        <section className="card chatBot plan-print-hide" id="consultant-chat" style={{ marginTop: 28 }}>
          <BotHead />
          <div className="chatBot__log" ref={logRef} aria-live="polite" aria-label="Диалог с консультантом">
            {items.map((item, mi) => (
              <div
                key={mi}
                className={`chatLine ${item.role === 'user' ? 'chatLine--user' : ''}`}
                style={{ '--j': mi } as React.CSSProperties}
              >
                {item.role === 'user' ? (
                  <div className="chatLine__bubble chatLine__bubble--user">{item.text}</div>
                ) : (
                  <div className="chatLine__bubble chatLine__bubble--bot">
                    {item.title && <div className="chatLine__title">{item.title}</div>}
                    {item.lines.map((line, li) => (
                      <p key={li} className="chatLine__row" style={{ '--j': li } as React.CSSProperties}>
                        {line}
                      </p>
                    ))}
                    {item.cta && (
                      <div className="chatLine__cta-wrap">
                        <Link href={item.cta.href} className="btn btn-primary chatLine__cta">
                          {item.cta.label}
                        </Link>
                      </div>
                    )}
                    {item.chips && item.chips.length > 0 && (
                      <div className="suggest" style={{ marginTop: 10 }}>
                        {item.chips.map((chip) => (
                          <button
                            key={chip.topicId}
                            type="button"
                            onClick={() => pickTopic(chip.topicId, chip.label)}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {item.honest && (
                      <div className="chatLine__meta">памятка проекта · не ИИ-генерация</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="chatBot__form">
            <textarea
              placeholder="Например: с чего начать?"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="input"
              aria-label="Вопрос консультанту"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  respond(input)
                }
              }}
            />
            <div className="row-between" style={{ marginTop: 10, alignItems: 'center' }}>
              <div className="suggest" style={{ marginTop: 0 }}>
                {QUICK.map((label) => (
                  <button key={label} type="button" onClick={() => respond(label)}>
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => respond(input)} className="btn btn-primary">
                Спросить
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="alert alert-warn" style={{ marginTop: 20 }} role="alert">
            {error}
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
