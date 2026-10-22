import React from 'react'

// v14 (совет 7/9): блок «Где/Кем можно работать» — связка со страницами сайта
// колледжа (данные из lib/specialties.json, снимок — data/college/).
// Правила витрины: один блок на карточку — приоритет «Где», иначе «Кем»
// с усечением до POSITION_LIMIT и хвостом «и ещё N». full=true (интерфейс
// работодателя) показывает оба списка целиком. Нет данных — нет блока.
const POSITION_LIMIT = 4

type Props = {
  employers: string[]
  positions: string[]
  source: string
  full?: boolean
  /** v31: в каталоге источник показывается один раз на раздел, а не в каждой
      из 21 карточки (одна и та же строка 21 раз — шум). */
  showSource?: boolean
}

export default function CollegeWork({
  employers,
  positions,
  source,
  full = false,
  showSource = true,
}: Props) {
  const hasEmployers = employers.length > 0
  const hasPositions = positions.length > 0
  if (!hasEmployers && !hasPositions) return null
  // «Кем»: на витрине показываем только когда нет «Где»; работодателю — всегда
  const showPositions = hasPositions && (full || !hasEmployers)
  const shown = full ? positions : positions.slice(0, POSITION_LIMIT)
  const rest = positions.length - shown.length
  return (
    <div className="spec-work">
      {hasEmployers && (
        <>
          <span className="spec-work__label">Где можно работать</span>
          <ul className="spec-work__list">
            {employers.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </>
      )}
      {showPositions && (
        <>
          <span className="spec-work__label">Кем можно работать</span>
          <ul className="spec-work__list">
            {shown.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          {!full && rest > 0 && (
            <span className="spec-work__more">и ещё {rest}</span>
          )}
        </>
      )}
      {showSource && <span className="spec-work__source">Источник: {source}</span>}
    </div>
  )
}
