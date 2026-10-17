import React from 'react'
import { INTRO_MS } from '../lib/intro'

// Лис «Идея» — талисман ПРОЕКТА (не официальный символ вуза: брендбука
// СИУЭиП в репо нет, имитировать фирменный знак запрещено решением совета).
// Геометрия минимальна: капсула-тело, клин-голова, треугольники-уши,
// хвост-путь, 4 ноги-линии. Анимация — 2 противофазных цикла ног.
export function Fox({ running }: { running: boolean }) {
  return (
    <svg
      className={`intro-fox${running ? ' is-running' : ''}`}
      viewBox="0 0 120 90"
      aria-hidden="true"
      focusable="false"
    >
      {/* хвост: поворот от основания */}
      <path
        className="intro-fox__tail"
        d="M26 60 C12 58 8 48 16 42 C22 50 30 54 40 56 Z"
        fill="var(--fox)"
      />
      {/* тело-капсула; боб во время бега */}
      <g className="intro-fox__body">
        <rect x="26" y="42" width="56" height="27" rx="13" fill="var(--fox)" />
        {/* голова-клин */}
        <path d="M78 38 L108 47 L82 62 Z" fill="var(--fox)" />
        {/* уши (2 треугольника) */}
        <polygon points="82,40 87,26 93,40" fill="var(--fox)" />
        <polygon points="94,42 99,28 103,41" fill="var(--fox)" />
        {/* глаз */}
        <circle cx="91" cy="47" r="2.1" fill="#1C232B" />
        {/* грудка светлая */}
        <circle cx="30" cy="60" r="4.5" fill="var(--fox-soft)" />
      </g>
      {/* ноги: 2 пары, противофаза (scaleY от бедра, transform-box: fill-box) */}
      <line className="intro-fox__leg leg-a1" x1="34" y1="66" x2="34" y2="86" stroke="var(--fox)" strokeWidth="7" strokeLinecap="round" />
      <line className="intro-fox__leg leg-b1" x1="40" y1="66" x2="40" y2="86" stroke="var(--fox)" strokeWidth="7" strokeLinecap="round" />
      <line className="intro-fox__leg leg-a2" x1="66" y1="66" x2="66" y2="86" stroke="var(--fox)" strokeWidth="7" strokeLinecap="round" />
      <line className="intro-fox__leg leg-b2" x1="72" y1="66" x2="72" y2="86" stroke="var(--fox)" strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
}

// Интро-сцена: неблокирующий слой НАД уже отрендеренной «/». Никакого route
// и никакого overflow:hidden (скролл не блокируем — CLS/scrollbar). Закрытие
// только по JS-таймеру или явному действию (красная команда: animationend при
// prefers-reduced-motion не придёт НИКОГДА — глобальный animation:none).
export default function IntroScene({ onDone }: { onDone: () => void }) {
  // Прогон сцены стартует после fonts-гейта (потолок 400 мс): сцена не
  // ждёт wifi в демо-зале, FOUT не рвёт переливание в середине.
  const [run, setRun] = React.useState(false)
  const doneRef = React.useRef(false)

  const finish = React.useCallback(() => {
    if (!doneRef.current) {
      doneRef.current = true
      onDone()
    }
  }, [onDone])

  React.useEffect(() => {
    let cancelled = false
    let closeTimer = 0
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    Promise.race([
      fonts?.ready ?? Promise.resolve(),
      new Promise((r) => window.setTimeout(r, 400)),
    ]).then(() => {
      if (cancelled) return
      setRun(true) // единая шкала INTRO_MS стартует отсюда (CSS var --tl)
      closeTimer = window.setTimeout(finish, INTRO_MS + 120) // страховка закрытия
    })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelled = true
      if (closeTimer) window.clearTimeout(closeTimer)
      window.removeEventListener('keydown', onKey)
    }
  }, [finish])

  return (
    <div
      className={`intro-overlay${run ? ' is-run' : ''}`}
      style={{ '--tl': `${INTRO_MS}ms` } as React.CSSProperties}
      role="presentation"
      onClick={finish}
    >
      <div className="intro-scene" aria-hidden="true">
        <div className="intro-aurora" />
        <div className="intro-mark">
          <span className="intro-mark__glyph">СИ</span>
        </div>
        <div className="intro-fox-wrap">
          <Fox running={run} />
        </div>
        <div className="intro-caption">Карьерный трекер · проект СИУЭиП · талисман Лис Идея</div>
      </div>
      <button type="button" className="intro-skip" onClick={finish}>
        Пропустить
      </button>
    </div>
  )
}
