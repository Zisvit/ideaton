import React from 'react'
import { INTRO_MS, SWIPE_GRACE_MS } from '../lib/intro'

// v31: визуальный центр сцены — монограмма «СИ» (знак проекта): гем в
// ореоле, вордмарк, короткое обещание и шкала прогресса на 4.2 с. Ни
// растровых ассетов, ни тяжёлых SVG — только CSS-градиенты и три новых
// @keyframes (markIn, auroraDrift, introRail); бюджет 30 не превышен, все
// ключи используются.
// Хореография сцены: разгон 0–240 мс (появление гема), блик по монограмме
// на 1100 мс, вордмарк и подпись на 700/900 мс, шкала заполняется всю
// сцену, вуаль гаснет на 89–100% (introVeil, 2400 мс).
const INTERACTIVE =
  'a[href], button, [role="button"], input, textarea, select, label, summary'

// v17c: первый клик по сцене не должен «съедаться». Если под оверлеем
// интерактивный элемент — закрываем сцену И активируем его. Контент под
// сценой inert, поэтому на время hit-test снимаем атрибут с обёртки и
// возвращаем обратно; React снимет его при закрытии сцены.
function interactiveUnder(x: number, y: number): HTMLElement | null {
  const wrapper = document.getElementById('main')?.parentElement ?? null
  const wasInert = wrapper?.hasAttribute('inert') ?? false
  if (wrapper && wasInert) wrapper.removeAttribute('inert')
  let found: HTMLElement | null = null
  for (const node of document.elementsFromPoint(x, y)) {
    if (!(node instanceof HTMLElement)) continue
    const el = node.closest(INTERACTIVE) as HTMLElement | null
    if (!el) continue
    if (el.closest('.intro-overlay') || el.closest('.skip-link')) continue
    found = el
    break
  }
  if (wrapper && wasInert) wrapper.setAttribute('inert', '')
  return found
}

// Интро-сцена: слой НАД уже отрендеренной «/». Контент под ним inert
// (см. _app), поэтому фокус/клики не уходят в скрытые контролы; overflow не
// трогаем — скролл не блокируем. Закрытие только по JS-таймеру или явному
// действию (клик/Esc/колесо/тач): animationend при prefers-reduced-motion
// не приходит НИКОГДА — глобальный animation:none.
export default function IntroScene({ onDone }: { onDone: () => void }) {
  // Прогон сцены стартует после fonts-гейта (потолок 400 мс): сцена не
  // ждёт wifi в демо-зале, FOUT не рвёт блик в середине.
  const [run, setRun] = React.useState(false)
  const doneRef = React.useRef(false)
  const skipRef = React.useRef<HTMLButtonElement>(null)

  const finish = React.useCallback(() => {
    if (!doneRef.current) {
      doneRef.current = true
      // v17c: conic-рамка на главной стартует по факту закрытия сцены,
      // а не по страховочному +120 (иначе после раннего скипа она ждёт).
      window.dispatchEvent(new Event('intro:done'))
      onDone()
    }
  }, [onDone])

  const onOverlayClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('.intro-skip')) return
      const target = interactiveUnder(e.clientX, e.clientY)
      finish()
      // Клик по кнопке/ссылке под сценой: сначала даём React снять inert,
      // затем активируем элемент. Пустой клик просто закрывает сцену.
      if (target) {
        window.setTimeout(() => {
          target.click()
          // программный click() не фокусирует поле — первому клику по
          // textarea/input/select нужен явный focus
          if (target.matches('input, textarea, select')) {
            target.focus({ preventScroll: true })
          }
        }, 0)
      }
    },
    [finish]
  )

  React.useEffect(() => {
    let cancelled = false
    let closeTimer = 0
    // клавиатурному/SR-пользователю нужен якорь сразу (glm, раунд 2):
    // Esc/Enter/Space с него закрывают сцену; контент под сценой inert,
    // поэтому фокус не уходит в скрытые контролы
    skipRef.current?.focus({ preventScroll: true })
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    Promise.race([
      fonts?.ready ?? Promise.resolve(),
      new Promise((r) => window.setTimeout(r, 400)),
    ]).then(() => {
      if (cancelled) return
      setRun(true) // единая шкала INTRO_MS=2400 стартует отсюда (CSS var --tl)
      // ровно конец шкалы: вуаль уже в opacity 0, невидимого хвоста нет
      closeTimer = window.setTimeout(finish, INTRO_MS)
    })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
    }
    // скип жестом: колесо/тач = «давай дальше» (glm, раунд 2). Фильтры:
    // 1) ctrl+wheel — pinch-zoom трекпада/кнопка масштаба, не навигация;
    // 2) multi-touch (pinch на телефоне);
    // 3) грейс SWIPE_GRACE_MS от монта эффекта (не от run): инерция
    //    прошлого скролла и fonts-гейт (≤400ms) не убивают сцену случайно.
    const graceUntil = performance.now() + SWIPE_GRACE_MS
    const onSwipe = (e: Event) => {
      if (performance.now() < graceUntil) return
      if ('ctrlKey' in e && (e as WheelEvent).ctrlKey) return
      if ((e as TouchEvent).touches && (e as TouchEvent).touches.length > 1) return
      finish()
    }
    // полсекунды ОС переключила reduce на полутона сцены — закрываем честно
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onRm = () => {
      if (rm.matches) finish()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onSwipe, { passive: true })
    window.addEventListener('touchmove', onSwipe, { passive: true })
    rm.addEventListener?.('change', onRm)
    return () => {
      cancelled = true
      if (closeTimer) window.clearTimeout(closeTimer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onSwipe)
      window.removeEventListener('touchmove', onSwipe)
      rm.removeEventListener?.('change', onRm)
    }
  }, [finish])

  return (
    <div
      className={`intro-overlay${run ? ' is-run' : ''}`}
      style={{ '--tl': `${INTRO_MS}ms` } as React.CSSProperties}
      role="presentation"
      onClick={onOverlayClick}
    >
      {/* v31: аврора и тёплое свечение — на весь экран (фон сцены),
          сама сцена — компактная композиция по центру */}
      <div className="intro-aurora" />
      <div className="intro-glow" />
      <div className="intro-scene" aria-hidden="true">
        <div className="intro-badge">
          <div className="intro-mark">
            <span className="intro-mark__glyph">СИ</span>
          </div>
        </div>
        <p className="intro-wordmark">SUPERNOVA</p>
        <div className="intro-caption">
          <span className="intro-caption__name">Карьерный трекер СИУЭиП</span>
          <span className="intro-caption__meta">
            маршрут на 30 дней из навыков, которые уже есть
          </span>
        </div>
        {/* v31: шкала — короткая линия внутри композиции. Полоса во всю
            ширину экрана читалась как прогресс-бар браузера; здесь это
            элемент знака, а не служебная полка. */}
        <div className="intro-rail" aria-hidden="true">
          <i className="intro-rail__fill" />
        </div>
      </div>
      <button
        type="button"
        ref={skipRef}
        className="intro-skip"
        onClick={(e) => {
          e.stopPropagation()
          finish()
        }}
      >
        Пропустить
      </button>
    </div>
  )
}
