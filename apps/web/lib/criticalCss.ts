/**
 * v30: аварийный «критический» CSS.
 *
 * Зачем: Next отдаёт стили файлом с хешем имени (/_next/static/chunks/*.css).
 * После пересборки имя меняется, и вкладка, открытая ДО сборки, получает
 * 404 на стили — и страница выглядит как стена текста без дизайна.
 * Этот набор правил встроен в <head> и рисует базовый вид приложения даже
 * если основной CSS не загрузился: палитра, типографика, сетка героя,
 * карточка, кнопка.
 *
 * Намеренно компактный: это страховка, а не замена дизайн-системы.
 * Значения совпадают с токенами в styles/globals.css (гейт v30 сверяет).
 */
export const CRITICAL_CSS = `
:root{--bg:#F8F7FC;--surface:#FFFFFF;--surface-2:#F1EBFF;--line:#EEEAF7;
--ink:#2B1952;--ink-2:#4B3F63;--muted:#6F6884;--accent:#7444F4;--accent-text:#6333E6;
--accent-soft:#F1EBFF;--hairline:rgba(255,255,255,.9);
--shadow:0 1px 2px rgba(43,25,82,.03),0 8px 32px rgba(56,37,105,.05);
--skip-bg:rgba(18,20,26,.86);--skip-ink:#FFFFFF;
--radius-sm:10px;--radius:15px;--radius-lg:19px;--max:1600px;--ease:cubic-bezier(.2,.7,.2,1)}
html[data-theme="dark"]{--bg:#141020;--surface:#1C1730;--surface-2:#251E3D;--line:#2E2748;
--ink:#F4F1FF;--ink-2:#D8D2F0;--muted:#A79EC4;--accent-text:#B79BFF;--accent-soft:#2A2148;
--hairline:rgba(255,255,255,.06);
--shadow:0 1px 2px rgba(0,0,0,.40),0 14px 34px -18px rgba(0,0,0,.70);
--skip-bg:rgba(240,236,230,.9);--skip-ink:#141210}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--bg);color:var(--ink);
font-family:"Manrope","Manrope Fallback",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:var(--accent-text);text-decoration:none}
.container{max-width:var(--max);margin:0 auto;padding:0 20px}
h1,h2,h3{margin:0}
h1{font-family:"Unbounded","Unbounded Fallback","Manrope",system-ui,sans-serif;font-weight:500;
font-size:clamp(30px,4.4vw,56px);line-height:1.04;letter-spacing:-.03em}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;cursor:pointer;
font:600 15px/1.5 inherit;padding:14px 22px;min-height:46px;border-radius:999px;
background:linear-gradient(180deg,#6C5DFF,var(--accent));color:#fff}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:24px;
box-shadow:0 1px 2px rgba(18,20,26,.04),0 12px 30px -16px rgba(18,20,26,.22)}
.hero-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:44px;
align-items:start;padding:8px 0 4px}
.hero-main{max-width:640px}
.route-card{position:relative;border-radius:var(--radius-lg);padding:18px 20px 16px;
background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow)}
.route{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.route__step{display:grid;grid-template-columns:26px 1fr;gap:12px;align-items:start}
.route__num{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;
font-family:"Unbounded","Unbounded Fallback",system-ui,sans-serif;font-size:12px;font-weight:600;
color:var(--accent-text);background:var(--accent-soft);border:1px solid var(--line)}
.route__text{font-size:14px;line-height:1.45;color:var(--ink-2)}
.preview-card{border-radius:var(--radius-lg);padding:22px;color:#F6F3EC;
background:radial-gradient(120% 120% at 12% -10%,rgba(91,76,255,.55),transparent 58%),
radial-gradient(100% 100% at 96% 108%,rgba(232,114,44,.34),transparent 62%),
linear-gradient(160deg,#191A2A 0%,#14131E 58%,#1A1520 100%)}
@media (max-width:900px){.hero-grid{grid-template-columns:minmax(0,1fr);gap:26px}}
.intro-overlay{position:fixed;inset:0;z-index:200;display:grid;place-items:center;
background:var(--bg);text-align:center}
.intro-scene{display:grid;place-items:center;justify-items:center;row-gap:10px;
width:min(560px,92vw)}
.intro-mark{width:104px;height:104px;border-radius:28px;background:var(--surface);
border:1px solid var(--line);display:grid;place-items:center;
font-family:"Unbounded","Unbounded Fallback",system-ui,sans-serif;font-size:30px;
font-weight:600;color:var(--accent-text)}
.intro-wordmark{font-family:"Unbounded","Unbounded Fallback",system-ui,sans-serif;
font-size:17px;font-weight:600;letter-spacing:.42em;text-indent:.42em;
text-transform:uppercase;color:var(--accent-text)}
.intro-caption{font-size:12px;color:var(--muted)}
.intro-skip{position:fixed;top:14px;right:14px;z-index:201;min-height:44px;padding:10px 16px;
border-radius:999px;border:0;background:var(--skip-bg);color:var(--skip-ink);cursor:pointer}
`.trim()
