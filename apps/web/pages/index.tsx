import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

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

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Карьерный трекер</h1>

        <div className="space-y-4">
          <textarea
            rows={4}
            placeholder="Введите ваши навыки, опыт или карьерные цели..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
          />{' '}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {chips.map((chip) => (
              <button
                key={chip}
                onClick={() => alert(`Добавлен чíp: ${chip}`)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {chip}
              </button>
            ))}
          </div>

          <div>
            <button
              className="px-6 py-3 bg-primary-600 text-white rounded-lg text-lg font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-opacity"
            >
              Подставить пример
            </button>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <Link
            href="/result"
            className="text-primary-600 hover:underline"
          >
            Предсказать топ-5 →
          </Link>
        </div>
      </div>
    </main>
  )
}
