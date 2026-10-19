"""Гейты волны v17: лиса пробегает при каждом открытии главной.

Запрос пользователя: «сделай так, чтобы лиса пробегала перед каждым открытием
главной страницы сайта». До v17 сцена была «1 раз за сессию» (sessionStorage).

Контракт:
  1) shouldShowIntro больше не читает сессионный флаг; '/' + не Reduce +
     не ?intro=0 → показ при каждом открытии;
  2) _app повторяет сцену не только на монте (полная загрузка), но и на
     client-side переходе на '/' (router.events.routeChangeComplete);
  3) тайминг сцены (INTRO_MS=4200) и conic-delay на главной не разъехались.

Статические сканы исходников (как test_v15/v16).
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
APP = (WEB / "pages" / "_app.tsx").read_text(encoding="utf-8")
INTRO = (WEB / "lib" / "intro.ts").read_text(encoding="utf-8")
INDEX = (WEB / "pages" / "index.tsx").read_text(encoding="utf-8")
CSS = (WEB / "styles" / "globals.css").read_text(encoding="utf-8")


def _strip_comments(text: str) -> str:
    """Комментарии вне скана: гейт смотрит на код, а не на прозу."""
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    return re.sub(r"^\s*//.*$", "", text, flags=re.M)


def test_intro_gate_replays_on_every_home_open():
    intro = _strip_comments(INTRO)
    # сессионный гейт снят: флаг v2 больше не решает, показывать ли сцену
    assert "sessionFlag" not in intro
    assert "getItem(INTRO_KEY)" not in intro
    assert "scrollY" not in intro  # «уже проскроллил» тоже больше не блокирует
    assert "window.location.pathname === '/'" in intro
    # доступность/демо-выключатели не отменены
    assert "prefersReducedMotion()" in intro
    assert "opened === '0'" in intro


def test_app_replays_intro_on_client_navigation_to_home():
    app = _strip_comments(APP)
    assert "useRouter" in app
    assert "router.events.on('routeChangeComplete', maybeShow)" in app
    assert "router.events.off('routeChangeComplete', maybeShow)" in app
    # гейт живёт в maybeShow, который зовётся и на монте, и на переходе
    assert "if (shouldShowIntro())" in app
    assert "maybeShow()" in app


def test_conic_delay_matches_intro_replay():
    index = _strip_comments(INDEX)
    # сцена теперь на каждом открытии — задержка блика обязана это учитывать
    assert (
        "shouldShowIntro() && !prefersReducedMotion() ? INTRO_MS + 120 : 300" in index
    )


def test_header_does_not_overflow_at_320():
    """Риск v17 (найден при проверке): на 320px строка управления шапки шире
    контента на 16px → горизонтальный скролл. Фикс — перенос строки < 360px."""
    css = _strip_comments(CSS)
    block = re.search(r"@media \(max-width: 359px\) \{([\s\S]*?)\n\}", css)
    assert block, "нет @media (max-width: 359px)"
    assert ".site-header__side" in block.group(1)
    assert "flex-wrap: wrap" in block.group(1)
