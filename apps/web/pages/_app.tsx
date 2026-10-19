import type { AppProps } from 'next/app'
import React from 'react'
import FixLayer from '../components/FixLayer'
import IntroScene from '../components/IntroScene'
import { markIntroShown, shouldShowIntro } from '../lib/intro'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  // SSR отдаёт страницу БЕЗ интро; гейт в useEffect → ноль hydration mismatch,
  // SSG-вывод не зависит от window (совет: интро поверх готового контента).
  const [showIntro, setShowIntro] = React.useState(false)

  React.useEffect(() => {
    if (shouldShowIntro()) {
      markIntroShown() // отметка на монте (deepseek, раунд 2), не на финише
      setShowIntro(true)
    }
  }, [])

  // Закрытие сцены: фокус возвращается контенту (a11y: во вкладку до «К содержанию»,
  // а не «в никуда» — иначе клавиатура теряет позицию после оверлея).
  const closeIntro = React.useCallback(() => {
    setShowIntro(false)
    const main = document.getElementById('main')
    if (main) {
      main.setAttribute('tabindex', '-1')
      main.focus({ preventScroll: true })
    }
  }, [])

  return (
    <>
      <a href="#main" className="skip-link">К содержанию</a>
      <FixLayer />
      {showIntro ? <IntroScene onDone={closeIntro} /> : null}
      <Component {...pageProps} />
    </>
  )
}
