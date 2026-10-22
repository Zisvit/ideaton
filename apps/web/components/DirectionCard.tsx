import React from 'react'
import CollegeWork from './CollegeWork'

// v14 (совет 7/9): общая карточка направления — витрина главной (/),
// интерфейс работодателя (/employer) и строки результата (/result).
// Данные — lib/specialties.json (генерируется scripts/gen_web_data.py),
// здесь только разметка и правила показа.
export type SpecialtyCardData = {
  id: string
  title: string
  /** v15: группа витрины — слаг, подпись, хинт и порядок (генерируется) */
  group_id: string
  group_title: string
  group_hint: string
  group_order: number
  description: string
  skills: { id: string; name: string }[]
  employers: string[]
  positions: string[]
  source: string
}

type Props = {
  spec: SpecialtyCardData
  /** showcase — витрина (один блок на карточку); employer — оба списка полные */
  variant?: 'showcase' | 'employer'
}

export default function DirectionCard({ spec, variant = 'showcase' }: Props) {
  return (
    <article className="card spec-item">
      <h3 className="spec-item__title">{spec.title}</h3>
      <p className="small spec-item__desc">{spec.description}</p>
      <div className="spec-item__skills">
        {spec.skills.map((skill) => (
          <span key={skill.id} className="spec-skill">
            {skill.name}
          </span>
        ))}
      </div>
      <CollegeWork
        employers={spec.employers}
        positions={spec.positions}
        source={spec.source}
        full={variant === 'employer'}
        showSource={false}
      />
    </article>
  )
}
