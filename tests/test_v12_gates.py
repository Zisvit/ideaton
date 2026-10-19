"""Гейты волны v12: темы «Белая»/«Чёрная» (совет v12, 7 ответивших).

Контракты:
  - prepaint-скрипт в _document ДО таблицы стилей; строгий дефолт «Белая»
    (без prefers-color-scheme/matchMedia) — третьего состояния нет;
  - перекраска — ТОЛЬКО переменные в html[data-theme="dark"] (печатные
    правила не бьются); печатный сброс токенов живёт внутри MUTE v6 и стоит
    ПО ФАЙЛУ ПОСЛЕ dark-блока (иначе каскад отменил бы его на бумаге);
  - светлые значения палитры не изменились; бюджет @keyframes не вырос;
  - переключатель — сегмент role=group «Белая/Чёрная» в шапках 4 страниц;
  - lib/theme.ts — единственная точка записи (plan.tsx остаётся чистым).
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
CSS = (WEB / "styles" / "globals.css").read_text(encoding="utf-8")
DOC = (WEB / "pages" / "_document.tsx").read_text(encoding="utf-8")
APP = (WEB / "pages" / "_app.tsx").read_text(encoding="utf-8")
THEME = (WEB / "lib" / "theme.ts").read_text(encoding="utf-8")
TOGGLE = (WEB / "components" / "ThemeToggle.tsx").read_text(encoding="utf-8")


def test_boot_script_is_prepaint_and_strict_light():
    assert 'data-theme="light"' in DOC  # серверный дефолт до скрипта
    assert "career-tracker-theme:v1" in DOC
    assert "document.documentElement.setAttribute('data-theme',t)" in DOC
    # строгий дефолт: системная тема НЕ читается
    assert "prefers-color-scheme" not in DOC
    assert "matchMedia" not in DOC
    # скрипт объявлен до компонента и стоит до таблицы шрифтов
    assert DOC.index("THEME_BOOT") < DOC.index("fonts.googleapis.com")
    assert DOC.index("const THEME_BOOT") < DOC.index("export default function Document")


def test_dark_block_rewrites_tokens_only():
    m = re.search(r'html\[data-theme="dark"\]\s*\{', CSS)
    assert m, 'нет блока html[data-theme="dark"]'
    i = CSS.index("{", m.end() - 1)
    depth, j = 0, i
    while j < len(CSS):
        if CSS[j] == "{":
            depth += 1
        elif CSS[j] == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    dark = CSS[i + 1 : j]
    assert "{" not in dark and "}" not in dark, "в dark-блоке не должно быть селекторов"
    for token in (
        "--bg:",
        "--surface:",
        "--surface-2:",
        "--line:",
        "--ink:",
        "--ink-2:",
        "--muted:",
        "--accent-soft:",
        "--accent-text:",
        "--match-ink:",
        "--gap-ink:",
        "--veil:",
        "--header-bg:",
        "--bubble-bg:",
        "--track:",
        "--dot:",
        "--sheen:",
        "--fox-deep:",
    ):
        assert token in dark, f"в тёмном блоке нет {token}"


def test_light_palette_byte_stable():
    for pair in (
        "--bg: #F6F4EF;",
        "--surface: #FFFFFF;",
        "--surface-2: #F1EFE7;",
        "--line: #DCD6C9;",
        "--ink: #12141A;",
        "--accent: #5B4CFF;",
        "--match: #12B981;",
        "--gap: #FF8A3D;",
        "--accent-text: #5B4CFF;",
        "--veil: rgba(246,244,239,.97);",
        "--header-bg: rgba(246,244,239,.98);",
        "--track: #D8D2C4;",
    ):
        assert pair in CSS, f"светлая палитра изменилась: {pair}"


def test_keyframes_budget_unchanged():
    names = re.findall(r"@keyframes\s+([A-Za-z0-9-]+)", CSS)
    assert len(names) == 30, f"бюджет @keyframes: {len(names)} {names}"


def test_print_reset_inside_last_mute_block_and_after_dark():
    tail = CSS.split("@media print")[-1]
    assert ".fx-conic::before" in tail, "контракт v6 (последний print-блок) сломан"
    assert 'html[data-theme="dark"]' in tail
    assert "--ink: #000" in tail
    # сброс в файле ПОСЛЕ dark-блока — иначе каскад отменит его в печати
    assert CSS.rindex('html[data-theme="dark"]') > CSS.index("--muted-2: #8A8074;")


def test_toggle_wired_on_all_pages():
    for name in ("index", "result", "plan", "consultant"):
        src = (WEB / "pages" / f"{name}.tsx").read_text(encoding="utf-8")
        assert "ThemeToggle" in src, f"{name}.tsx без ThemeToggle"
        assert "site-header__side" in src, f"{name}.tsx без обёртки шапки"


def test_toggle_component_contract():
    assert 'role="group"' in TOGGLE
    assert 'aria-label="Тема оформления"' in TOGGLE
    assert "Белая" in TOGGLE and "Чёрная" in TOGGLE
    assert TOGGLE.count("aria-pressed") >= 2
    assert "localStorage.setItem" not in TOGGLE  # запись — только через lib/theme.ts
    assert ".theme-toggle__btn" in CSS and 'aria-pressed="true"' in CSS


def test_theme_module_contract():
    assert "career-tracker-theme:v1" in THEME
    assert "localStorage.getItem" in THEME and "localStorage.setItem" in THEME
    assert "setAttribute('data-theme'" in THEME
    assert "catch" in THEME  # гостевой режим не роняет
    assert "prefers-color-scheme" not in THEME and "matchMedia" not in THEME


def test_meta_theme_color_single_source():
    # дубль из _app убран: мету ведут _document + applyTheme (querySelectorAll)
    assert "theme-color" in DOC
    assert "theme-color" not in APP


def test_offline_v11_intact():
    assert ".offline-note" in CSS and ".offline-pill" in CSS
