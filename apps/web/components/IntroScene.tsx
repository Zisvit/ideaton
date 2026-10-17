import React from 'react'
import { INTRO_MS } from '../lib/intro'

// Лис «Идея» v5 — гиперреальный талисман ПРОЕКТА (не официальный символ вуза:
// брендбука СИУЭиП в репо нет, имитировать фирменный знак запрещено советом).
// ViewBox 0 0 320 240, земля y=208, нос вправо. Все амплитуды в user units
// (внутри SVG CSS-px == user unit); origin каждой суставной точки задаётся
// inline --ox/--oy, CSS делает transform-box: view-box для всех узлов.
// 14 анимируемых групп; пик одновременных композитных transform ≈ 11
// (space-bunny/big-pickle, раунд 2). Тайминг — в globals.css (СЦЕНЫ v5),
// шкала --tl = INTRO_MS = 4200ms.
export function Fox() {
  return (
    <svg
      className="intro-fox"
      viewBox="0 0 320 240"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id="foxCoat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F18C46" />
          <stop offset=".55" stopColor="#E8722C" />
          <stop offset="1" stopColor="#CE5D1B" />
        </linearGradient>
        <radialGradient id="foxHaunch" cx=".36" cy=".28" r=".8">
          <stop offset="0" stopColor="rgba(164,74,18,0)" />
          <stop offset="1" stopColor="rgba(164,74,18,.42)" />
        </radialGradient>
        <radialGradient id="foxShadow">
          <stop offset="0" stopColor="rgba(18,20,26,.22)" />
          <stop offset="1" stopColor="rgba(18,20,26,0)" />
        </radialGradient>
      </defs>

      {/* тень: вне bob-группы — не прыгает вместе с телом */}
      <ellipse className="fox-shadow" cx="160" cy="209" rx="86" ry="7" fill="url(#foxShadow)" />

      <g className="fox-bob" style={{ '--ox': '160px', '--oy': '208px' } as React.CSSProperties}>
        {/* хвост: 2 сустава + кремовый кончик; run-волна на внешних группах,
            idle-волна — на вложенных (преемственность от конца бега) */}
        <g className="fox-tail-a" style={{ '--ox': '42px', '--oy': '126px', '--tw': '6deg' } as React.CSSProperties}>
          <g className="fx-tail-idle-a" style={{ '--ox': '42px', '--oy': '126px', '--tw': '5deg' } as React.CSSProperties}>
            <path d="M80 152 C58 152 44 142 40 128 C38 120 42 114 48 112 C50 124 60 134 82 136 Z" fill="url(#foxCoat)" />
          </g>
          <g className="fox-tail-b" style={{ '--ox': '50px', '--oy': '110px', '--tw': '9deg' } as React.CSSProperties}>
            <g className="fx-tail-idle-b" style={{ '--ox': '50px', '--oy': '110px', '--tw': '8deg' } as React.CSSProperties}>
              <path d="M50 112 C36 104 22 92 16 78 C12 68 16 60 24 58 C26 72 36 88 56 100 Z" fill="url(#foxCoat)" />
              <path className="fx-tail-tip" d="M13 74 C11 66 15 59 24 58 C26 64 26 70 24 76 Z" fill="var(--fox-soft)" />
            </g>
          </g>
        </g>

        {/* дальние ноги: за телом, приглушённые; диагональ задержек = галоп */}
        <g className="fox-far-legs">
          <path
            className="fx-leg-fh"
            style={{ '--ox': '104px', '--oy': '166px' } as React.CSSProperties}
            d="M104 166 L100 190 L102 203"
            stroke="var(--fox-deep)" strokeWidth="11" strokeLinecap="round" fill="none" opacity=".6"
          />
          <path
            className="fx-leg-ff"
            style={{ '--ox': '188px', '--oy': '160px' } as React.CSSProperties}
            d="M188 160 L186 188 L186 203"
            stroke="var(--fox-deep)" strokeWidth="11" strokeLinecap="round" fill="none" opacity=".6"
          />
        </g>

        {/* корпус: спина-градиент, светлый живот, бедро-штрих, мех-штрихи, воротник */}
        <g className="fox-chest" style={{ '--ox': '200px', '--oy': '156px' } as React.CSSProperties}>
          <path d="M62 150 C66 128 96 116 132 114 C164 112 190 114 202 124 C210 132 214 148 212 164 C210 176 196 182 170 184 C140 186 104 186 82 178 C70 174 60 164 62 150 Z" fill="url(#foxCoat)" />
          <path d="M70 168 C90 156 120 150 150 152 C176 154 196 150 208 140 C212 148 214 158 212 166 C210 178 194 184 166 185 C136 186 100 185 80 177 Z" fill="var(--fox-soft)" />
          <path d="M64 138 C84 124 118 126 126 148 C130 166 112 178 88 176 C68 174 58 156 64 138 Z" fill="url(#foxHaunch)" />
          <g stroke="var(--fox-dark)" strokeWidth="1" strokeLinecap="round" opacity=".45" fill="none">
            <path d="M96 168 C104 172 112 174 120 174" />
            <path d="M172 168 C182 170 192 170 200 168" />
            <path d="M138 126 C152 122 168 122 180 126" />
            <path d="M186 132 C196 136 206 138 212 136" />
          </g>
          <path d="M204 126 C214 117 227 111 238 107 C234 119 227 131 216 141 C209 148 199 148 195 141 Z" fill="var(--fox-soft)" />
        </g>

        {/* ближние ноги: бедро (coat) → голень (deep) → носок-лапа (deep) */}
        <g className="fox-leg-near-hind">
          <path className="fx-thigh-nh" style={{ '--ox': '112px', '--oy': '160px' } as React.CSSProperties} d="M112 160 L100 188" stroke="var(--fox)" strokeWidth="15" strokeLinecap="round" />
          <path className="fx-shin-nh" style={{ '--ox': '100px', '--oy': '186px' } as React.CSSProperties} d="M100 188 L96 205" stroke="var(--fox-deep)" strokeWidth="10" strokeLinecap="round" />
          <path className="fx-paw-nh" style={{ '--ox': '96px', '--oy': '204px' } as React.CSSProperties} d="M89 201 C90 199 104 198 106 201 C108 204 106 207 103 208 L93 209 C90 208 88 204 89 201 Z" fill="var(--fox-deep)" />
        </g>
        <g className="fox-leg-near-fore">
          <path className="fx-thigh-nf" style={{ '--ox': '196px', '--oy': '158px' } as React.CSSProperties} d="M196 158 L190 188" stroke="var(--fox)" strokeWidth="14" strokeLinecap="round" />
          <path className="fx-shin-nf" style={{ '--ox': '190px', '--oy': '186px' } as React.CSSProperties} d="M190 188 L186 205" stroke="var(--fox-deep)" strokeWidth="9" strokeLinecap="round" />
          <path className="fx-paw-nf" style={{ '--ox': '186px', '--oy': '204px' } as React.CSSProperties} d="M179 201 C180 199 194 198 196 201 C198 204 196 207 193 208 L183 209 C180 208 178 204 179 201 Z" fill="var(--fox-deep)" />
        </g>

        {/* дальнее ухо: за головой; ближнее — внутри head-группы (наследует боб) */}
        <g className="fx-ear fx-ear-far" style={{ '--ox': '238px', '--oy': '72px', '--ea': '-10deg', '--eb': '-5deg' } as React.CSSProperties}>
          <g className="fx-ear-inner">
            <path d="M232 73 C228 61 232 50 240 46 C244 56 246 66 246 75 Z" fill="#CE5D1B" />
            <path d="M235 71 C233 63 236 56 240 54 C242 60 242 66 241 72 Z" fill="var(--fox-soft)" opacity=".55" />
          </g>
        </g>

        <g className="fx-head" style={{ '--ox': '208px', '--oy': '124px' } as React.CSSProperties}>
          {/* череп с мордой: купол, клин, щека-крем */}
          <path d="M214 94 C215 78 231 68 248 72 C261 75 269 84 273 94 L291 110 C294 114 292 119 288 120 C279 123 269 122 261 120 C253 127 239 129 229 124 C221 120 214 110 214 94 Z" fill="url(#foxCoat)" />
          <path d="M258 120 C268 122 279 123 288 120 C283 127 270 130 260 128 Z" fill="var(--fox-soft)" />
          {/* глаз с бликами (blink вешается на группу — атрибутный rotate
              ellipse не перебивается CSS-анимацией) */}
          <g className="fx-eye" style={{ '--ox': '263px', '--oy': '96px' } as React.CSSProperties}>
            <ellipse cx="263" cy="96" rx="9" ry="6.5" transform="rotate(-8 263 96)" fill="var(--fox-eye)" />
            <circle cx="261" cy="93" r="2.4" fill="#fff" opacity=".92" />
            <circle cx="266" cy="97.5" r="1.1" fill="#fff" opacity=".5" />
          </g>
          {/* нос + блик на нём, рот, усы */}
          <path d="M284 104 C291 104 296 108 295 113 C294 118 288 120 283 118 C279 116 278 109 280 106 Z" fill="var(--fox-nose)" />
          <path d="M283 106 C286 105 290 107 290 110 C287 111 284 110 282 109 Z" fill="#7A5A48" opacity=".5" />
          <path d="M295 119 C291 123 286 124 281 122" stroke="var(--fox-nose)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          <g
            className="fx-whiskers"
            style={{ '--ox': '270px', '--oy': '118px' } as React.CSSProperties}
            stroke="var(--fox-nose)" strokeWidth=".9" strokeLinecap="round" opacity=".42" fill="none"
          >
            <path d="M270 118 C263 121 257 124 252 126" />
            <path d="M270 118 C262 124 255 128 248 131" />
            <path d="M270 118 C265 120 259 122 254 123" />
          </g>
          <g className="fx-ear fx-ear-near" style={{ '--ox': '256px', '--oy': '72px', '--ea': '-16deg', '--eb': '-8deg' } as React.CSSProperties}>
            <g className="fx-ear-inner">
              <path d="M248 71 C246 57 252 44 262 40 C264 52 264 64 262 75 Z" fill="url(#foxCoat)" />
              <path d="M252 70 C251 60 255 51 261 48 C262 56 262 64 261 71 Z" fill="var(--fox-soft)" opacity=".6" />
            </g>
          </g>
        </g>
      </g>

      {/* пыль при приземлении: вне bob (не тянется за squash) */}
      <circle className="fx-dust" cx="160" cy="208" r="14" fill="var(--fox-deep)" opacity="0" />
    </svg>
  )
}

// Интро-сцена: неблокирующий слой НАД уже отрендеренной «/». Никакого route
// и никакого overflow:hidden (скролл не блокируем — CLS/scrollbar). Закрытие
// только по JS-таймеру или явному действию (клик/Esc/колесо/тач): animationend
// при prefers-reduced-motion не приходит НИКОГДА — глобальный animation:none.
export default function IntroScene({ onDone }: { onDone: () => void }) {
  // Прогон сцены стартует после fonts-гейта (потолок 400 мс): сцена не
  // ждёт wifi в демо-зале, FOUT не рвёт блик в середине.
  const [run, setRun] = React.useState(false)
  const doneRef = React.useRef(false)

  const finish = React.useCallback(() => {
    if (!doneRef.current) {
      doneRef.current = true
      onDone()
    }
  }, [onDone])

  React.useEffect(() => {
    let cancelled = false
    let closeTimer = 0
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    Promise.race([
      fonts?.ready ?? Promise.resolve(),
      new Promise((r) => window.setTimeout(r, 400)),
    ]).then(() => {
      if (cancelled) return
      setRun(true) // единая шкала INTRO_MS=4200 стартует отсюда (CSS var --tl)
      closeTimer = window.setTimeout(finish, INTRO_MS + 120) // страховка закрытия
    })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
    }
    // скип жестом: колесо/тач = «давай дальше» (super-vl/space-bunny, раунд 2)
    const onSwipe = () => finish()
    // полсекунды ОС переключила reduce на полутона сцены — закрываем честно
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onRm = () => {
      if (rm.matches) finish()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onSwipe, { passive: true })
    window.addEventListener('touchmove', onSwipe, { passive: true })
    rm.addEventListener?.('change', onRm)
    return () => {
      cancelled = true
      if (closeTimer) window.clearTimeout(closeTimer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onSwipe)
      window.removeEventListener('touchmove', onSwipe)
      rm.removeEventListener?.('change', onRm)
    }
  }, [finish])

  return (
    <div
      className={`intro-overlay${run ? ' is-run' : ''}`}
      style={{ '--tl': `${INTRO_MS}ms` } as React.CSSProperties}
      role="presentation"
      onClick={finish}
    >
      <div className="intro-scene" aria-hidden="true">
        <div className="intro-aurora" />
        <div className="intro-mark">
          <span className="intro-mark__glyph">СИ</span>
        </div>
        <div className="intro-fox-wrap">
          <Fox />
        </div>
        <div className="intro-caption">Карьерный трекер · проект СИУЭиП · талисман Лис Идея</div>
      </div>
      <button type="button" className="intro-skip" onClick={finish}>
        Пропустить
      </button>
    </div>
  )
}
