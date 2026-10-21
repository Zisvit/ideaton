import React from 'react'
import { INTRO_MS, SWIPE_GRACE_MS } from '../lib/intro'

// v22b: в интро — реальное фото нормального рыжего лиса (public domain,
// USFWS Alaska / Wikimedia Commons); SVG-лис v20 оставлен ниже как legacy:
// на нём держатся гейты v9/v19/v20.
// Лис «Идея» v20 — анатомия v19 + растровая шерсть: бесшовный PNG-тайл
// 128×128 в pattern на корпус/голову/хвост/уши (гибрид: SVG-риг + растр,
// совет mix, раунд 2). Геометрия — в defs, заливку задают <use>, поэтому
// текстура едет вместе с суставом. Без фильтров/blend: они перерисовывают
// анимируемые группы. Структура прежняя: viewBox 0 0 360 260, земля y=232,
// нос вправо; все 20 классов и inline --ox/--oy сохранены, 30/30 keyframes
// не тронуты.
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
          <stop offset="0" stopColor="#C05A1C" />
          <stop offset=".3" stopColor="#D96C28" />
          <stop offset=".7" stopColor="#E68A45" />
          <stop offset="1" stopColor="#D06B2A" />
        </linearGradient>
        <linearGradient id="foxCoatDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B24E14" />
          <stop offset="1" stopColor="#8F3A0C" />
        </linearGradient>
        {/* v9: ухо-треугольник с тёмным кончиком — «визитка» вида (glm/super-vl) */}
        <linearGradient id="foxEar" gradientUnits="userSpaceOnUse" x1="0" y1="54" x2="0" y2="106">
          <stop offset="0" stopColor="#241610" />
          <stop offset=".2" stopColor="#2B1B11" />
          <stop offset=".46" stopColor="#8F3A0C" />
          <stop offset="1" stopColor="#C25A1B" />
        </linearGradient>
        <linearGradient id="foxTail" gradientUnits="userSpaceOnUse" x1="140" y1="146" x2="18" y2="208">
          <stop offset="0" stopColor="#D96C28" />
          <stop offset=".45" stopColor="#E68A45" />
          <stop offset=".78" stopColor="#D96C28" />
          <stop offset="1" stopColor="#C8601E" />
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
        {/* v20: растровая шерсть. Тайл 128×128 (public/fox-fur-128.png)
            повторяется pattern'ом; направление разное у корпуса и хвоста.
            Никаких feTurbulence/фильтров: они перерисовывают анимируемые
            группы каждый кадр (совет v20, longcat/mimo/big-pickle). */}
        <pattern
          id="foxFurBody"
          patternUnits="userSpaceOnUse"
          width="128"
          height="128"
          patternTransform="rotate(-8) scale(1.3)"
        >
          <image href="/fox-fur-128.png" width="128" height="128" preserveAspectRatio="none" />
        </pattern>
        <pattern
          id="foxFurTail"
          patternUnits="userSpaceOnUse"
          width="128"
          height="128"
          patternTransform="rotate(-24) scale(1.3)"
        >
          <image href="/fox-fur-128.png" width="128" height="128" preserveAspectRatio="none" />
        </pattern>
        {/* v20: один источник геометрии для градиента и текстуры.
            Пути без fill: заливку задают <use> в анимируемых группах,
            поэтому шерсть едет вместе с суставом, а не «плывёт» по нему. */}
        <path
          id="foxBodyBase"
          d="M138 158 C139 146 148 136 162 131 C180 124 204 122 228 124 C246 126 260 124 272 120 C282 117 290 118 296 123 L316 124 C310 132 304 140 300 148 C296 158 288 168 276 173 C258 180 232 184 206 183 C182 182 160 176 148 167 C143 164 138 161 138 158 Z"
        />
        <path
          id="foxHeadBase"
          d="M306 124 C304 112 309 103 317 100 C325 97 332 100 336 106 C338 109 339 111 341 113 L355 119 C357 120 357 123 355 124.5 L347 127 C344 132 338 136 331 137 C322 138 313 133 308 128 C306 126 306 125 306 124 Z"
        />
        <path
          id="foxTailBase"
          d="M140 160 C128 144 106 136 82 136 C56 136 30 150 16 172 C4 190 10 208 24 214 C38 219 54 208 68 193 C84 176 104 170 120 176 C128 180 137 178 141 170 Z"
        />
        <path
          id="foxEarFarBase"
          d="M317 103 C316 93 319 83 323 75 L325 70 L327 75 C329 83 330 93 329 101 Z"
        />
        <path
          id="foxEarNearBase"
          d="M301 105 C299 94 302 81 306 71 L309 66 L312 71 C316 81 319 94 319 102 Z"
        />
      </defs>

      {/* тень: вне bob-группы — не прыгает вместе с телом; шире и мягче —
          «земля» читается гуще (longcat, раунд 2) */}
      <ellipse className="fox-shadow" cx="186" cy="232" rx="108" ry="10" fill="url(#foxShadow)" />
      {/* v9: контактные тени под лапами (beam) — «стоит на земле», не парит */}
      <ellipse cx="113" cy="230" rx="6" ry="2.3" fill="var(--fox-contact)" opacity=".3" />
      <ellipse cx="136" cy="230" rx="6" ry="2.3" fill="var(--fox-contact)" opacity=".25" />
      <ellipse cx="236" cy="230" rx="6" ry="2.3" fill="var(--fox-contact)" opacity=".25" />
      <ellipse cx="253" cy="229" rx="6.5" ry="2.4" fill="var(--fox-contact)" opacity=".3" />

      <g className="fox-bob" style={{ '--ox': '190px', '--oy': '232px' } as React.CSSProperties}>
        {/* ХВОСТ: густой «brush», белый кончик на внешней группе (волна бега) */}
        <g className="fox-tail-a" style={{ '--ox': '140px', '--oy': '164px', '--tw': '5deg' } as React.CSSProperties}>
          <g className="fx-tail-idle-a" style={{ '--ox': '140px', '--oy': '164px', '--tw': '4deg' } as React.CSSProperties}>
            <use href="#foxTailBase" fill="url(#foxTail)" />
            <use
              href="#foxTailBase"
              fill="url(#foxFurTail)"
              opacity=".24"
              pointerEvents="none"
            />
            {/* объём: тень по низу и тёплый блик по верху */}
            <path
              d="M20 205 C34 213 50 204 63 191 C73 181 82 177 91 176 C78 179 66 187 56 198 C43 212 29 214 21 205 Z"
              fill="var(--fox-dark)" opacity=".22"
            />
            {/* нижние пряди: крупные (≥4u), иначе на 220px превращаются в шум */}
            <path
              d="M22 206 C30 212 40 211 48 205 C44 213 54 215 62 208 C58 216 68 217 76 209"
              fill="var(--fox-dark)" opacity=".26"
            />
            {/* v20: ещё одна крупная прядь по нижней кромке — ≥3u */}
            <path
              d="M30 207 C38 214 48 214 56 207 C51 216 62 219 72 212"
              stroke="var(--fox-dark)" strokeWidth="3" strokeLinecap="round"
              fill="none" opacity=".22"
            />
            <path
              d="M22 175 C40 155 64 141 88 139" stroke="var(--fox-rim)" strokeWidth="2"
              strokeLinecap="round" fill="none" opacity=".5"
            />
          </g>
          <g className="fox-tail-b" style={{ '--ox': '58px', '--oy': '186px', '--tw': '8deg' } as React.CSSProperties}>
            <g className="fx-tail-idle-b" style={{ '--ox': '58px', '--oy': '186px', '--tw': '7deg' } as React.CSSProperties}>
              <path
                d="M72 187 C60 197 51 206 42 212 C31 219 19 215 13 206 C7 197 11 185 19 176 C27 167 38 161 49 159 C41 169 36 180 37 191 C38 201 45 207 53 205 C60 203 67 196 72 187 Z"
                fill="url(#foxTip)"
              />
              <path
                d="M20 178 C29 168 39 162 49 159" stroke="#FFFDF8" strokeWidth="1.4"
                strokeLinecap="round" fill="none" opacity=".5"
              />
            </g>
          </g>
        </g>

        {/* ДАЛЬНИЕ НОГИ: за телом, приглушённые, диагональ задержек = галоп */}
        <g className="fox-far-legs">
          <g className="fx-leg-fh" style={{ '--ox': '126px', '--oy': '170px' } as React.CSSProperties}>
            <path d="M126 170 C130 186 134 203 136 216" stroke="var(--fox-deep)" strokeWidth="9.5" strokeLinecap="round" fill="none" opacity=".9" />
            <path d="M136 209 C138 216 137 223 136 229" stroke="var(--fox-ink)" strokeWidth="8" strokeLinecap="round" fill="none" />
          </g>
          <g className="fx-leg-ff" style={{ '--ox': '244px', '--oy': '158px' } as React.CSSProperties}>
            <path d="M244 158 C241 176 239 194 238 212" stroke="var(--fox-deep)" strokeWidth="9.5" strokeLinecap="round" fill="none" opacity=".9" />
            <path d="M238 205 C238 213 237 220 236 229" stroke="var(--fox-ink)" strokeWidth="8" strokeLinecap="round" fill="none" />
          </g>
        </g>

        {/* КОРПУС+ШЕЯ: спина темнее, живот кремовый, седло и rim — крупными массами */}
        <g className="fox-chest" style={{ '--ox': '232px', '--oy': '168px' } as React.CSSProperties}>
          <use href="#foxBodyBase" fill="url(#foxCoat)" />
          <use
            href="#foxBodyBase"
            fill="url(#foxFurBody)"
            opacity=".2"
            pointerEvents="none"
          />
          {/* живот и грудь — тёплый крем, жёсткая граница */}
          <path
            d="M146 168 C164 178 188 184 212 184 C234 184 252 180 266 172 C260 179 244 184 224 185 C200 186 174 182 156 175 C149 172 145 170 146 168 Z"
            fill="url(#foxSoft)"
          />
          {/* тень низа корпуса над кремовым животом */}
          <path
            d="M138 162 C154 174 178 181 204 182 C228 183 250 178 266 169 C254 176 234 180 212 180 C188 180 164 174 146 166 Z"
            fill="var(--fox-ao)" opacity=".13"
          />
          {/* тёмное седло вдоль хребта — «спина темнее боков» (glm) */}
          <path
            d="M162 131 C184 124 208 122 230 124 C246 126 260 124 272 120 C280 118 287 119 292 122 C286 127 276 130 262 131 C240 133 214 132 192 135 C176 137 164 136 162 131 Z"
            fill="var(--fox-dark)" opacity=".26"
          />
          <path
            d="M164 131 C186 124 210 122 232 124 C250 126 264 123 276 119"
            stroke="var(--fox-rim)" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".5"
          />
          {/* бедро: мягкий объём по задней ляжке */}
          <ellipse cx="153" cy="162" rx="19" ry="24" fill="url(#foxHaunch)" />
          <ellipse cx="260" cy="146" rx="24" ry="20" fill="var(--fox-rim)" opacity=".12" />
          {/* воротник: пушистый край под подбородком */}
          <path
            d="M298 126 C308 130 314 138 313 147 C307 141 300 137 292 135 C295 132 297 129 298 126 Z"
            fill="url(#foxSoft)" opacity=".94"
          />
          <path
            d="M282 150 C290 158 293 168 290 177 C284 170 276 165 268 162 C274 157 279 153 282 150 Z"
            fill="url(#foxSoft)" opacity=".96"
          />
          {/* крупные пряди: только по краю/границе плоскостей, ≥3u */}
          <path d="M176 132 C184 128 192 127 200 129 C194 131 188 133 182 136 Z" fill="var(--fox-rim)" opacity=".3" />
          <path d="M160 172 C168 176 176 178 184 178 C176 181 166 180 158 176 Z" fill="var(--fox-dark)" opacity=".16" />
          {/* v20: пушистый воротник на груди и прядь на бедре */}
          <path
            d="M296 138 C303 144 307 152 306 161 C301 155 294 150 287 147 C291 143 294 140 296 138 Z"
            fill="url(#foxSoft)" opacity=".9"
          />
          <path
            d="M154 150 C160 146 168 145 174 147 C168 150 162 153 157 157 Z"
            fill="var(--fox-dark)" opacity=".18"
          />
        </g>

        {/* v9 AO (beam/glm): стык голова-шея и корень хвоста — мягкая тень без «водяного знака» */}
        <ellipse cx="310" cy="138" rx="18" ry="6" fill="var(--fox-ao)" opacity=".15" />
        <ellipse cx="146" cy="166" rx="22" ry="9" fill="var(--fox-ao)" opacity=".11" />

        {/* БЛИЖНИЕ НОГИ: бедро → голень → чёрная лапа, у каждого свой сустав */}
        <g className="fox-leg-near-hind">
          <g className="fx-thigh-nh" style={{ '--ox': '132px', '--oy': '168px' } as React.CSSProperties}>
            <path d="M132 178 C128 188 124 198 121 207" stroke="#E27127" strokeWidth="17" strokeLinecap="round" fill="none" />
            <ellipse cx="126" cy="194" rx="3.4" ry="2.6" fill="#D05C1B" opacity=".7" />
          </g>
          <g className="fx-shin-nh" style={{ '--ox': '121px', '--oy': '205px' } as React.CSSProperties}>
            {/* v9: скакательный сустав — голень уходит назад-вниз к плюсне (glm) */}
            <path d="M121 205 C124 211 122 217 119 221" stroke="url(#foxCoatDark)" strokeWidth="9" strokeLinecap="round" fill="none" />
            {/* чёрный чулок от скакательного, а не только лапа */}
            <path d="M120 213 C118 219 116 225 113 229" stroke="var(--fox-ink)" strokeWidth="8.5" strokeLinecap="round" fill="none" />
          </g>
          <g className="fx-paw-nh" style={{ '--ox': '113px', '--oy': '229px' } as React.CSSProperties}>
            <path
              d="M106 227 C106 224 110 222 115 222 C120 222 124 225 123 228 C122 231 117 232 112 232 C108 232 106 230 106 227 Z"
              fill="var(--fox-ink)"
            />
          </g>
        </g>
        <g className="fox-leg-near-fore">
          <g className="fx-thigh-nf" style={{ '--ox': '252px', '--oy': '158px' } as React.CSSProperties}>
            <path d="M252 164 C254 174 256 184 257 192" stroke="#E27127" strokeWidth="13" strokeLinecap="round" fill="none" />
            {/* v9: rim-свет по передней кромке (beam) */}
            <path d="M255 170 C256.5 177 257.5 184 258.5 191" stroke="var(--fox-rim)" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".3" />
            <ellipse cx="253" cy="182" rx="3" ry="2.6" fill="#D05C1B" opacity=".7" />
          </g>
          <g className="fx-shin-nf" style={{ '--ox': '257px', '--oy': '192px' } as React.CSSProperties}>
            <path d="M257 192 C256 201 255 208 254 214" stroke="url(#foxCoatDark)" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M255 207 C254 213 253 218 252 222" stroke="var(--fox-ink)" strokeWidth="8" strokeLinecap="round" fill="none" />
          </g>
          <g className="fx-paw-nf" style={{ '--ox': '252px', '--oy': '222px' } as React.CSSProperties}>
            <path
              d="M246 219 C246 216 251 214 257 215 C262 216 265 219 264 222 C263 225 257 227 252 226 C247 225 245 222 246 219 Z"
              fill="var(--fox-ink)"
            />
          </g>
        </g>

        {/* ДАЛЬНЕЕ УХО: за головой; ближнее — внутри head-группы */}
        <g className="fx-ear fx-ear-far" style={{ '--ox': '316px', '--oy': '104px', '--ea': '-9deg', '--eb': '-4deg' } as React.CSSProperties}>
          <g className="fx-ear-inner">
            <use href="#foxEarFarBase" fill="url(#foxEar)" />
            <use
              href="#foxEarFarBase"
              fill="url(#foxFurBody)"
              opacity=".16"
              pointerEvents="none"
            />
            <path d="M320 99 C320 91 322 83 324 78 L325 75 L326.5 79 C327.5 86 328 93 327.5 99 Z" fill="#EEC6A0" opacity=".85" />
            {/* v20: пушок внутри уха */}
            <path
              d="M322 96 C322 91 323 87 324 84"
              stroke="#F6D9BC" strokeWidth="1.4" strokeLinecap="round"
              fill="none" opacity=".7"
            />
          </g>
        </g>

        <g className="fx-head" style={{ '--ox': '300px', '--oy': '134px' } as React.CSSProperties}>
          {/* череп+морда: длиннее клин, купол, кремовые щёки и подбородок */}
          <use href="#foxHeadBase" fill="url(#foxCoat)" />
          <use
            href="#foxHeadBase"
            fill="url(#foxFurBody)"
            opacity=".14"
            pointerEvents="none"
          />
          <path
            d="M310 132 C305 138 303 145 305 151 C309 147 313 145 317 144 C314 140 312 136 310 132 Z"
            fill="url(#foxSoft)" opacity=".92"
          />
          <path
            d="M318 128 C326 127 336 130 344 134 C342 139 335 143 327 143 C319 143 313 138 311 134 Z"
            fill="url(#foxSoft)"
          />
          <path
            d="M318 140 C326 142 334 140 340 135 C341 139 334 144 325 145 C318 146 314 143 313 140 Z"
            fill="url(#foxSoft)" opacity=".95"
          />
          {/* v20: бакенбард — масса, а не штрих; читается на 220px */}
          <path
            d="M308 136 C303 140 302 145 305 149 C308 144 312 141 316 139 C313 138 310 137 308 136 Z"
            fill="url(#foxSoft)" opacity=".9"
          />
          {/* нос: чёрный, с бликом. ВАЖНО: поворот задан CSS-стилем, НЕ атрибутом
              rotate(a cx cy) — тот складывался с CSS transform-origin из --ox/--oy
              и применял центр дважды: нос/глаз улетали с морды (баг v8, найден v9) */}
          <ellipse cx="354" cy="121" rx="5.6" ry="4.6" style={{ transform: 'rotate(-12deg)', transformOrigin: '354px 121px' }} fill="var(--fox-nose)" />
          <path d="M351 118.5 C353 117.5 355.5 118.5 356.5 120 C354.5 121 352 121 350 120 Z" fill="#7A5A48" opacity=".5" />
          {/* v20: влажный блик носа — самая высокая отдача на пиксель */}
          <circle cx="352.4" cy="119.4" r="1.2" fill="#F2D9C4" opacity=".55" />
          {/* рот */}
          <path d="M352 125 C348 130 342 133 336 134" stroke="var(--fox-nose)" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity=".85" />
          {/* глаз: янтарь, вертикальный зрачок, ОДИН блик — двойной давал «стекляшку» (mimo) */}
          <g className="fx-eye" style={{ '--ox': '327px', '--oy': '112px' } as React.CSSProperties}>
            <ellipse cx="327" cy="112" rx="5.3" ry="4.1" style={{ transform: 'rotate(-10deg)', transformOrigin: '327px 112px' }} fill="url(#foxEye)" />
            <ellipse cx="327.4" cy="112.2" rx="1.45" ry="3.1" style={{ transform: 'rotate(-10deg)', transformOrigin: '327.4px 112.2px' }} fill="#1F130D" />
            <circle cx="324.9" cy="110.1" r="1.2" fill="#fff" opacity=".9" />
            <path d="M320 107 C324 105 330 105 334 108" stroke="var(--fox-ao)" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".75" />
          </g>
          <path d="M333 114 C337 118 339 122 339 126" stroke="var(--fox-ao)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity=".45" />
          <path d="M320 102 C324 100 330 100 334 102" stroke="#FFE9D2" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".55" />
          {/* усы */}
          <g
            className="fx-whiskers"
            style={{ '--ox': '340px', '--oy': '132px' } as React.CSSProperties}
            stroke="var(--fox-nose)" strokeWidth="1.6" strokeLinecap="round" opacity=".42" fill="none"
          >
            <path d="M340 132 C332 134 324 137 317 140" />
            <path d="M341 135 C333 139 326 143 320 148" />
            <path d="M339 129 C331 129 323 130 316 132" />
          </g>
          {/* ближнее ухо: тёмная внешняя кромка, кремовая внутренность */}
          <g className="fx-ear fx-ear-near" style={{ '--ox': '306px', '--oy': '104px', '--ea': '-15deg', '--eb': '-7deg' } as React.CSSProperties}>
            <g className="fx-ear-inner">
              <use href="#foxEarNearBase" fill="url(#foxEar)" />
              <use
                href="#foxEarNearBase"
                fill="url(#foxFurBody)"
                opacity=".16"
                pointerEvents="none"
              />
              <path d="M305 101 C304 92 306 83 308.5 76 L310 72 L311.5 76 C314 84 315.5 92 316.5 100 Z" fill="url(#foxSoft)" opacity=".88" />
              {/* v20: пушок внутри ближнего уха */}
              <path
                d="M307 97 C306 92 307 88 308 84"
                stroke="#F6D9BC" strokeWidth="1.4" strokeLinecap="round"
                fill="none" opacity=".7"
              />
            </g>
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

// v22b: фото-карточка лиса. Фото: «Red Fox at Puale Bay», USFWS Alaska,
// public domain:
// https://commons.wikimedia.org/wiki/File:Red_Fox_at_Puale_Bay_(7550652356).jpg
// v23: тот же снимок (оригинал 4000×3000) кадрирован плотно — лис ~85%
// ширины кадра вместо ~55%, насыщенность поднята на ~18% и запечена в JPEG
// (растр, не CSS-фильтр).
// v24: фото могло не загрузиться (офлайн, прокси, 404) — тогда показываем
// карточку с токенным градиентом, а не битую картинку; legacy-SVG-лис в
// разметку не возвращаем (гейт v22 требует, чтобы он не рендерился).
// v27: пользователь попросил лиса СОВСЕМ без фона и с более подходящей
// картинкой. Новый источник — «Red fox (52869982404)», USFWS Midwest Region,
// public domain (зелёный боке-фон снимается ключом по HSL, край сглажен и
// очищен от зелёного отсвета):
// https://commons.wikimedia.org/wiki/File:Red_fox_(52869982404).jpg
// Растр запечён (900×650, RGBA), без runtime-фильтров/blend; зум и посадка —
// transition, не keyframes (бюджет 30 не трогаем).
function FoxPhoto() {
  const [failed, setFailed] = React.useState(false)
  return (
    <div className={failed ? 'intro-photo intro-photo--fallback' : 'intro-photo'}>
      {!failed && (
        <img
          className="intro-photo__img"
          src="/fox-cutout.png"
          alt=""
          width={900}
          height={650}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onError={() => setFailed(true)}
        />
      )}
    </div>
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
      {/* v24: фото лиса качается параллельно сценой — прелоад, чтобы первые
          секунды интро карточка не была пустой рамкой */}
      <link
        rel="preload"
        as="image"
        href="/fox-cutout.png"
        fetchPriority="high"
      />
      <div className="intro-scene" aria-hidden="true">
        <div className="intro-aurora" />
        <div className="intro-glow" />
        <div className="intro-mark">
          <span className="intro-mark__glyph">СИ</span>
        </div>
        <div className="intro-fox-wrap">
          <FoxPhoto />
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
