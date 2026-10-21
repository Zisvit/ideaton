"""Гейт волны v18: вход в версию для работодателя внизу главной.

Запрос пользователя: отдельная версия для работодателя — «просто сделай
кнопку внизу страницы». /employer уже существует как каталог направлений;
на главной добавляем нижний CTA после витрины, не дублируя страницу.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "apps" / "web" / "pages" / "index.tsx").read_text(encoding="utf-8")


def test_employer_cta_is_at_bottom_of_home():
    assert 'className="cta-bar employer-cta"' in INDEX
    # кнопка стоит после витрины направлений, а не только в шапке
    assert INDEX.index("employer-cta") > INDEX.index("spec-section")
    tail = INDEX[INDEX.index("employer-cta") :]
    assert 'href="/employer"' in tail
    assert "Версия для работодателя" in tail


def test_employer_cta_is_a_real_route_link():
    # Next Link на статический маршрут /employer, без onClick-заглушки
    tail = INDEX[INDEX.index("employer-cta") :]
    assert '<Link href="/employer"' in tail
    assert "onClick" not in tail.split("</Link>", 1)[0]
