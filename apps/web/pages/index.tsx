import React from 'react'
import Link from 'next/link'
import { EXAMPLE_PROFILE, Profile, saveProfile } from '../lib/api'

export default function Home() {
  const chips = [
    'Python',
    'JavaScript',
    'TypeScript',
    'React',
    'Node.js',
    'FastAPI',
    'Docker',
    'Kubernetes',
  ]

  const [selected, setSelected] = React.useState<string[]>([])
  const [text, setText] = React.useState('')

  const toggleChip = (chip: string) => {
    setSelected((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    )
  }

  const fillExample = () => {
    saveProfile(EXAMPLE_PROFILE)
    setSelected(EXAMPLE_PROFILE.skills)
    setText('')
  }

  // Собираем профиль (контракт Profile) и кладём в localStorage → /result.
  const goResult = () => {
    const typed = text
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const skills = Array.from(new Set([...selected, ...typed]))
    const profile: Profile =
      skills.length > 0
        ? { skills, interests: [], subjects: [] }
        : EXAMPLE_PROFILE
    saveProfile(profile)
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Карьерный трекер</h1>

        <div className="space-y-4">
          <textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Введите ваши навыки, опыт или карьерные цели..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
          />{' '}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {chips.map((chip) => (
              <button
                key={chip}
                onClick={() => toggleChip(chip)}
                className={`px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  selected.includes(chip)
                    ? 'bg-primary-700 text-white'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {selected.includes(chip) ? `✓ ${chip}` : chip}
              </button>
            ))}
          </div>

          <div>
            <button
              onClick={fillExample}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg text-lg font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-opacity"
            >
              Подставить пример
            </button>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <Link
            href="/result"
            onClick={goResult}
            className="text-primary-600 hover:underline"
          >
            Предсказать топ-5 →
          </Link>
        </div>
      </div>
    </main>
  )
}
