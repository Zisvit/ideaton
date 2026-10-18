import React from 'react'
import { INTRO_MS, SWIPE_GRACE_MS } from '../lib/intro'

// Лис «Идея» v8 — талисман ПРОЕКТА (не официальный символ вуза: брендбука
// СИУЭиП в репо нет, имитировать фирменный знак запрещено советом).
// ViewBox 0 0 360 260, земля y=232, нос вправо. Все амплитуды в user units
// (внутри SVG CSS-px == user unit); origin каждой суставной точки задаётся
// inline --ox/--oy, CSS делает transform-box: view-box для всех узлов.
// Рисунок v8: объёмный мех (градиенты+штрихи), анатомичные лапы с суставами,
// белая манишка/щёки/кончик хвоста, чёрные «носки», янтарный глаз. Хореография
// прежняя (30/30 keyframes, без новых): бег → прыжок → посадка → idle.
export function Fox() {
  return (
    <svg
      className="intro-fox"
      viewBox="0 0 360 260"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id="foxCoat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8A55E" />
          <stop offset=".34" stopColor="#F08A40" />
          <stop offset=".68" stopColor="#E3702A" />
          <stop offset="1" stopColor="#C95615" />
        </linearGradient>
        <linearGradient id="foxCoatDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D9641F" />
          <stop offset="1" stopColor="#A8460F" />
        </linearGradient>
        <linearGradient id="foxTail" gradientUnits="userSpaceOnUse" x1="140" y1="146" x2="18" y2="208">
          <stop offset="0" stopColor="#E9772D" />
          <stop offset=".45" stopColor="#F0904A" />
          <stop offset=".78" stopColor="#E9772D" />
          <stop offset="1" stopColor="#D9621F" />
        </linearGradient>
        <linearGradient id="foxTip" gradientUnits="userSpaceOnUse" x1="72" y1="188" x2="16" y2="204">
          <stop offset="0" stopColor="#FFF6EA" stopOpacity="0" />
          <stop offset=".38" stopColor="#FFF4E4" stopOpacity=".75" />
          <stop offset=".72" stopColor="#FFF7EC" />
          <stop offset="1" stopColor="#FFFDF8" />
        </linearGradient>
        <linearGradient id="foxSoft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF8EE" />
          <stop offset=".55" stopColor="#FFEAD4" />
          <stop offset="1" stopColor="#F7D2B1" />
        </linearGradient>
        <radialGradient id="foxHaunch">
          <stop offset="0" stopColor="rgba(126,49,10,.26)" />
          <stop offset=".7" stopColor="rgba(126,49,10,.09)" />
          <stop offset="1" stopColor="rgba(126,49,10,0)" />
        </radialGradient>
        <radialGradient id="foxShadow">
          <stop offset="0" stopColor="rgba(18,20,26,.28)" />
          <stop offset=".55" stopColor="rgba(18,20,26,.13)" />
          <stop offset="1" stopColor="rgba(18,20,26,0)" />
        </radialGradient>
        <radialGradient id="foxEye" cx=".36" cy=".3" r=".78">
          <stop offset="0" stopColor="#FFD07B" />
          <stop offset=".52" stopColor="#F2A33C" />
          <stop offset="1" stopColor="#B46813" />
        </radialGradient>
      </defs>

      {/* тень: вне bob-группы — не прыгает вместе с телом; шире и мягче —
          «земля» читается гуще (longcat, раунд 2) */}
      <ellipse className="fox-shadow" cx="186" cy="232" rx="110" ry="10" fill="url(#foxShadow)" />

      <g className="fox-bob" style={{ '--ox': '190px', '--oy': '232px' } as React.CSSProperties}>
        {/* ХВОСТ: густой «brush», белый кончик на внешней группе (волна бега) */}
        <g className="fox-tail-a" style={{ '--ox': '140px', '--oy': '164px', '--tw': '5deg' } as React.CSSProperties}>
          <g className="fx-tail-idle-a" style={{ '--ox': '140px', '--oy': '164px', '--tw': '4deg' } as React.CSSProperties}>
            <path
              d="M140 160 C128 144 106 136 82 136 C56 136 30 150 16 172 C4 190 10 208 24 214 C38 219 54 208 68 193 C84 176 104 170 120 176 C128 180 137 178 141 170 Z"
              fill="url(#foxTail)"
            />
            {/* объём: тень по низу и тёплый блик по верху */}
            <path
              d="M20 205 C34 213 50 204 63 191 C73 181 82 177 91 176 C78 179 66 187 56 198 C43 212 29 214 21 205 Z"
              fill="#A8460F" opacity=".22"
            />
            <path
              d="M22 175 C40 155 64 141 88 139" stroke="#FFC58D" strokeWidth="1.5"
              strokeLinecap="round" fill="none" opacity=".5"
            />
            <g stroke="#8F3A0C" strokeWidth="1" strokeLinecap="round" fill="none" opacity=".28">
              <path d="M60 158 C72 154 84 152 96 154" />
              <path d="M48 182 C56 190 64 196 72 199" />
              <path d="M84 148 C96 146 108 148 118 154" />
            </g>
          </g>
          <g className="fox-tail-b" style={{ '--ox': '58px', '--oy': '186px', '--tw': '8deg' } as React.CSSProperties}>
            <g className="fx-tail-idle-b" style={{ '--ox': '58px', '--oy': '186px', '--tw': '7deg' } as React.CSSProperties}>
              <path
                d="M72 187 C60 197 51 206 42 212 C31 219 19 215 13 206 C7 197 11 185 19 176 C27 167 38 161 49 159 C41 169 36 180 37 191 C38 201 45 207 53 205 C60 203 67 196 72 187 Z"
                fill="url(#foxTip)"
              />
              <path
                d="M20 178 C29 168 39 162 49 159" stroke="#FFFDF8" strokeWidth="1.2"
                strokeLinecap="round" fill="none" opacity=".45"
              />
            </g>
          </g>
        </g>

        {/* ДАЛЬНИЕ НОГИ: за телом, приглушённые, диагональ задержек = галоп */}
        <g className="fox-far-legs">
          <g className="fx-leg-fh" style={{ '--ox': '126px', '--oy': '170px' } as React.CSSProperties}>
            <path d="M126 170 C130 186 134 203 136 220" stroke="#B24E14" strokeWidth="12" strokeLinecap="round" fill="none" opacity=".9" />
            <path d="M136 218 C138 222 138 226 136 229" stroke="#2B1B11" strokeWidth="9" strokeLinecap="round" fill="none" />
          </g>
          <g className="fx-leg-ff" style={{ '--ox': '244px', '--oy': '158px' } as React.CSSProperties}>
            <path d="M244 158 C241 176 239 196 238 216" stroke="#B24E14" strokeWidth="11" strokeLinecap="round" fill="none" opacity=".9" />
            <path d="M238 214 C238 220 237 225 236 229" stroke="#2B1B11" strokeWidth="8" strokeLinecap="round" fill="none" />
          </g>
        </g>

        {/* КОРПУС+ШЕЯ: спина-градиент, живот-крем, бедро, воротник, блики меха */}
        <g className="fox-chest" style={{ '--ox': '232px', '--oy': '168px' } as React.CSSProperties}>
          <path
            d="M124 154 C130 140 154 132 182 131 C210 130 236 134 250 143 C258 128 274 116 292 112 L308 132 C294 140 280 154 273 170 C270 182 260 190 244 193 C218 197 184 196 158 192 C138 189 124 182 119 173 C115 165 118 159 124 154 Z"
            fill="url(#foxCoat)"
          />
          {/* тень низа корпуса над кремовым животом */}
          <path
            d="M120 174 C140 186 168 193 194 194 C220 195 246 189 262 178 C260 185 248 192 228 195 C200 199 166 196 142 190 C130 187 122 181 120 174 Z"
            fill="#A8460F" opacity=".2"
          />
          {/* живот и грудь — тёплый крем */}
          <path
            d="M128 175 C144 183 166 188 190 189 C214 190 236 186 251 179 C247 186 234 190 216 191 C190 193 162 189 144 184 C136 182 130 179 128 175 Z"
            fill="url(#foxSoft)"
          />
          <path
            d="M268 160 C274 168 276 178 274 188 C268 181 262 176 255 173 C248 170 242 169 236 170 C243 163 253 160 262 160 Z"
            fill="url(#foxSoft)" opacity=".96"
          />
          {/* бедро: мягкий объём ПО задней ляжке (тёмный центр → прозрачный край),
              не «водяной знак» по корпусу (правка по кадрам) */}
          <ellipse cx="128" cy="192" rx="18" ry="23" fill="url(#foxHaunch)" />
          <ellipse cx="246" cy="160" rx="26" ry="21" fill="#FFC58D" opacity=".12" />
          {/* воротник: пушистый край под подбородком */}
          <path
            d="M280 138 C288 144 292 152 291 161 C286 155 281 151 275 149 C278 145 279 141 280 138 Z"
            fill="url(#foxSoft)" opacity=".9"
          />
          {/* мех: направление шерсти */}
          <g stroke="#8F3A0C" strokeWidth="1" strokeLinecap="round" fill="none" opacity=".3">
            <path d="M150 158 C160 154 172 152 184 152" />
            <path d="M168 172 C180 175 192 175 204 173" />
            <path d="M226 162 C236 165 245 165 253 162" />
            <path d="M134 178 C142 181 150 183 158 183" />
          </g>
          <g stroke="#FFD3A6" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity=".5">
            <path d="M132 150 C148 140 168 135 190 135 C212 135 232 139 244 146" />
            <path d="M156 128 C168 124 182 123 194 124" />
          </g>
        </g>

        {/* БЛИЖНИЕ НОГИ: бедро → голень → чёрная лапа, у каждого свой сустав */}
        <g className="fox-leg-near-hind">
          <g className="fx-thigh-nh" style={{ '--ox': '132px', '--oy': '168px' } as React.CSSProperties}>
            <path d="M132 180 C128 189 124 199 121 207" stroke="#E27127" strokeWidth="19" strokeLinecap="round" fill="none" />
            <path d="M125 186 C120 193 118 200 118 206 C121 200 125 195 130 191 Z" fill="#C95615" opacity=".6" />
            {/* суставная выпуклость колена (beam, раунд 2) */}
            <ellipse cx="126" cy="194" rx="4" ry="3" fill="#D9641F" opacity=".7" />
          </g>
          <g className="fx-shin-nh" style={{ '--ox': '121px', '--oy': '205px' } as React.CSSProperties}>
            <path d="M121 205 C118 213 115 221 113 229" stroke="url(#foxCoatDark)" strokeWidth="11" strokeLinecap="round" fill="none" />
          </g>
          <g className="fx-paw-nh" style={{ '--ox': '113px', '--oy': '229px' } as React.CSSProperties}>
            <path
              d="M106 227 C106 224 110 222 115 222 C120 222 124 225 123 228 C122 231 117 232 112 232 C108 232 106 230 106 227 Z"
              fill="#2B1B11"
            />
            <path d="M112 224 C112 227 112 230 112 232" stroke="#4A2E1E" strokeWidth=".8" opacity=".6" />
          </g>
        </g>
        <g className="fox-leg-near-fore">
          <g className="fx-thigh-nf" style={{ '--ox': '252px', '--oy': '158px' } as React.CSSProperties}>
            <path d="M252 166 C254 175 256 184 257 192" stroke="#E27127" strokeWidth="16" strokeLinecap="round" fill="none" />
            <path d="M247 176 C245 183 245 189 246 194 C248 189 250 185 253 181 Z" fill="#C95615" opacity=".55" />
            <ellipse cx="253" cy="182" rx="3.5" ry="3" fill="#D9641F" opacity=".7" />
          </g>
          <g className="fx-shin-nf" style={{ '--ox': '257px', '--oy': '192px' } as React.CSSProperties}>
            <path d="M257 192 C256 202 254 212 252 221" stroke="url(#foxCoatDark)" strokeWidth="9" strokeLinecap="round" fill="none" />
          </g>
          <g className="fx-paw-nf" style={{ '--ox': '252px', '--oy': '222px' } as React.CSSProperties}>
            <path
              d="M246 219 C246 216 251 214 257 215 C262 216 265 219 264 222 C263 225 257 227 252 226 C247 225 245 222 246 219 Z"
              fill="#2B1B11"
            />
            <path d="M258 217 C257 220 256 223 255 226" stroke="#4A2E1E" strokeWidth=".8" opacity=".6" />
          </g>
        </g>

        {/* ДАЛЬНЕЕ УХО: за головой; ближнее — внутри head-группы */}
        <g className="fx-ear fx-ear-far" style={{ '--ox': '316px', '--oy': '104px', '--ea': '-9deg', '--eb': '-4deg' } as React.CSSProperties}>
          <g className="fx-ear-inner">
            <path d="M316 104 C315 85 321 65 329 55 C332 51 335 53 334 59 C330 77 326 94 324 102 Z" fill="#8F3A0C" />
            <path d="M319 100 C320 84 325 69 330 60 C332 57 333 59 332 63 C328 78 325 91 323 99 Z" fill="#C25A1B" opacity=".5" />
          </g>
        </g>

        <g className="fx-head" style={{ '--ox': '300px', '--oy': '134px' } as React.CSSProperties}>
          {/* череп+морда: клин, купол, кремовые щёки и подбородок */}
          <path
            d="M298 124 C296 109 305 97 318 95 C330 93 340 99 345 108 L355 117 C359 119 359 123 355 125 L344 127 C340 137 330 143 319 141 C308 139 300 133 298 124 Z"
            fill="url(#foxCoat)"
          />
          <path
            d="M309 126 C303 133 300 142 302 151 C306 145 309 142 314 140 C311 135 310 130 309 126 Z"
            fill="url(#foxSoft)" opacity=".92"
          />
          <path
            d="M313 132 C320 131 330 133 338 137 C337 143 330 147 322 147 C315 147 311 142 309 137 Z"
            fill="url(#foxSoft)"
          />
          <path
            d="M318 141 C326 144 335 141 341 136 C342 141 335 147 325 148 C318 149 314 145 313 142 Z"
            fill="url(#foxSoft)" opacity=".95"
          />
          {/* нос: чёрный, с бликом */}
          <ellipse cx="352" cy="122" rx="6.2" ry="5.2" transform="rotate(-12 352 122)" fill="var(--fox-nose)" />
          <path d="M349 119 C351 118 354 119 355 121 C353 122 350 122 348 121 Z" fill="#7A5A48" opacity=".5" />
          {/* рот */}
          <path d="M348 127 C344 132 338 135 332 136" stroke="var(--fox-nose)" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity=".8" />
          {/* глаз: янтарь, вертикальный зрачок, блики; blink на группе */}
          <g className="fx-eye" style={{ '--ox': '325px', '--oy': '111px' } as React.CSSProperties}>
            <ellipse cx="325" cy="111" rx="7.6" ry="5.5" transform="rotate(-10 325 111)" fill="url(#foxEye)" />
            <ellipse cx="325.5" cy="111.2" rx="1.9" ry="4.2" transform="rotate(-10 325.5 111.2)" fill="#1F130D" />
            <ellipse cx="325.5" cy="111.2" rx="1.9" ry="4.2" transform="rotate(-10 325.5 111.2)" fill="none" stroke="#8A4A10" strokeWidth=".5" opacity=".6" />
            <circle cx="322.8" cy="108.9" r="1.6" fill="#fff" opacity=".88" />
            <circle cx="327.7" cy="112.9" r=".8" fill="#fff" opacity=".45" />
            <path d="M318 106 C322 103.5 330 103.5 334 106.5" stroke="#8F3A0C" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".75" />
          </g>
          <path d="M332 114 C336 117 338 121 339 125" stroke="#8F3A0C" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity=".45" />
          <path d="M318 102 C322 100 329 100 333 102" stroke="#FFE9D2" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".55" />
          {/* усы */}
          <g
            className="fx-whiskers"
            style={{ '--ox': '340px', '--oy': '132px' } as React.CSSProperties}
            stroke="var(--fox-nose)" strokeWidth=".9" strokeLinecap="round" opacity=".36" fill="none"
          >
            <path d="M340 132 C332 134 324 137 317 140" />
            <path d="M341 135 C333 139 326 143 320 148" />
            <path d="M339 129 C331 129 323 130 316 132" />
          </g>
          {/* ближнее ухо: тёмная внешняя кромка, кремовая внутренность */}
          <g className="fx-ear fx-ear-near" style={{ '--ox': '306px', '--oy': '104px', '--ea': '-15deg', '--eb': '-7deg' } as React.CSSProperties}>
            <g className="fx-ear-inner">
              <path d="M303 106 C299 88 302 68 310 56 C313 51 316 53 316 59 C318 76 319 93 320 103 Z" fill="url(#foxCoatDark)" />
              <path d="M307 102 C304 88 306 72 312 62 C314 58 315 60 315 65 C316 79 317 92 317 100 Z" fill="url(#foxSoft)" opacity=".92" />
            </g>
          </g>
          {/* мех на щеке/лбу */}
          <g stroke="#8F3A0C" strokeWidth="1" strokeLinecap="round" fill="none" opacity=".3">
            <path d="M305 120 C309 124 311 129 311 134" />
            <path d="M313 120 C312 124 313 128 315 131" />
          </g>
        </g>
      </g>

      {/* пыль при приземлении: вне bob (не тянется за squash) */}
      {/* пыль в момент приземления. Задержки 1740/1780/1810 — только в CSS
          (.is-run .fx-dust + .d2/.d3): inline animationDelay перебивал бы
          шорткатный delay 1740ms (space-bunny, раунд 2). */}
      <circle className="fx-dust" cx="186" cy="232" r="18" fill="var(--fox-deep)" opacity="0" />
      <circle className="fx-dust d2" cx="160" cy="232" r="11" fill="var(--fox-deep)" opacity="0" />
      <circle className="fx-dust d3" cx="214" cy="232" r="11" fill="var(--fox-deep)" opacity="0" />
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
  const skipRef = React.useRef<HTMLButtonElement>(null)

  const finish = React.useCallback(() => {
    if (!doneRef.current) {
      doneRef.current = true
      onDone()
    }
  }, [onDone])

  React.useEffect(() => {
    let cancelled = false
    let closeTimer = 0
    // клавиатурному/SR-пользователю нужен якорь сразу (glm, раунд 2):
    // Esc/Enter/Space с него закрывают сцену, сцена немодальна — без ловушки
    skipRef.current?.focus({ preventScroll: true })
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
    // скип жестом: колесо/тач = «давай дальше» (glm, раунд 2). Фильтры:
    // 1) ctrl+wheel — pinch-zoom трекпада/кнопка масштаба, не навигация;
    // 2) multi-touch (pinch на телефоне);
    // 3) грейс SWIPE_GRACE_MS от монта эффекта (не от run): инерция
    //    прошлого скролла и fonts-гейт (≤400ms) не убивают сцену случайно.
    const graceUntil = performance.now() + SWIPE_GRACE_MS
    const onSwipe = (e: Event) => {
      if (performance.now() < graceUntil) return
      if ('ctrlKey' in e && (e as WheelEvent).ctrlKey) return
      if ((e as TouchEvent).touches && (e as TouchEvent).touches.length > 1) return
      finish()
    }
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
        <div className="intro-glow" />
        <div className="intro-mark">
          <span className="intro-mark__glyph">СИ</span>
        </div>
        <div className="intro-fox-wrap">
          <Fox />
        </div>
        <div className="intro-caption">
          <span className="intro-caption__name">Лис Идея</span>
          <span className="intro-caption__meta">талисман проекта · карьерный трекер СИУЭиП</span>
        </div>
      </div>
      <button type="button" ref={skipRef} className="intro-skip" onClick={finish}>
        Пропустить
      </button>
    </div>
  )
}
