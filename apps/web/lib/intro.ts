// Гейт интро-сцены (совет: неблокирующий слой поверх готовой «/», не route).
// Правила: показ 1 раз за сессию (sessionStorage), только на «/», только при
// охвате сверху (scrollY>0 = уже вовлечён, не мешаем), Reduce → никогда.
// Важно: закрытие сцены — ТОЛЬКО по JS-таймеру/клику/Esc (animationend гасится
// глобальным prefers-reduced-motion {animation:none} в globals.css).
export const INTRO_MS = 3200

const INTRO_KEY = 'career-tracker-intro:v1'

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function sessionFlag(): string | null {
  try {
    return window.sessionStorage.getItem(INTRO_KEY)
  } catch {
    return null // приватный/гостевой: показываем со скипом, флаг не пишем
  }
}

/** Показывать ли слой интро на текущем кадре. SSR-safe. */
export function shouldShowIntro(): boolean {
  if (typeof window === 'undefined') return false
  if (prefersReducedMotion()) return false
  const opened = new URLSearchParams(window.location.search).get('intro')
  if (opened === '0') return false
  if (opened === '1') return true // форс для демо: ?intro=1 — показать всегда
  if (window.location.pathname !== '/') return false
  if (window.scrollY > 0) return false // уже проскроллил — не срываем упоминание
  return sessionFlag() !== '1'
}

/** Отметка «показано» пишется на монте сцены (deepseek raund 2), не на финише:
 * вкладка закрытая посреди сцены вернёт интро повторно — это ок (не видел же). */
export function markIntroShown(): void {
  try {
    window.sessionStorage.setItem(INTRO_KEY, '1')
  } catch {
    /* без флага — показывается снова, не падаем */
  }
}
