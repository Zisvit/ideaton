"""Гейты волны v17: интро-сцена показывается при каждом открытии главной.

Запрос пользователя: «сделай так, чтобы сцена проигрывалась перед каждым
открытием главной страницы сайта». До v17 сцена была «1 раз за сессию»
(sessionStorage).

Контракт:
  1) shouldShowIntro больше не читает сессионный флаг; '/' + не Reduce +
     не ?intro=0 → показ при каждом открытии;
  2) _app повторяет сцену не только на монте (полная загрузка), но и на
     client-side переходе на '/' (router.events.routeChangeComplete);
  3) тайминг сцены (INTRO_MS, v31: 2400) и conic-delay на главной не разъехались.

Статические сканы исходников (как test_v15/v16).
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
APP = (WEB / "pages" / "_app.tsx").read_text(encoding="utf-8")
INTRO = (WEB / "lib" / "intro.ts").read_text(encoding="utf-8")
INDEX = (WEB / "pages" / "index.tsx").read_text(encoding="utf-8")
SCENE = (WEB / "components" / "IntroScene.tsx").read_text(encoding="utf-8")
CSS = (WEB / "styles" / "globals.css").read_text(encoding="utf-8")


def _strip_comments(text: str) -> str:
    """Комментарии вне скана: гейт смотрит на код, а не на прозу."""
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    return re.sub(r"^\s*//.*$", "", text, flags=re.M)


def test_intro_gate_replays_on_every_home_open():
    intro = _strip_comments(INTRO)
    # v17b: сессионный флаг удалён целиком; гейт только по URL/Reduce/?intro=0
    assert "sessionStorage" not in intro
    assert "INTRO_KEY" not in intro
    assert "scrollY" not in intro  # «уже проскроллил» тоже больше не блокирует
    assert "window.location.pathname === '/'" in intro
    # доступность/демо-выключатели не отменены
    assert "prefersReducedMotion()" in intro
    assert "opened === '0'" in intro


def test_app_resets_intro_when_leaving_home():
    app = _strip_comments(APP)
    assert "useRouter" in app
    assert "router.events.on('routeChangeComplete', onRoute)" in app
    assert "router.events.off('routeChangeComplete', onRoute)" in app
    # единый источник истины — URL: уход с «/» гасит сцену, возврат — снова
    assert "setShowIntro(shouldShowIntro())" in app
    assert "const changed = prevPath.current !== path" in app
    assert "syncIntro(firstRun.current)" in app
    assert "markIntroShown" not in app  # мёртвая запись v6 удалена


def test_app_replays_intro_from_bfcache():
    app = _strip_comments(APP)
    assert "window.addEventListener('pageshow', onPageShow)" in app
    assert "e.persisted" in app
    assert "syncIntro(true)" in app


def test_intro_blocks_focus_behind_overlay():
    app = _strip_comments(APP)
    # v17b: контент и skip-link inert, пока сцена открыта (WCAG 2.4.11)
    assert app.count("inert={showIntro ? true : undefined}") >= 2
    # фокус возвращаем после коммита React (снятия inert), не в тот же кадр;
    # v17c: flushSync делает коммит синхронным и для таймера естественного закрытия
    assert "flushSync" in app
    assert "setTimeout" in app


def test_conic_delay_matches_intro_replay():
    index = _strip_comments(INDEX)
    # сцена теперь на каждом открытии — задержка блика обязана это учитывать
    assert (
        "shouldShowIntro() && !prefersReducedMotion() ? INTRO_MS + 120 : 300" in index
    )
    # v17c: ранний скип стартует conic сразу, не ждёт +120
    assert "window.addEventListener('intro:done', startConic)" in index
    assert "window.removeEventListener('intro:done', startConic)" in index


def test_intro_close_has_no_invisible_tail():
    """v17c: закрытие ровно на INTRO_MS, а не +120 — иначе оверлей уже
    невидим, но ещё ловит клики."""
    scene = _strip_comments(SCENE)
    assert "window.setTimeout(finish, INTRO_MS)" in scene
    assert "INTRO_MS + 120" not in scene


def test_first_click_reaches_content():
    """v17c: клик по кнопке/ссылке под сценой не «съедается» — сцена
    закрывается, элемент активируется; skip-кнопка не проваливается."""
    scene = _strip_comments(SCENE)
    assert "elementsFromPoint" in scene
    assert "interactiveUnder" in scene
    assert "window.dispatchEvent(new Event('intro:done'))" in scene
    assert "target.click()" in scene
    assert "target.focus({ preventScroll: true })" in scene
    assert "e.stopPropagation()" in scene


def test_header_does_not_overflow_at_320():
    """Риск v17 (найден при проверке): на 320px строка управления шапки шире
    контента на 16px → горизонтальный скролл. Фикс — перенос строки < 360px."""
    css = _strip_comments(CSS)
    block = re.search(r"@media \(max-width: 359px\) \{([\s\S]*?)\n\}", css)
    assert block, "нет @media (max-width: 359px)"
    assert ".site-header__side" in block.group(1)
    assert "flex-wrap: wrap" in block.group(1)
