// v12: темы «Белая»/«Чёрная». Источник правды — атрибут data-theme на <html>:
// React им не управляет, поэтому hydration mismatch невозможен. Prepaint-скрипт
// в _document применяет сохранённый выбор до первой отрисовки (ноль FOUC);
// этот модуль повторяет ту же логику для клика по переключателю.
export const THEME_KEY = 'career-tracker-theme:v1'

export type ThemeName = 'light' | 'dark'

const META_LIGHT = '#F6F4EF'
const META_DARK = '#121110'

/** Сохранённый выбор; null — выбора нет (гость/хранилище недоступно) → «Белая». */
export function readTheme(): ThemeName | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(THEME_KEY)
    return raw === 'dark' || raw === 'light' ? raw : null
  } catch {
    return null
  }
}

/** Применить тему: атрибут <html>, цвет адресной строки, сохранение выбора. */
export function applyTheme(theme: ThemeName): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  const metas = document.querySelectorAll('meta[name="theme-color"]')
  for (let i = 0; i < metas.length; i++) {
    metas[i].setAttribute('content', theme === 'dark' ? META_DARK : META_LIGHT)
  }
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // гостевой режим: выбор не сохранится — тема живёт до перезагрузки
  }
}
