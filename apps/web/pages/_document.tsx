import { Html, Head, Main, NextScript } from 'next/document'
import { CRITICAL_CSS } from '../lib/criticalCss'

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
        {/* v28: шрифты свои (public/fonts) — внешних preconnect не нужно:
            CDN Google в РФ часто недоступен, и пользователь молча получал
            system-ui вместо фирменных шрифтов. */}
        {/* v12: до первой отрисовки — выбор темы из localStorage (ноль FOUC);
            без JS и без ключа остаётся серверный data-theme="light" */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {/* v30: страховка на случай, если CSS-чанк с хешем в имени не
            загрузился (старая вкладка после пересборки): базовый вид
            приложения рисуется встроенными правилами, а не стеной текста */}
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
        {/* v28: preload своих шрифтов (Manrope — текст, Unbounded — заголовки).
            crossOrigin обязателен: иначе preload и CSS-фетч разъедутся и файл
            скачается дважды. Unbounded в CSS с font-display: optional — без
            подмены шрифта на первом визите (ноль CLS на h1). */}
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          href="/fonts/manrope-cyrillic.woff2"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          href="/fonts/manrope-latin.woff2"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          href="/fonts/unbounded-cyrillic.woff2"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          href="/fonts/unbounded-latin.woff2"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
