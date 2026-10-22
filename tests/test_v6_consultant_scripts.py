"""Гейты v6: скрипт-консультант (совет v6, раунд 2 — 9/9).

Контракты:
  - USE_LIVE_CHAT = false: диалог целиком на заготовленных скриптах,
    POST /chat НЕ вызывается (консультант не падает на failed-fetch);
  - guard-зёрна (зарплата/трудоустройство/парс вакансий/двойник) перехватываются
    ДО keyword-матчинга; лексикон-запрет обещаний с allowlist отрицаний
    («не обещает», «не парсим» — честность не должна «умереть от гейта»,
    super-vl/deepseek);
  - 7 тем + guard; каждая тема завершается ДЕЙСТВИЕМ (CTA или ≥2 чипов);
  - keyword-словарь ≥6 слов на тему, включая ≥2 разговорных;
  - бейдж «скриптовый режим» + подпись «текст не уходит в сеть».
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _strip_comments(text: str) -> str:
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    text = re.sub(r"^\s*//.*$", "", text, flags=re.M)
    return text


SCRIPTS = _strip_comments(
    (ROOT / "apps/web/lib/consultantScripts.ts").read_text(encoding="utf-8")
)
PAGE = _strip_comments(
    (ROOT / "apps/web/pages/consultant.tsx").read_text(encoding="utf-8")
)

# «запрещаем ОБЕЩАНИЯ», а не слово-корень (иначе честный guard-скрипт умирает)
PROMISE_PATTERNS = (
    "найдёшь работу",
    "найдешь работу",
    "гарантирую",
    "обещаю",
    "устроим",
    "100%",
)
NEGATION_ALLOWLIST = ("не обещает", "не обещаем", "не парсим")

TOPICS_RE = re.compile(r"id:\s*'([a-z-]+)'", re.M)


def test_flag_off_and_no_network_calls():
    # руководство включает live-сценарий ОДНИМ флагом, /chat в скрипте не живёт
    assert "export const USE_LIVE_CHAT = false" in SCRIPTS
    # страница консультанта вообще не содержит сетевых вызовов
    assert "apiFetch" not in PAGE
    assert "/chat" not in PAGE
    assert "fetch(" not in PAGE


def test_guard_terms_catch_before_match():
    for term in ("зарплат", "трудоустройств", "парси", "двойник"):
        assert f"'{term}'" in SCRIPTS, f"guard-зерно не на месте: {term}"
    # guard стоял первым: matchTopic проверяет GUARD_TERMS раньше keyword'ов
    body = SCRIPTS.split("export function matchTopic")[1]
    guard_first = (
        body.index("GUARD_TERMS") < body.index("TOPICS") if "TOPICS" in body else True
    )
    assert guard_first


def test_seven_topics_plus_guard():
    # парсим только область TOPICS (до guard-темы): 'greet'/'miss' —
    # id приветствия и miss-ответа, не темы
    region = SCRIPTS.split("export const GUARD_TOPIC")[0]
    ids = TOPICS_RE.findall(region)
    assert "guard-honest" not in ids
    assert len(ids) == 7, f"тем должно быть 7, найдено: {ids}"


def test_every_topic_ends_with_action():
    # CTA у каждой темы (кроме guard — у guard он тоже есть) + ≥2 follow-up чипов
    blocks = re.split(r"\n  \{\n    id: '", SCRIPTS)
    for block in blocks[1:]:
        if block.startswith("'"):
            block = "    id: '" + block
        assert "cta:" in block, "тема без действия (CTA)"
        chips = re.findall(r"topicId:", block)
        assert len(chips) >= 2, f"follow-up чипов < 2 в теме: {block[:80]!r}"


def test_keywords_dense_and_colloquial():
    # словарь ≥6 слов на тему; в топ-7 словарях есть разговорные обороты
    colloquial = ("чё", "затупил", "не потяну", "забил", "не знаю", "боюсь")
    hits = sum(1 for c in colloquial if c in SCRIPTS)
    assert hits >= 3, f"разговорных оборотов в словарях: {hits}"
    topic_blocks = re.findall(
        r"id:\s*'([a-z-]+)'[\s\S]*?keywords:\s*\[([\s\S]*?)\],\n  \},",
        SCRIPTS,
    )
    for tid, kw_block in topic_blocks:
        if tid.startswith("guard"):
            continue
        count = len(re.findall(r"'[^']+'", kw_block))
        assert count >= 6, f"словарь темы {tid}: {count} < 6 слов"


def test_no_promises_in_topics():
    # запрещены обещания; отрицания в guard-теме легальны (allowlist).
    # Сам список GUARD_TERMS (литералы для входного матчинга) скану не
    # подлежит — проверяем темы и приветствие, а не группы-перехватчики.
    before, rest = SCRIPTS.split("export const GUARD_TERMS", 1)
    after = "\n".join(rest.split("\n]\n")[1:]) if "\n]\n" in rest else ""
    scanned = before + after
    for pat in PROMISE_PATTERNS:
        for line in scanned.splitlines():
            if pat in line:
                assert any(neg in line for neg in NEGATION_ALLOWLIST), (
                    f"обещание без отрицания: {pat!r} в: {line.strip()[:80]!r}"
                )


def test_badge_and_honesty_subscript():
    assert "badge--script" in PAGE
    assert "Скриптовый режим" in PAGE
    assert "текст не уходит в сеть" in PAGE
    # помощник — проводник по памяткам, от первого лица проекта
    assert "Помощник" in PAGE
