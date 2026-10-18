"""Гейты волны v9 (совет mix, раунды 1–2): сетевые ошибки фронта + регрессия лисы.

1. Сетевые ошибки (/result, /plan, …). Инцидент демо-стенда: при недоступном
   API в UI уходило сырое «Failed to fetch», а AbortSignal.timeout вне try на
   Safari < 16.4 давал вечный скелетон без кнопки «Повторить». Контракт v9 —
   человеческие сообщения, фолбэк таймаута, защита не-JSON ответов и
   IPv4-дефолт BASE_URL (localhost уходил на ::1 — space-bunny, раунд 2).
2. Лиса. Баг v8: SVG-атрибут rotate(a cx cy) складывался с CSS
   transform-origin (--ox/--oy) и применял центр поворота дважды — глаз и
   нос физически улетали с морды (нашли в v9). Повороты — только CSS-стилем.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / "apps/web/lib/api.ts").read_text(encoding="utf-8")
FOX = (ROOT / "apps/web/components/IntroScene.tsx").read_text(encoding="utf-8")


# ---- 1. Сетевые ошибки фронта ---------------------------------------------


def test_base_url_default_is_ipv4():
    assert "process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'" in API
    assert "'http://localhost:8000'" not in API


def test_network_errors_are_human_readable():
    assert "Не удалось связаться с сервером" in API
    assert "Превышено время ожидания ответа сервера" in API
    assert "Сервер временно недоступен" in API
    # сырое сообщение браузера больше не уходит в интерфейс
    assert "error.message" not in API


def test_timeout_signal_has_fallback():
    assert "function makeTimeoutSignal" in API
    assert "typeof AbortSignal.timeout === 'function'" in API
    assert "const signal = AbortSignal.timeout(timeout)" not in API


def test_non_json_body_is_guarded():
    assert "await response.json()" not in API
    assert "response.text()" in API
    assert "Сервер вернул неожиданный ответ" in API


# ---- 2. Лиса: регрессия удвоенного центра поворота -------------------------


def test_fox_has_no_svg_rotate_attribute():
    assert 'transform="rotate' not in FOX
    assert "transform: 'rotate(-10deg)'" in FOX  # глаз и зрачок — CSS
    assert "transformOrigin: '352px 122px'" in FOX  # нос — CSS
