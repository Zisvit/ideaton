import React from 'react'
import { applyTheme, ThemeName } from '../lib/theme'

// v12: сегмент «Белая/Чёрная» в шапке (совет, единогласно: шапка вместо
// плавающей кнопки — нет конфликтов с .cta-sticky/.chatBot__form/.intro-skip).
// SSR отдаёт «Белую» — как и <html data-theme="light">; фактическую тему
// подхватываем после монта: React не управляет <html>, mismatch исключён.
export default function ThemeToggle() {
  const [theme, setTheme] = React.useState<ThemeName>('light')

  React.useEffect(() => {
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
      setTheme('dark')
    }
  }, [])

  const pick = (next: ThemeName) => {
    setTheme(next)
    applyTheme(next)
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Тема оформления">
      <button
        type="button"
        className="theme-toggle__btn"
        aria-pressed={theme === 'light'}
        onClick={() => pick('light')}
      >
        Белая
      </button>
      <button
        type="button"
        className="theme-toggle__btn"
        aria-pressed={theme === 'dark'}
        onClick={() => pick('dark')}
      >
        Чёрная
      </button>
    </div>
  )
}
