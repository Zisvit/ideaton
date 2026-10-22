"""v33: оболочка и палитра — по референсу career-tracker.html.

Запрос пользователя: «скинул в директорию career-tracker.html, переделай
сайт под это» (откат — до коммита, если не понравится).

Что закрывает этот гейт:
  1) оболочка приложения: белый сайдбар с навигацией, топбар с вкладками
     ролей, нижняя навигация на телефоне — как в референсе;
  2) палитра: фиолет референса (#7444f4 / #f8f7fc / #f1ebff / #2b1952) вместо
     прежней «тёплой бумаги»;
  3) фон плоский (референс без зерна и точечной сетки);
  4) запреты проекта соблюдены: без filter/backdrop-filter/mix-blend-mode.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps/web"
CSS = (WEB / "styles/globals.css").read_text(encoding="utf-8")
SHELL_CSS = (WEB / "styles/shell.css").read_text(encoding="utf-8")
SHELL = (WEB / "components/Shell.tsx").read_text(encoding="utf-8")
APP = (WEB / "pages/_app.tsx").read_text(encoding="utf-8")


def test_shell_component_is_wired():
    assert "import Shell from '../components/Shell'" in APP
    assert "import '../styles/shell.css'" in APP
    assert "<Shell>" in APP
    for cls in ('className="shell"', 'className="side"', 'className="topbar"',
                'className="role-tabs"', 'className="bottom-nav"', 'className="brand-mark"'):
        assert cls in SHELL, f"в оболочке нет {cls}"
    # навигация ведёт на реальные разделы
    for href in ("'/'", "'/result'", "'/plan'", "'/employer'", "'/consultant'"):
        assert href in SHELL, f"нет пункта {href}"


def test_reference_palette_in_tokens():
    for pair in (
        "--accent: #7444F4;",
        "--bg: #F8F7FC;",
        "--surface-2: #F1EBFF;",
        "--ink: #2B1952;",
    ):
        assert pair in CSS, f"в палитре нет {pair}"


def test_shell_geometry_matches_reference():
    assert "grid-template-columns: var(--side-w) minmax(0, 1fr)" in SHELL_CSS
    assert "--side-w: 232px;" in SHELL_CSS
    assert "position: sticky;" in SHELL_CSS
    assert "height: 100dvh;" in SHELL_CSS
    # нижняя навигация — только на телефоне
    mobile = SHELL_CSS[SHELL_CSS.index("@media (max-width: 720px)") :]
    assert ".bottom-nav {" in mobile
    assert "position: fixed;" in mobile
    assert "env(safe-area-inset-bottom)" in mobile


def test_flat_background_in_reference_layer():
    assert ".fix-bg__dots," in SHELL_CSS
    assert ".fix-bg { background-image: none !important; }" in SHELL_CSS


def test_no_forbidden_techniques_in_shell_layer():
    css = re.sub(r"/\*[\s\S]*?\*/", "", SHELL_CSS)
    for bad in ("filter:", "backdrop-filter", "mix-blend-mode"):
        assert bad not in css, f"в слое оболочки запрещён {bad}"
