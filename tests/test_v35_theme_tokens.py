"""v35: тёмная тема — панель героя и тона оболочки по токенам.

Пользователь заметил: «супернова куда тебе расти — там фон белый в чёрной
теме». Причина: после переноса макета цвета панели были зашиты литералами
светлой темы (#ede4ff→#f2eaff), и в тёмной теме панель оставалась белым
пятном.

Гейт проверяет:
  1) у панели героя и «оболочечных» элементов нет жёстко зашитых цветов —
     только токены;
  2) для панели героя заданы обе темы (светлая и тёмная);
  3) в тёмной теме панель тёмная: её токены отличаются от светлых.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps/web"
CSS = (WEB / "styles/globals.css").read_text(encoding="utf-8")
SHELL = (WEB / "styles/shell.css").read_text(encoding="utf-8")


def _strip_print(css: str) -> str:
    """Убираем блоки @media print по балансу скобок (внутри есть вложенные)."""
    out = css
    while True:
        m = re.search(r"@media print", out)
        if not m:
            return out
        i = out.index("{", m.end())
        depth, j = 0, i
        while j < len(out):
            if out[j] == "{":
                depth += 1
            elif out[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        out = out[: m.start()] + out[j + 1 :]


def _tokens(dark: bool = False) -> dict[str, str]:
    out: dict[str, str] = {}
    src = CSS
    if dark:
        # тёмных блоков несколько — действует ПОСЛЕДНИЙ вне @media print
        # (печатный сброс токенов — не про тему, а про бумагу)
        base = _strip_print(CSS)
        blocks = []
        for m in re.finditer(r'html\[data-theme="dark"\]\s*\{', base):
            i = base.index("{", m.end() - 1)
            depth, j = 0, i
            while j < len(base):
                if base[j] == "{":
                    depth += 1
                elif base[j] == "}":
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            blocks.append(base[i + 1 : j])
        assert blocks, "нет тёмного блока"
        # несколько тёмных блоков — по токену побеждает последнее объявление
        merged: dict[str, str] = {}
        for body in blocks:
            for name, value in re.findall(r"--([a-z0-9-]+):\s*([^;]+);", body):
                merged[name] = value.strip()
        src = "\n".join(f"--{k}: {v};" for k, v in merged.items())
    if not dark:
        # в светлой теме тёмные блоки не участвуют — вырезаем их
        src = re.sub(r'html\[data-theme="dark"\]\s*\{[^}]*\}', "", src)
    for name, value in re.findall(r"--([a-z0-9-]+):\s*([^;]+);", src):
        out[name] = value.strip()
    return out


def test_hero_panel_uses_tokens_not_literals():
    hero = SHELL[SHELL.index(".hero-main {") :]
    hero = hero[: hero.index("}")]
    assert "var(--hero-panel-a)" in hero and "var(--hero-panel-b)" in hero
    for literal in ("#ede4ff", "#f2eaff", "#2B1952", "#6B5F80"):
        assert literal not in hero, f"в панели героя зашит цвет {literal}"


def test_shell_layer_has_no_hardcoded_light_palette():
    css = re.sub(r"/\*[\s\S]*?\*/", "", SHELL)
    for literal in ("#ede4ff", "#f2eaff", "#eeeaf5", "#9386a8", "#9a8ba8",
                    "#8b7e9a", "#b5a9c0", "#b0a3bd", "#fffefd", "#faf8fe"):
        assert literal not in css, f"в слое оболочки зашит светлый цвет {literal}"


def test_panel_tokens_differ_between_themes():
    light = _tokens()
    dark = _tokens(dark=True)
    for name in ("hero-panel-a", "hero-panel-b", "hero-panel-ink",
                 "hero-panel-ink-2", "hero-panel-accent",
                 "shell-track", "shell-nav-idle", "shell-bottom-bg"):
        assert name in light, f"нет токена {name} (светлая)"
        assert name in dark, f"нет токена {name} (тёмная)"
    assert light["hero-panel-a"] != dark["hero-panel-a"], "панель одна и та же в обеих темах"
    assert light["hero-panel-ink"] != dark["hero-panel-ink"]
