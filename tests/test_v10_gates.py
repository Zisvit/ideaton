"""Гейты волны v10 (совет mix): маска боба foxLand, мех без «рожек»,
галоп (legStride + foxRun), call-site-таймауты и shape/seq-гарды фронта.

Контекст (раунды 1–2 + эмпирика стенда):
1. foxLand с fill: both + delay 1560ms держал 0%-кадр весь бег 0–1560
   (backwards-fill, поздний в списке) и глушил foxBob целиком — тело не
   качалось, лис всегда 1.06×1 (замер computed transform). Фикс — forwards
   и 0%-кадр = поза боба на стыке 1560 (translateY(-5px) rotate(-.7deg)).
2. Мех: старые штрихи «рожки» (второй парил над спиной +5.9…+7.3u) убраны,
   лопасти лежат ниже линии спины (замер по контуру: просвет ≥7u).
3. Галоп: 62%-кадр legStride больше не «складывает» ногу (.78→.88), 46%
   вытянут (1.08→1.10); foxRun доводит лису до X=0 уже в прыжке (96%).
4. Фронт: call-site таймауты (8с /recommend, 30с /plan; дефолт 15000 жив),
   shape-guard (Array.isArray) и seq-guard (reqRef) от гонки ответов.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = (ROOT / "apps/web/styles/globals.css").read_text(encoding="utf-8")
FOX = (ROOT / "apps/web/components/IntroScene.tsx").read_text(encoding="utf-8")
API = (ROOT / "apps/web/lib/api.ts").read_text(encoding="utf-8")
RESULT = (ROOT / "apps/web/pages/result.tsx").read_text(encoding="utf-8")
PLAN = (ROOT / "apps/web/pages/plan.tsx").read_text(encoding="utf-8")


def _keyframes_body(name):
    m = re.search(r"@keyframes\s+" + name + r"\s*\{", CSS)
    assert m, f"нет @keyframes {name}"
    i = CSS.index("{", m.end() - 1)
    depth = 0
    j = i
    while j < len(CSS):
        if CSS[j] == "{":
            depth += 1
        elif CSS[j] == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    return CSS[i + 1 : j]


def test_foxland_forwards_unmasks_foxbob():
    assert re.search(
        r"\.is-run \.fox-bob \{[^}]*foxLand 300ms ease-in-out 1560ms 1 forwards", CSS
    )
    assert "foxLand 300ms ease-in-out 1560ms 1 both" not in CSS


def test_foxland_0pct_stitches_with_bob_pose():
    body = _keyframes_body("foxLand")
    assert "translateY(-5px) rotate(-.7deg) scale(1, 1)" in body
    # стык с 1560мс считается по foxBob (50% = -5px/-.7deg, 4-й цикл 51.2%)
    bob = _keyframes_body("foxBob")
    assert "translateY(-5px) rotate(-.7deg)" in bob


def test_foxland_landing_frames_untouched():
    body = _keyframes_body("foxLand")
    assert "translateY(-52px) scale(1.06, 1)" in body  # 43%
    assert "scale(1.16, .84)" in body  # 60% — удар (dust 1740)
    assert "scale(.98, 1.03)" in body  # 80%


def test_legstride_gallop_tuning():
    body = _keyframes_body("legStride")
    assert "scaleY(1.10)" in body and "scaleY(.88)" in body
    assert "scaleY(.78)" not in body and "scaleY(1.08)" not in body


def test_foxrun_stops_in_flight():
    body = _keyframes_body("foxRun")
    assert "96%" in body and "-30vw" in body and "-13vw" in body
    assert "-32vw" not in body and "-14vw" not in body
    assert "90.7%" not in body


def test_fur_has_no_horns():
    assert "M156 128" not in FOX  # парящий штрих над спиной
    assert "M132 150 C148 140" not in FOX  # старый штрих меха
    # три лопасти (space-bunny) ниже линии спины
    assert "M134 151" in FOX and "M129 157" in FOX and "M239 152" in FOX
    # старая stroked-группа меха удалена целиком (у rim ноги strokeWidth 1)
    assert 'stroke="#FFF6EA" strokeWidth="1.3"' not in FOX


def test_call_site_timeouts():
    assert "timeout: 8000" in RESULT
    assert "timeout: 30000" in PLAN
    assert "timeout = 15000" in API  # дефолт не тронут


def test_shape_and_seq_guards():
    assert "Array.isArray(res.data.roles)" in RESULT
    assert "Array.isArray(res.data.weeks)" in PLAN
    assert "Array.isArray(res.data.checklist)" in PLAN  # нормализация аддитивного поля
    # seq-guard: id запроса + инкремент в cleanup обоих эффектов
    for src in (RESULT, PLAN):
        assert "++reqRef.current" in src and "reqRef.current++" in src


def test_ariabusy_moved_to_main():
    assert RESULT.count("aria-busy") == 1
    assert re.search(r"<main[^>]*aria-busy=\{loading\}", RESULT)
