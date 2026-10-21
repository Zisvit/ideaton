import { Html, Head, Main, NextScript } from 'next/document'

// v12: тема применяется ДО первой отрисовки. Скрипт стоит в <Head> после meta
// theme-color (его же и обновляет) и до таблицы стилей; читает ровно один ключ,
// без выбора — «Белая» (строгий дефолт совета: две именованные темы, третьего
// неявного состояния нет). Логика продублирована в lib/theme.ts для клика.
const THEME_BOOT =
  "(function(){try{var t=localStorage.getItem('career-tracker-theme:v1');" +
  "if(t!=='dark')t='light';" +
  "document.documentElement.setAttribute('data-theme',t);" +
  "var m=document.querySelectorAll('meta[name=\"theme-color\"]');" +
  "for(var i=0;i<m.length;i++){m[i].setAttribute('content',t==='dark'?'#141210':'#F2EFE8')}" +
  "}catch(e){}})()"

export default function Document() {
  return (
    <Html lang="ru" data-theme="light">
      <Head>
        <meta name="theme-color" content="#F2EFE8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* v12: до первой отрисовки — выбор темы из localStorage (ноль FOUC);
            без JS и без ключа остаётся серверный data-theme="light" */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {/* Manrope — текст и цифры (tabular), Unbounded 500 — только h1/бренд:
            дисплейный шрифт тяжелее 500 нигде не используется. font-display=swap: офлайн → system-ui. */}
        {/* v26: Manrope — одна вариативная гарнитура (200–800) вместо пяти
            статических начертаний: браузер тянет 2 файла вместо 10;
            Unbounded — два начертания (500/600). */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&family=Unbounded:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
