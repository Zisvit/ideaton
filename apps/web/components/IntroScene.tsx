import React from 'react'
import { INTRO_MS, SWIPE_GRACE_MS } from '../lib/intro'

// Лис «Идея» v21 — нормализация после «выглядит упоротой»: шея и клин
// груди вместо горизонтальной трубы, короче торс с подхватом живота,
// спокойный глаз без брови/мешка, естественный белый нагрудник вместо
// трёх «бинтов», уши не антенны. Шерсть v20 осталась гибридом, но тайл
// v21 идёт вдоль оси тела и только по корпусу/хвосту (на голове 128u
// давал пятно). Геометрия — в defs, заливку задают <use>, поэтому
// текстура едет вместе с суставом. Без фильтров/blend: они перерисовывают
// анимируемые группы. viewBox 0 0 360 260, земля y=232, нос вправо;
// все 20 классов и inline --ox/--oy сохранены, 30/30 keyframes не тронуты.
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
        <linearGradient id="foxEar" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="106">
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
        <linearGradient id="foxTip" gradientUnits="userSpaceOnUse" x1="62" y1="184" x2="21" y2="202">
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
            v21: тайл печётся горизонтальными штрихами, поэтому scale 1,
            а не 1.3 — иначе одна плитка на весь корпус снова даёт полосы.
            Никаких feTurbulence/фильтров: они перерисовывают анимируемые
            группы каждый кадр (совет v20, longcat/mimo/big-pickle). */}
        <pattern
          id="foxFurBody"
          patternUnits="userSpaceOnUse"
          width="128"
          height="128"
          patternTransform="rotate(-8) scale(1)"
        >
          <image href="/fox-fur-128.png" width="128" height="128" preserveAspectRatio="none" />
        </pattern>
        <pattern
          id="foxFurTail"
          patternUnits="userSpaceOnUse"
          width="128"
          height="128"
          patternTransform="rotate(-24) scale(1)"
        >
          <image href="/fox-fur-128.png" width="128" height="128" preserveAspectRatio="none" />
        </pattern>
        {/* v20: один источник геометрии для градиента и текстуры.
            Пути без fill: заливку задают <use> в анимируемых группах,
            поэтому шерсть едет вместе с суставом, а не «плывёт» по нему. */}
        <path
          id="foxBodyBase"
          d="M146 146 C150 136 158 130 166 129 C186 123 210 121 234 123 C252 125 268 122 280 118 C288 116 294 115 300 118 C306 122 306 130 303 135 C300 140 294 145 288 149 C284 152 282 155 282 160 C282 168 283 173 284 178 C272 177 256 176 240 175 C220 173 202 170 188 167 C172 164 158 161 150 158 C145 156 143 151 146 146 Z"
        />
        <path
          id="foxHeadBase"
          d="M306 124 C304 112 309 103 317 100 C325 97 332 100 336 106 C338 109 339 111 341 113 L355 119 C357 120 357 123 355 124.5 L347 127 C344 132 338 136 331 137 C322 138 313 133 308 128 C306 126 306 125 306 124 Z"
        />
        <path
          id="foxTailBase"
          d="M140 160 C128 145 106 138 82 138 C58 138 34 151 21 171 C10 188 16 205 29 211 C42 216 57 205 70 191 C85 175 105 170 120 176 C128 180 137 178 141 170 Z"
        />
        <path
          id="foxEarFarBase"
          d="M314 104 C313 97 316 89 320 83 L324 80 L327 83 C330 90 332 98 332 103 Z"
        />
        <path
          id="foxEarNearBase"
          d="M299 106 C298 98 301 88 305 81 L310 78 L314 81 C318 88 321 98 321 104 Z"
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
        {/* v21: хвост поднят вместе с корпусом статичной обёрткой — иначе
            после подъёма корпуса он остался бы висеть ниже спины */}
        <g transform="translate(0 -12)">
          <g className="fox-tail-a" style={{ '--ox': '140px', '--oy': '164px', '--tw': '5deg' } as React.CSSProperties}>
            <g className="fx-tail-idle-a" style={{ '--ox': '140px', '--oy': '164px', '--tw': '4deg' } as React.CSSProperties}>
              <use href="#foxTailBase" fill="url(#foxTail)" />
              <use
                href="#foxTailBase"
                fill="url(#foxFurTail)"
                opacity=".16"
                pointerEvents="none"
              />
              {/* объём: одна тень по низу и тёплый блик по верху; v21 убрал
                  две дополнительные пряди — на 220px они давали гребёнку */}
              <path
                d="M27 202 C39 210 53 202 65 191 C76 181 86 177 95 176 C81 179 69 187 59 198 C46 212 34 212 27 202 Z"
                fill="var(--fox-dark)" opacity=".22"
              />
              <path
                d="M27 172 C45 153 68 140 90 139" stroke="var(--fox-rim)" strokeWidth="2"
                strokeLinecap="round" fill="none" opacity=".5"
              />
            </g>
            <g className="fox-tail-b" style={{ '--ox': '58px', '--oy': '186px', '--tw': '8deg' } as React.CSSProperties}>
              <g className="fx-tail-idle-b" style={{ '--ox': '58px', '--oy': '186px', '--tw': '7deg' } as React.CSSProperties}>
                {/* v21: белый кончик — шапка на самом кончике (~треть хвоста),
                    а не отдельный белый лист, свисавший под хвостом */}
                <path
                  d="M58 186 C48 181 36 185 28 195 C21 203 24 211 32 213 C39 215 46 208 51 200 C55 194 58 189 62 186 Z"
                  fill="url(#foxTip)"
                />
                <path
                  d="M30 192 C38 186 46 183 54 183" stroke="#FFFDF8" strokeWidth="1.4"
                  strokeLinecap="round" fill="none" opacity=".5"
                />
              </g>
            </g>
          </g>
        </g>

        {/* ДАЛЬНИЕ НОГИ: за телом, приглушённые, диагональ задержек = галоп */}
        <g className="fox-far-legs">
          <g className="fx-leg-fh" style={{ '--ox': '126px', '--oy': '158px' } as React.CSSProperties}>
            <path d="M126 158 C130 181 134 201 136 216" stroke="var(--fox-deep)" strokeWidth="10.5" strokeLinecap="round" fill="none" opacity=".9" />
            <path d="M136 209 C138 216 137 223 136 229" stroke="var(--fox-ink)" strokeWidth="9" strokeLinecap="round" fill="none" />
          </g>
          <g className="fx-leg-ff" style={{ '--ox': '244px', '--oy': '146px' } as React.CSSProperties}>
            <path d="M244 146 C241 169 239 193 238 212" stroke="var(--fox-deep)" strokeWidth="10.5" strokeLinecap="round" fill="none" opacity=".9" />
            <path d="M238 205 C238 213 237 220 236 229" stroke="var(--fox-ink)" strokeWidth="9" strokeLinecap="round" fill="none" />
          </g>
        </g>

        {/* КОРПУС+ШЕЯ: спина темнее, живот кремовый, седло и rim — крупными массами */}
        {/* v21: корпус приподнят на 15u статичной обёрткой. Видимая длина
            ног выросла с 54u до 69u — лис перестал быть «такса-лофом»,
            при этом все анимационные шарниры внутри следуют за геометрией. */}
        <g transform="translate(0 -12)">
          <g className="fox-chest" style={{ '--ox': '232px', '--oy': '168px' } as React.CSSProperties}>
            <use href="#foxBodyBase" fill="url(#foxCoat)" />
            <use
              href="#foxBodyBase"
              fill="url(#foxFurBody)"
              opacity=".14"
              pointerEvents="none"
            />
            {/* живот — узкая кремовая полоса ВНУТРИ контура, а не белый
                передник ниже линии тела (v21: крем выходил за корпус на 10u) */}
            <path
              d="M284 173 C272 172 256 171 240 170 C220 168 202 165 188 162 C172 159 158 156 150 153 C158 161 172 164 188 167 C202 170 220 173 240 175 C256 176 272 177 284 178 Z"
              fill="url(#foxSoft)"
            />
            {/* тонкая тень по верхней кромке кремовой полосы */}
            <path
              d="M150 152 C158 155 172 158 188 161 C202 164 220 167 240 169 C256 170 272 171 284 172"
              stroke="var(--fox-ao)" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity=".12"
            />
            {/* тёмное седло вдоль хребта — «спина темнее боков» (glm);
                v21: седло дотянуто до основания шеи, а не обрывается на холке */}
            <path
              d="M166 129 C188 123 212 121 236 123 C252 125 268 122 280 118 C288 116 294 115 300 118 C292 125 280 128 264 130 C242 132 216 131 194 134 C178 136 166 136 166 129 Z"
              fill="var(--fox-dark)" opacity=".24"
            />
            <path
              d="M168 129 C190 123 214 121 238 123 C254 125 270 122 282 118 C290 116 296 115 301 118"
              stroke="var(--fox-rim)" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".5"
            />
            {/* бедро: мягкий объём по задней ляжке */}
            <ellipse cx="153" cy="162" rx="19" ry="24" fill="url(#foxHaunch)" />
            {/* v21: один нагрудник на груди, а не на шее. Шея остаётся
                оранжевой, белая грудь не смыкается с белой щекой в «шарф». */}
            <path
              d="M278 148 C282 152 283 158 281 164 C279 170 275 174 270 177 C273 169 273 163 270 157 C268 153 265 150 262 148 C267 152 273 152 278 148 Z"
              fill="url(#foxSoft)" opacity=".88"
            />
            {/* крупные пряди: только по краю/границе плоскостей, ≥3u */}
            <path d="M176 132 C184 128 192 127 200 129 C194 131 188 133 182 136 Z" fill="var(--fox-rim)" opacity=".3" />
          </g>
        </g>

        {/* v9 AO (beam/glm): стык голова-шея и корень хвоста — мягкая тень без «водяного знака» */}
        <ellipse cx="292" cy="129" rx="13" ry="6" fill="var(--fox-ao)" opacity=".14" />
        <ellipse cx="146" cy="154" rx="22" ry="9" fill="var(--fox-ao)" opacity=".11" />

        {/* БЛИЖНИЕ НОГИ: бедро → голень → чёрная лапа, у каждого свой сустав */}
        <g className="fox-leg-near-hind">
          <g className="fx-thigh-nh" style={{ '--ox': '146px', '--oy': '156px' } as React.CSSProperties}>
            {/* v21: бедро начинается выше, под кругом, а не висит отдельной
                сарделькой ниже линии живота; верх удлинён вслед за корпусом */}
            <path d="M146 156 C138 180 127 196 121 207" stroke="#E27127" strokeWidth="17" strokeLinecap="round" fill="none" />
            <ellipse cx="130" cy="192" rx="3.4" ry="2.6" fill="#D05C1B" opacity=".7" />
          </g>
          <g className="fx-shin-nh" style={{ '--ox': '121px', '--oy': '205px' } as React.CSSProperties}>
            {/* v9: скакательный сустав — голень уходит назад-вниз к плюсне (glm) */}
            <path d="M121 205 C124 211 122 217 119 221" stroke="url(#foxCoatDark)" strokeWidth="10.5" strokeLinecap="round" fill="none" />
            {/* чёрный чулок от скакательного, а не только лапа */}
            <path d="M120 213 C118 219 116 225 113 229" stroke="var(--fox-ink)" strokeWidth="10" strokeLinecap="round" fill="none" />
          </g>
          <g className="fx-paw-nh" style={{ '--ox': '113px', '--oy': '229px' } as React.CSSProperties}>
            <path
              d="M106 227 C106 224 110 222 115 222 C120 222 124 225 123 228 C122 231 117 232 112 232 C108 232 106 230 106 227 Z"
              fill="var(--fox-ink)"
            />
          </g>
        </g>
        <g className="fox-leg-near-fore">
          <g className="fx-thigh-nf" style={{ '--ox': '252px', '--oy': '146px' } as React.CSSProperties}>
            <path d="M252 152 C254 166 256 181 257 192" stroke="#E27127" strokeWidth="14" strokeLinecap="round" fill="none" />
            {/* v9: rim-свет по передней кромке (beam) */}
            <path d="M255 170 C256.5 177 257.5 184 258.5 191" stroke="var(--fox-rim)" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".3" />
            <ellipse cx="253" cy="182" rx="3" ry="2.6" fill="#D05C1B" opacity=".7" />
          </g>
          <g className="fx-shin-nf" style={{ '--ox': '257px', '--oy': '192px' } as React.CSSProperties}>
            <path d="M257 192 C256 201 255 208 254 214" stroke="url(#foxCoatDark)" strokeWidth="9.5" strokeLinecap="round" fill="none" />
            <path d="M255 207 C254 213 253 218 252 222" stroke="var(--fox-ink)" strokeWidth="9.5" strokeLinecap="round" fill="none" />
          </g>
          <g className="fx-paw-nf" style={{ '--ox': '252px', '--oy': '222px' } as React.CSSProperties}>
            <path
              d="M246 219 C246 216 251 214 257 215 C262 216 265 219 264 222 C263 225 257 227 252 226 C247 225 245 222 246 219 Z"
              fill="var(--fox-ink)"
            />
          </g>
        </g>

        {/* ДАЛЬНЕЕ УХО: за головой; ближнее — внутри head-группы.
            v21: вся голова (и дальнее ухо) укрупнена на 12% вокруг носа —
            статичная обёртка, НЕ transform на анимированной группе; шарниры
            --ox/--oy масштабируются вместе с геометрией и не рвутся. */}
        <g transform="translate(354 103) scale(1.12) translate(-354 -121)">
          <g className="fx-ear fx-ear-far" style={{ '--ox': '323px', '--oy': '104px', '--ea': '-9deg', '--eb': '-4deg' } as React.CSSProperties}>
            <g className="fx-ear-inner">
              <use href="#foxEarFarBase" fill="url(#foxEar)" />
              <path d="M318 100 C318 95 320 89 322 85 L324 82 L326 85 C328 90 330 95 330 100 Z" fill="#EEC6A0" opacity=".85" />
            </g>
          </g>
        </g>

        <g transform="translate(354 103) scale(1.12) translate(-354 -121)">
          <g className="fx-head" style={{ '--ox': '300px', '--oy': '134px' } as React.CSSProperties}>
          {/* череп+морда: длиннее клин, купол, кремовые щёки и подбородок.
              v21: тайл шерсти с головы снят — 128u на 49u головы давал
              мягкое пятно, а не волос; остаются крупные кремовые массы. */}
          <use href="#foxHeadBase" fill="url(#foxCoat)" />
          <path
            d="M318 128 C326 127 336 130 344 134 C342 139 335 143 327 143 C319 143 313 138 311 134 Z"
            fill="url(#foxSoft)"
          />
          {/* нос: чёрный, с бликом. ВАЖНО: поворот задан CSS-стилем, НЕ атрибутом
              rotate(a cx cy) — тот складывался с CSS transform-origin из --ox/--oy
              и применял центр дважды: нос/глаз улетали с морды (баг v8, найден v9) */}
          {/* v21: нос 8.6×7.4u вместо 11.2×9.2u — шарик-пуговица уменьшал
              морду и добавлял «плюшевости» */}
          <ellipse cx="354" cy="121" rx="4.3" ry="3.7" style={{ transform: 'rotate(-12deg)', transformOrigin: '354px 121px' }} fill="var(--fox-nose)" />
          {/* один влажный блик; второй (топ-плоскость) убран */}
          <circle cx="352.6" cy="119.4" r="1.1" fill="#F2D9C4" opacity=".5" />
          {/* рот */}
          <path d="M351 124 C347 129 341 132 335 133" stroke="var(--fox-nose)" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity=".85" />
          {/* глаз: янтарь, ОДИН блик. v21: центр 332,114 — ближе к морде,
              а не под основанием уха; зрачок — мягкий вертикальный овал,
              не кошачья щель. Бровь, «мешок» и линия к морде удалены:
              именно они давали взгляд «упоротой» (совет, раунд 2). */}
          <g className="fx-eye" style={{ '--ox': '332px', '--oy': '114px' } as React.CSSProperties}>
            <ellipse cx="332" cy="114" rx="6" ry="4.6" style={{ transform: 'rotate(-10deg)', transformOrigin: '332px 114px' }} fill="url(#foxEye)" />
            <ellipse cx="332.4" cy="114.3" rx="1.6" ry="2.5" style={{ transform: 'rotate(-10deg)', transformOrigin: '332.4px 114.3px' }} fill="#1F130D" />
            <circle cx="330" cy="111.6" r="1.2" fill="#fff" opacity=".9" />
          </g>
          {/* одно верхнее веко по кромке глаза — вместо брови и мешка */}
          <path d="M326.5 111 C329 108.8 335 108.8 337.5 111" stroke="var(--fox-ao)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity=".5" />
          {/* усы */}
          <g
            className="fx-whiskers"
            style={{ '--ox': '340px', '--oy': '132px' } as React.CSSProperties}
            stroke="var(--fox-nose)" strokeWidth="1.3" strokeLinecap="round" opacity=".3" fill="none"
          >
            <path d="M340 132 C334 133 329 135 324 137" />
            <path d="M341 135 C335 137 330 140 326 143" />
            <path d="M339 129 C333 129 328 130 323 131" />
          </g>
          {/* ближнее ухо: тёмная внешняя кромка, кремовая внутренность */}
          <g className="fx-ear fx-ear-near" style={{ '--ox': '310px', '--oy': '104px', '--ea': '-15deg', '--eb': '-7deg' } as React.CSSProperties}>
            <g className="fx-ear-inner">
              <use href="#foxEarNearBase" fill="url(#foxEar)" />
              <path d="M303 102 C303 96 305 89 307.5 83 L310 80 L312.5 83 C315 89 317 96 317 101 Z" fill="url(#foxSoft)" opacity=".88" />
            </g>
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
