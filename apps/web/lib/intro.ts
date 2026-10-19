// Гейт интро-сцены (совет: неблокирующий слой поверх готовой «/», не route).
// v17 (запрос пользователя): лиса пробегает при КАЖДОМ открытии главной —
// сессионный флаг v2 больше не гейт показа. Только «/», Reduce → никогда,
// ?intro=0 — явный выключатель для демо/скриншотов.
// Важно: закрытие сцены — ТОЛЬКО по JS-таймеру/клику/Esc (animationend гасится
// глобальным prefers-reduced-motion {animation:none} в globals.css).
export const INTRO_MS = 4200
// (glm, раунд 2) окно после монта сцены, когда wheel/touchmove не закрывают:
// инерция прокрутки из прошлого скролла и момент fonts-гейта должны пройти
export const SWIPE_GRACE_MS = 400

const INTRO_KEY = 'career-tracker-intro:v2'

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Показывать ли слой интро на текущем кадре. SSR-safe. */
export function shouldShowIntro(): boolean {
  if (typeof window === 'undefined') return false
  if (prefersReducedMotion()) return false
  const opened = new URLSearchParams(window.location.search).get('intro')
  if (opened === '0') return false // демо/скриншоты: явный выключатель
  // v17: каждое открытие главной (полная загрузка и client-side переход на «/»).
  return window.location.pathname === '/'
}

/** Отметка «показано» v6: пишется на монте сцены, но v17 от неё не зависит
 * (сессионный гейт снят по запросу пользователя) — оставлена как маркер. */
export function markIntroShown(): void {
  try {
    window.sessionStorage.setItem(INTRO_KEY, '1')
  } catch {
    /* без флага — показывается снова, не падаем */
  }
}
