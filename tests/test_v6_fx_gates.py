"""Гейты v6: fx-декор и целостность (совет v6, раунд 2: longcat/big-pickle/
deepseek/super-vl).

Контракты:
  - НОВЫЙ keyframe ровно один — foxMiniBlink (29→30/30, свободный слот гейта);
    conic — НЕ keyframe: один оборот transition'ом, класс .is-swept;
  - paint-traps запрещены ВЕСЬ файл: backdrop-filter / mix-blend-mode /
    @property отсутствуют (гейт проверяет);
  - grid-template-rows transition — единственное layout-исключение
    (проверяется в test_v6_mini_checks);
  - шум: запечённый PNG public/noise-64.png (64×64, ≤8KB, палитра+alpha),
    подключён вторым бэкграундом .fix-bg, БЕЗ blend, НЕ поверх контента;
  - печать/reduced-motion: conic-псевдо скрыт на бумаге, RM гасит
    переход conic (остальное — универсальный kill v5).
"""

import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _strip_comments(text: str) -> str:
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    text = re.sub(r"^\s*//.*$", "", text, flags=re.M)
    return text


# CSS-скан — по КОДУ: документация в комментариях («БЕЗ backdrop-filter»)
# не является paint-trap'ом (гейт должен ловить свойства, а не прозу)
CSS = _strip_comments(
    (ROOT / "apps/web/styles/globals.css").read_text(encoding="utf-8")
)
PNG = ROOT / "apps/web/public/noise-64.png"
CONSULTANT = _strip_comments(
    (ROOT / "apps/web/pages/consultant.tsx").read_text(encoding="utf-8")
)

FORBIDDEN_PAINT = ("backdrop-filter", "mix-blend-mode", "@property")


def test_no_paint_traps_anywhere():
    for trap in FORBIDDEN_PAINT:
        assert trap not in CSS, f"paint-trap в CSS: {trap}"


def test_conic_is_transition_once_not_keyframe():
    # имя fxConicSpin запрещено (space-bunny/longcat): вращение — transition
    assert "fxConicSpin" not in CSS
    assert "fx-conic.is-swept::before" in CSS
    # ровно один оборот на карте навыков index; result/plan не участвуют
    assert CSS.count(".fx-conic") >= 2  # база + is-swept (плюс MUTE — выше)
    # transition линейный, период токен <= 12s (дуга ≥90°/3с — super-vl)
    assert "transition: transform var(--fx-conic) linear" in CSS
    assert "--fx-conic: 12s" in CSS
    # teardown: is-swept-done снимает слой (big-pickle)
    assert "fx-conic.is-swept-done::before" in CSS
    # фолбэк для браузеров без conic: рамка .card остаётся
    assert "@supports (background: conic-gradient(#000, #fff))" in CSS


def test_noise_asset_baked_and_wired():
    raw = PNG.read_bytes()
    assert raw[:8] == b"\x89PNG\r\n\x1a\n", "это не PNG"
    w, h = struct.unpack(">II", raw[16:24])
    assert (w, h) == (64, 64), f"плитка должна быть 64×64: {(w, h)}"
    ctype = raw[25]
    assert ctype == 3, "ожидаем палитровый PNG с tRNS (мало байт)"
    assert len(raw) <= 8192, f"PNG > 8KB: {len(raw)}"
    # подключение: 2-й бэкграунд .fix-bg, без blend, без fixed-attachment
    assert "url('/noise-64.png')" in CSS or 'url("/noise-64.png")' in CSS
    assert "background-attachment: fixed" not in CSS


def test_foxmini_blade_single_new_keyframe():
    # единственный новый кейфрейм: короткое окно моргания (93–97%)
    assert "@keyframes foxMiniBlink" in CSS
    assert "95%, 97%" in CSS
    # лис-мини в консультанте, 44×36, реюз breath/tailIdle
    assert 'className="foxMini"' in CONSULTANT
    assert ".foxMini__eye" in CSS and ".foxMini__body" in CSS
    assert "animation: breath" in CSS
    assert "tailIdle" in CSS


def test_v6_print_and_rm():
    # print-блок v6: коник-псевдо и шапка чата скрыты
    tail = CSS.split("@media print")[-1]
    assert ".fx-conic::before" in tail and "display: none !important" in tail
    # RM: conic-переход гасится явно (универсальный kill уже есть в v5)
    rm = "\n".join(CSS.split("@media (prefers-reduced-motion: reduce)")[1:])
    assert ".fx-conic::before { transition: none !important; }" in rm


def test_grad_titles_family():
    # статичный бренд-градиент на заголовках result/plan/consultant
    # v7: «5» ушло из заголовка — список направлений 1–12, показываем 5 + «все»
    assert 'className="grad">Твои направления' in (
        ROOT / "apps/web/pages/result.tsx"
    ).read_text(encoding="utf-8")
    assert 'className="grad">План на 30 дней' in (
        ROOT / "apps/web/pages/plan.tsx"
    ).read_text(encoding="utf-8")
    assert 'className="grad">Консультант' in CONSULTANT
