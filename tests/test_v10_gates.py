"""Гейты волны v10 (совет mix): call-site-таймауты и shape/seq-гарды фронта.

Контекст (раунды 1–2 + эмпирика стенда): таймауты на вызовах API (8с
/recommend, 30с /plan; дефолт 15000 жив), shape-guard (Array.isArray) и
seq-guard (reqRef) от гонки ответов.

v31: контракты персонажа (маска приземления, галоп, мех) сняты — персонаж
убран из продукта целиком (см. tests/test_v31_no_mascot.py).
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = (ROOT / "apps/web/styles/globals.css").read_text(encoding="utf-8")
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
