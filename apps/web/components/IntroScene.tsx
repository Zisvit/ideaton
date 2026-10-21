import React from 'react'
import { INTRO_MS, SWIPE_GRACE_MS } from '../lib/intro'

// Лис «Идея» v8 — талисман ПРОЕКТА (не официальный символ вуза: брендбука
// СИУЭиП в репо нет, имитировать фирменный знак запрещено советом).
// ViewBox 0 0 360 260, земля y=232, нос вправо. Все амплитуды в user units
// (внутри SVG CSS-px == user unit); origin каждой суставной точки задаётся
// inline --ox/--oy, CSS делает transform-box: view-box для всех узлов.
// Рисунок v9 (совет mix): голова ниже и клиновиднее, уши-треугольники с
// тёмным кончиком, тоньше лапы со скакательным суставом и длиннее «чулки»,
// шерсть — крупными прядями (микро-штрихи убраны: <1px на 220px, mimo),
// единый свет rim/AO/контактные тени (beam). Хореография прежняя:
// 30/30 keyframes, без новых: бег → прыжок → посадка → idle.
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
          <stop offset="0" stopColor="#F49A62" />
          <stop offset=".34" stopColor="#EA7F3C" />
          <stop offset=".68" stopColor="#D66424" />
          <stop offset="1" stopColor="#C95615" />
        </linearGradient>
        <linearGradient id="foxCoatDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D05C1B" />
          <stop offset="1" stopColor="#A8460F" />
        </linearGradient>
        {/* v9: ухо-треугольник с тёмным кончиком — «визитка» вида (glm/super-vl) */}
        <linearGradient id="foxEar" gradientUnits="userSpaceOnUse" x1="0" y1="54" x2="0" y2="106">
          <stop offset="0" stopColor="#241610" />
          <stop offset=".2" stopColor="#2B1B11" />
          <stop offset=".46" stopColor="#8F3A0C" />
          <stop offset="1" stopColor="#C25A1B" />
        </linearGradient>
        <linearGradient id="foxTail" gradientUnits="userSpaceOnUse" x1="140" y1="146" x2="18" y2="208">
          <stop offset="0" stopColor="#E3702A" />
          <stop offset=".45" stopColor="#E98A46" />
          <stop offset=".78" stopColor="#E3702A" />
          <stop offset="1" stopColor="#D9621F" />
        </linearGradient>
        <linearGradient id="foxTip" gradientUnits="userSpaceOnUse" x1="72" y1="188" x2="16" y2="204">
          <stop offset="0" stopColor="#FFF6EA" stopOpacity="0" />
          <stop offset=".38" stopColor="#FFF4E4" stopOpacity=".75" />
          <stop offset=".72" stopColor="#FFF7EC" />
          <stop offset="1" stopColor="#FFFDF8" />
        </linearGradient>
        <linearGradient id="foxSoft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF6EE" />
          <stop offset=".55" stopColor="#FFE6CE" />
          <stop offset="1" stopColor="#F5CBA8" />
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
      {/* v9: контактные тени под лапами (beam) — «стоит на земле», не парит */}
      <ellipse cx="113" cy="230" rx="6" ry="2.3" fill="#12141A" opacity=".3" />
      <ellipse cx="136" cy="230" rx="6" ry="2.3" fill="#12141A" opacity=".25" />
      <ellipse cx="236" cy="230" rx="6" ry="2.3" fill="#12141A" opacity=".25" />
      <ellipse cx="253" cy="229" rx="6.5" ry="2.4" fill="#12141A" opacity=".3" />

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
            {/* v9: микро-штрихи меха убраны — на 220px <1px и не видно (mimo) */}
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
            <path d="M126 170 C130 186 134 203 136 216" stroke="#B24E14" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".9" />
            <path d="M136 209 C138 216 137 223 136 229" stroke="#2B1B11" strokeWidth="8" strokeLinecap="round" fill="none" />
          </g>
          <g className="fx-leg-ff" style={{ '--ox': '244px', '--oy': '158px' } as React.CSSProperties}>
            <path d="M244 158 C241 176 239 194 238 212" stroke="#B24E14" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".9" />
            <path d="M238 205 C238 213 237 220 236 229" stroke="#2B1B11" strokeWidth="8" strokeLinecap="round" fill="none" />
          </g>
        </g>

        {/* КОРПУС+ШЕЯ: спина-градиент, живот-крем, бедро, воротник, блики меха */}
        <g className="fox-chest" style={{ '--ox': '232px', '--oy': '168px' } as React.CSSProperties}>
          {/* v9-iter2: пряди по хребту убраны — читались «рожками»; мех держат rim и градиент */}
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
          {/* мех (v10): старые штрихи убраны — второй парил над спиной «рожками»
              (+5.9…+7.3u); лопасти заполнены и лежат НИЖЕ линии спины
              (space-bunny; замер по контуру: просвет 7.0/7.6/10.3u). */}
          <path d="M134 151 C158 142 190 139 216 140.5 C226 141 233 143 237 146 C233 152 216 149 190 147 C158 150 140 155 134 151 Z" fill="#FFC58D" opacity=".34" />
          <path d="M129 157 C134 152 142 151 149 155 C156 159 159 167 155 174 C151 181 142 184 134 180 C127 177 125 165 129 157 Z" fill="#A8460F" opacity=".32" />
          <path d="M239 152 C247 148 256 149 262 155 C267 161 267 170 262 176 C256 182 246 181 240 176 C235 171 235 157 239 152 Z" fill="#FFC58D" opacity=".30" />
        </g>

        {/* v9 AO (beam/glm): стык голова-шея и корень хвоста — мягкая тень без «водяного знака» */}
        <ellipse cx="322" cy="147" rx="19" ry="6.5" fill="#7A3208" opacity=".15" />
        <ellipse cx="120" cy="181" rx="22" ry="9" fill="#7A3208" opacity=".11" />

        {/* БЛИЖНИЕ НОГИ: бедро → голень → чёрная лапа, у каждого свой сустав */}
        <g className="fox-leg-near-hind">
          <g className="fx-thigh-nh" style={{ '--ox': '132px', '--oy': '168px' } as React.CSSProperties}>
            <path d="M132 180 C128 189 124 199 121 207" stroke="#E27127" strokeWidth="16" strokeLinecap="round" fill="none" />
            {/* суставная выпуклость колена (beam, раунд 2; v9 — под тоньше ногу) */}
            <ellipse cx="126" cy="194" rx="3.4" ry="2.6" fill="#D05C1B" opacity=".7" />
          </g>
          <g className="fx-shin-nh" style={{ '--ox': '121px', '--oy': '205px' } as React.CSSProperties}>
            {/* v9: скакательный сустав — голень уходит назад-вниз к плюсне (glm) */}
            <path d="M121 205 C124 211 122 217 119 221" stroke="url(#foxCoatDark)" strokeWidth="8.5" strokeLinecap="round" fill="none" />
            <path d="M119 221 C117 225 115 227 113 229" stroke="#2B1B11" strokeWidth="8.5" strokeLinecap="round" fill="none" />
          </g>
          <g className="fx-paw-nh" style={{ '--ox': '113px', '--oy': '229px' } as React.CSSProperties}>
            <path
              d="M106 227 C106 224 110 222 115 222 C120 222 124 225 123 228 C122 231 117 232 112 232 C108 232 106 230 106 227 Z"
              fill="#2B1B11"
            />
          </g>
        </g>
        <g className="fox-leg-near-fore">
          <g className="fx-thigh-nf" style={{ '--ox': '252px', '--oy': '158px' } as React.CSSProperties}>
            <path d="M252 166 C254 175 256 184 257 192" stroke="#E27127" strokeWidth="12" strokeLinecap="round" fill="none" />
            {/* v9: rim-свет по передней кромке (beam) */}
            <path d="M255 170 C256.5 177 257.5 184 258.5 191" stroke="#FFF6EA" strokeWidth="1" strokeLinecap="round" fill="none" opacity=".28" />
            <ellipse cx="253" cy="182" rx="3" ry="2.6" fill="#D05C1B" opacity=".7" />
          </g>
          <g className="fx-shin-nf" style={{ '--ox': '257px', '--oy': '192px' } as React.CSSProperties}>
            <path d="M257 192 C256 201 255 208 254 214" stroke="url(#foxCoatDark)" strokeWidth="7.5" strokeLinecap="round" fill="none" />
            <path d="M254 214 C253 218 253 220 252 222" stroke="#2B1B11" strokeWidth="7.5" strokeLinecap="round" fill="none" />
          </g>
          <g className="fx-paw-nf" style={{ '--ox': '252px', '--oy': '222px' } as React.CSSProperties}>
            <path
              d="M246 219 C246 216 251 214 257 215 C262 216 265 219 264 222 C263 225 257 227 252 226 C247 225 245 222 246 219 Z"
              fill="#2B1B11"
            />
          </g>
        </g>

        {/* ДАЛЬНЕЕ УХО: за головой; ближнее — внутри head-группы */}
        <g className="fx-ear fx-ear-far" style={{ '--ox': '316px', '--oy': '104px', '--ea': '-9deg', '--eb': '-4deg' } as React.CSSProperties}>
          <g className="fx-ear-inner">
            <path d="M317 103 C316 90 320 75 325 65 L327 61 L329 66 C328 78 326 92 324 102 Z" fill="url(#foxEar)" />
            <path d="M320 99 C320 89 322 79 324.5 71 L326 68 L327.5 72 C327.5 80 326 90 324.5 99 Z" fill="#EEC6A0" opacity=".85" />
          </g>
        </g>

        <g className="fx-head" style={{ '--ox': '300px', '--oy': '134px' } as React.CSSProperties}>
          {/* череп+морда: клин, купол, кремовые щёки и подбородок */}
          <path
            d="M298 124 C296 110 305 98 317 96 C329 94 339 100 344 109 L354 117 C358 119 358 123 354 125 L343 127 C339 134 330 140 319 139 C308 137 300 132 298 124 Z"
            fill="url(#foxCoat)"
          />
          <path
            d="M309 126 C304 132 301 139 303 145 C306 141 309 139 314 138 C311 134 310 130 309 126 Z"
            fill="url(#foxSoft)" opacity=".92"
          />
          <path
            d="M313 131 C320 130 330 132 338 136 C337 141 330 145 322 145 C315 145 311 140 309 136 Z"
            fill="url(#foxSoft)"
          />
          <path
            d="M318 140 C326 142 334 140 340 135 C341 139 334 144 325 145 C318 146 314 143 313 140 Z"
            fill="url(#foxSoft)" opacity=".95"
          />
          {/* нос: чёрный, с бликом. ВАЖНО: поворот задан CSS-стилем, НЕ атрибутом
              rotate(a cx cy) — тот складывался с CSS transform-origin из --ox/--oy
              и применял центр дважды: нос/глаз улетали с морды (баг v8, найден v9) */}
          <ellipse cx="352" cy="122" rx="6.2" ry="5.2" style={{ transform: 'rotate(-12deg)', transformOrigin: '352px 122px' }} fill="var(--fox-nose)" />
          <path d="M349 119 C351 118 354 119 355 121 C353 122 350 122 348 121 Z" fill="#7A5A48" opacity=".5" />
          {/* рот */}
          <path d="M348 127 C344 132 338 135 332 136" stroke="var(--fox-nose)" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".85" />
          {/* глаз: янтарь, вертикальный зрачок, ОДИН блик — двойной давал «стекляшку» (mimo) */}
          <g className="fx-eye" style={{ '--ox': '325px', '--oy': '111px' } as React.CSSProperties}>
            <ellipse cx="325" cy="111" rx="6.9" ry="5.0" style={{ transform: 'rotate(-10deg)', transformOrigin: '325px 111px' }} fill="url(#foxEye)" />
            <ellipse cx="325.5" cy="111.2" rx="1.75" ry="3.9" style={{ transform: 'rotate(-10deg)', transformOrigin: '325.5px 111.2px' }} fill="#1F130D" />
            <circle cx="322.8" cy="108.9" r="1.4" fill="#fff" opacity=".9" />
            <path d="M318 106 C322 103.5 330 103.5 334 106.5" stroke="#8F3A0C" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".75" />
          </g>
          <path d="M332 114 C336 117 338 121 339 125" stroke="#8F3A0C" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity=".45" />
          <path d="M318 102 C322 100 329 100 333 102" stroke="#FFE9D2" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".55" />
          {/* усы */}
          <g
            className="fx-whiskers"
            style={{ '--ox': '340px', '--oy': '132px' } as React.CSSProperties}
            stroke="var(--fox-nose)" strokeWidth="1.2" strokeLinecap="round" opacity=".46" fill="none"
          >
            <path d="M340 132 C332 134 324 137 317 140" />
            <path d="M341 135 C333 139 326 143 320 148" />
            <path d="M339 129 C331 129 323 130 316 132" />
          </g>
          {/* ближнее ухо: тёмная внешняя кромка, кремовая внутренность */}
          <g className="fx-ear fx-ear-near" style={{ '--ox': '306px', '--oy': '104px', '--ea': '-15deg', '--eb': '-7deg' } as React.CSSProperties}>
            <g className="fx-ear-inner">
              <path d="M301 107 C298 93 301 79 305 68 L309 62 L312 68 C315 79 318 93 319 102 Z" fill="url(#foxEar)" />
              <path d="M305.5 101 C304 92 306 82 308.5 74 L310 71 L311.5 75 C314 83 315.5 92 316.5 100 Z" fill="url(#foxSoft)" opacity=".85" />
            </g>
          </g>
          {/* мех на щеке/лбу */}
          {/* v9: штрихи на щеке убраны (mimo: невидимы на 220px) */}
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

const INTERACTIVE =
  'a[href], button, [role="button"], input, textarea, select, label, summary'

// v17c: первый клик по сцене не должен «съедаться». Если под оверлеем
// интерактивный элемент — закрываем сцену И активируем его. Контент под
// сценой inert, поэтому на время hit-test снимаем атрибут с обёртки и
// возвращаем обратно; React снимет его при закрытии сцены.
function interactiveUnder(x: number, y: number): HTMLElement | null {
  const wrapper = document.getElementById('main')?.parentElement ?? null
  const wasInert = wrapper?.hasAttribute('inert') ?? false
  if (wrapper && wasInert) wrapper.removeAttribute('inert')
  let found: HTMLElement | null = null
  for (const node of document.elementsFromPoint(x, y)) {
    if (!(node instanceof HTMLElement)) continue
    const el = node.closest(INTERACTIVE) as HTMLElement | null
    if (!el) continue
    if (el.closest('.intro-overlay') || el.closest('.skip-link')) continue
    found = el
    break
  }
  if (wrapper && wasInert) wrapper.setAttribute('inert', '')
  return found
}

// Интро-сцена: слой НАД уже отрендеренной «/». Контент под ним inert
// (см. _app), поэтому фокус/клики не уходят в скрытые контролы; overflow не
// трогаем — скролл не блокируем. Закрытие только по JS-таймеру или явному
// действию (клик/Esc/колесо/тач): animationend при prefers-reduced-motion
// не приходит НИКОГДА — глобальный animation:none.
export default function IntroScene({ onDone }: { onDone: () => void }) {
  // Прогон сцены стартует после fonts-гейта (потолок 400 мс): сцена не
  // ждёт wifi в демо-зале, FOUT не рвёт блик в середине.
  const [run, setRun] = React.useState(false)
  const doneRef = React.useRef(false)
  const skipRef = React.useRef<HTMLButtonElement>(null)

  const finish = React.useCallback(() => {
    if (!doneRef.current) {
      doneRef.current = true
      // v17c: conic-рамка на главной стартует по факту закрытия сцены,
      // а не по страховочному +120 (иначе после раннего скипа она ждёт).
      window.dispatchEvent(new Event('intro:done'))
      onDone()
    }
  }, [onDone])

  const onOverlayClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('.intro-skip')) return
      const target = interactiveUnder(e.clientX, e.clientY)
      finish()
      // Клик по кнопке/ссылке под сценой: сначала даём React снять inert,
      // затем активируем элемент. Пустой клик просто закрывает сцену.
      if (target) {
        window.setTimeout(() => {
          target.click()
          // программный click() не фокусирует поле — первому клику по
          // textarea/input/select нужен явный focus
          if (target.matches('input, textarea, select')) {
            target.focus({ preventScroll: true })
          }
        }, 0)
      }
    },
    [finish]
  )

  React.useEffect(() => {
    let cancelled = false
    let closeTimer = 0
    // клавиатурному/SR-пользователю нужен якорь сразу (glm, раунд 2):
    // Esc/Enter/Space с него закрывают сцену; контент под сценой inert,
    // поэтому фокус не уходит в скрытые контролы
    skipRef.current?.focus({ preventScroll: true })
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    Promise.race([
      fonts?.ready ?? Promise.resolve(),
      new Promise((r) => window.setTimeout(r, 400)),
    ]).then(() => {
      if (cancelled) return
      setRun(true) // единая шкала INTRO_MS=4200 стартует отсюда (CSS var --tl)
      // ровно конец шкалы: вуаль уже в opacity 0, невидимого хвоста нет
      closeTimer = window.setTimeout(finish, INTRO_MS)
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
      onClick={onOverlayClick}
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
      <button
        type="button"
        ref={skipRef}
        className="intro-skip"
        onClick={(e) => {
          e.stopPropagation()
          finish()
        }}
      >
        Пропустить
      </button>
    </div>
  )
}
