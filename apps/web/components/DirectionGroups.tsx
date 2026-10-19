import React from 'react'
import DirectionCard, { SpecialtyCardData } from './DirectionCard'

// v15 (совет 7/9): направления сгруппированы по сферам — витрина главной и
// каталог /employer («понятно о чём»). Подписи, хинты и порядок групп берём из
// данных specialties.json (поля group_*, их пишет scripts/gen_web_data.py).
// Пустые группы не рендерятся: на /employer после фильтра остаются только
// непустые секции. Детерминизм: без Math.random и locale-сортировок.
type Props = {
  specs: SpecialtyCardData[]
  /** showcase — витрина (карточка одним блоком); employer — оба списка */
  variant?: 'showcase' | 'employer'
}

export default function DirectionGroups({ specs, variant = 'showcase' }: Props) {
  const buckets = new Map<string, SpecialtyCardData[]>()
  for (const spec of specs) {
    const bucket = buckets.get(spec.group_id)
    if (bucket) bucket.push(spec)
    else buckets.set(spec.group_id, [spec])
  }
  // порядок секций — фиксированный group_order из данных, не по числу карточек
  const groups = Array.from(buckets.values()).sort(
    (a, b) => a[0].group_order - b[0].group_order
  )
  return (
    <>
      {groups.map((items) => (
        <section key={items[0].group_id} className="spec-group">
          <h2 className="spec-group__title">
            {items[0].group_title}
            <span className="spec-group__count">{items.length}</span>
          </h2>
          <p className="small spec-group__hint">{items[0].group_hint}</p>
          <div className="spec-grid">
            {items.map((spec) => (
              <DirectionCard key={spec.id} spec={spec} variant={variant} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
