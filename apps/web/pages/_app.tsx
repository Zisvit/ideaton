import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import React from 'react'
import { flushSync } from 'react-dom'
import FixLayer from '../components/FixLayer'
import IntroScene from '../components/IntroScene'
import Shell from '../components/Shell'
import { shouldShowIntro } from '../lib/intro'
import '../styles/globals.css'
// v33: слой оболочки и компонентов — поверх дизайн-системы
import '../styles/shell.css'

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  // SSR отдаёт страницу БЕЗ интро; гейт в useEffect → ноль hydration mismatch,
  // SSG-вывод не зависит от window (совет: интро поверх готового контента).
  const [showIntro, setShowIntro] = React.useState(false)
  const prevPath = React.useRef<string | null>(null)
  const firstRun = React.useRef(true)

  // v17b (совет): единственный источник истины — URL. Уход с «/» гасит сцену,
  // даже если она ещё играет; иначе оверлей висит поверх чужой страницы.
  // Query/hash на той же «/» — не «открытие»: сцену не перезапускаем.
  const syncIntro = React.useCallback((force = false) => {
    const path = window.location.pathname
    const changed = prevPath.current !== path
    prevPath.current = path
    if (force || changed) setShowIntro(shouldShowIntro())
  }, [])

  React.useEffect(() => {
    // v17: лиса — на КАЖДОЕ открытие главной. Монт/reload ловит полную
    // загрузку, routeChangeComplete — client-side переход на «/» (в т.ч.
    // back/forward). v17b: pageshow(persisted) — возврат из bfcache, где
    // React-состояние заморожено и routeChangeComplete не приходит.
    syncIntro(firstRun.current)
    firstRun.current = false
    const onRoute = () => syncIntro()
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) syncIntro(true)
    }
    router.events.on('routeChangeComplete', onRoute)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      router.events.off('routeChangeComplete', onRoute)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [router, syncIntro])

  // Закрытие сцены: фокус возвращается контенту (a11y: во вкладку до «К содержанию»,
  // а не «в никуда» — иначе клавиатура теряет позицию после оверлея).
  // v17b: контент под сценой inert, поэтому focus() зовём после коммита React;
  // у того, кто уже работает с полем вне оверлея (inert не поддержан), фокус
  // не отбираем.
  // v17c: flushSync снимает inert ДО setTimeout-фокуса — при естественном
  // закрытии таймером state-update не из React-события, и main мог быть ещё
  // inert, focus() терялся (активным оставался body).
  const closeIntro = React.useCallback(() => {
    const active = document.activeElement as HTMLElement | null
    const restore =
      !active || active === document.body || !!active.closest('.intro-overlay')
    flushSync(() => setShowIntro(false))
    if (!restore) return
    window.setTimeout(() => {
      const main = document.getElementById('main')
      if (main) {
        main.setAttribute('tabindex', '-1')
        main.focus({ preventScroll: true })
      }
    }, 0)
  }, [])

  return (
    <>
      <a
        href="#main"
        className="skip-link"
        inert={showIntro ? true : undefined}
      >
        К содержанию
      </a>
      <FixLayer />
      {showIntro ? <IntroScene onDone={closeIntro} /> : null}
      {/* v17b: под сценой нет фокуса/кликов в скрытые контролы (WCAG 2.4.11);
          inert снимается в момент закрытия. */}
      <div inert={showIntro ? true : undefined}>
        {/* v33: оболочка (сайдбар + топбар) — по референсу career-tracker.html */}
        <Shell>
          <Component {...pageProps} />
        </Shell>
      </div>
    </>
  )
}
