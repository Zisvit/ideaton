import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import ThemeToggle from './ThemeToggle'

/**
 * v33: оболочка приложения — по референсу career-tracker.html.
 *
 * Референс — прототип «кабинета студента»: белый сайдбар с навигацией,
 * топбар с вкладками ролей, на телефоне — нижняя навигация. Здесь та же
 * схема, но с нашими разделами и данными: оболочка даёт рамку, а логика
 * (навыки, подбор, план, консультант, работодатель) остаётся прежней.
 */

/** Иконки — из референса (один контур, 24×24, обводка currentColor). */
const ICONS = {
  home: <path d="m3 10 9-7 9 7v10H15v-6H9v6H3z" />,
  bag: (
    <>
      <rect x="3" y="6" width="18" height="15" rx="3" />
      <path d="M8 6V3h8v3M3 12h18M10 12v3h4v-3" />
    </>
  ),
  chart: <path d="M4 21V10h4v11M10 21V3h4v18M16 21v-7h4v7" />,
  group: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-3c0-5 12-5 12 0v3M16 5a3 3 0 0 1 0 6M18 14c3 0 4 2 4 4v3" />
    </>
  ),
  spark: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />,
} as const

type NavItem = {
  href: string
  label: string
  icon: keyof typeof ICONS
  /** короткая подпись — для нижней навигации на телефоне */
  short?: string
}

const NAV: NavItem[] = [
  { href: '/', label: 'Сегодня', icon: 'home', short: 'Сегодня' },
  { href: '/result', label: 'Мои направления', icon: 'bag', short: 'Направления' },
  { href: '/plan', label: 'Мой путь', icon: 'chart', short: 'План' },
  { href: '/employer', label: 'Работодателю', icon: 'group', short: 'Работодатель' },
  { href: '/consultant', label: 'Помощник', icon: 'spark', short: 'Помощник' },
]

/** Вкладки ролей — как в референсе (студент / компания / третий раздел). */
const ROLES: NavItem[] = [
  { href: '/', label: 'Студент', icon: 'home' },
  { href: '/employer', label: 'Компания', icon: 'group' },
  { href: '/consultant', label: 'Помощник', icon: 'spark' },
]

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const path = router.pathname
  const isActive = (href: string) =>
    href === '/' ? path === '/' : path.startsWith(href)

  return (
    <div className="shell">
      <aside className="side">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            Карьерный
            <br />
            трекер
          </span>
        </Link>
        <nav aria-label="Основная навигация">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(item.href) ? 'is-active' : undefined}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="side-card">
          <strong>Будущая работа ближе</strong>
          <p>Сделай один небольшой шаг сегодня.</p>
          <Link href="/#skills" className="btn soft full">
            Отметить навыки
          </Link>
        </div>
        <p className="side-foot">Прототип · работает офлайн</p>
      </aside>

      <main className="main">
        <header className="topbar">
          <Link href="/" className="brand mobile-brand">
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Карьерный трекер
          </Link>
          <span className="context">Личный кабинет студента</span>
          <div className="role-tabs" role="group" aria-label="Выбор раздела">
            {ROLES.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isActive(item.href) ? 'is-active' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="top-right">
            <ThemeToggle />
            <span className="avatar" aria-hidden="true">
              С
            </span>
          </div>
        </header>
        {children}
      </main>

      <nav className="bottom-nav" aria-label="Нижняя навигация">
        {NAV.slice(0, 4).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(item.href) ? 'is-active' : undefined}
          >
            <Icon name={item.icon} />
            {item.short ?? item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
