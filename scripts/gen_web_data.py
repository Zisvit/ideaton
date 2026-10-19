#!/usr/bin/env python3
"""Генератор офлайн-данных клиента (волна v11): scripts/gen_web_data.py.

Собирает JSON для клиентского офлайн-движка (apps/web/lib/localEngine.ts —
порт scoring.py и ручек /recommend, /plan) из тех же yaml, что читает API:
    data/roles/*.yaml  →  apps/web/lib/offlineData.json
Инварианты: словарь синонимов строится ТОЙ ЖЕ функцией scoring.load_synonyms;
строки-шаблоны ловит паритет-тест test_v11_parity.py; файл детерминирован
(sort_keys, LF) — тест test_v11_gates.py сравнивает перегенерацию байт-в-байт.
Запуск: python3 scripts/gen_web_data.py [--check]
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import yaml

ROOT = Path(__file__).resolve().parents[1]
ROLES_DIR = ROOT / "data" / "roles"
OUT = ROOT / "apps/web/lib/offlineData.json"
# v13: витрина главной — только 21 специальность колледжа, лёгкий файл.
# Один прогон генератора пишет оба выхода → файлы не могут разойтись
# (гейт test_v13_gates сравнивает перегенерацию байт-в-байт).
OUT_SPECIALTIES = ROOT / "apps/web/lib/specialties.json"
# v14: снимок страниц сайта колледжа (verbatim-списки «Где/Кем») — источник
# полей employers/positions/source в specialties.json. Снимок не генерируется:
# он фиксирован на дату (поле fetched); пересъёмка — scripts/refresh_college_snapshot.py.
COLLEGE_SNAPSHOT = ROOT / "data" / "college" / "sielom_specialties.json"

sys.path.insert(0, str(ROOT / "services/api"))
import scoring  # noqa: E402  (нужен sys.path выше)

SCHEMA = 1

# v15 (совет 7/9): группы направлений колледжа — единый источник правды для
# витрин («понятно о чём»). Порядок групп фиксирован; specialties.json получает
# производные поля group_* (см. render_specialties). Покрытие 21/21 ровно один
# раз проверяет генератор (fail-fast) и гейт tests/test_v15_gates.py.
SPEC_GROUPS: list[tuple[str, str, str, list[str]]] = [
    (
        "tech",
        "Техника и IT",
        "программирование, сети, оборудование, электрика",
        ["software_dev", "net_admin", "infocom", "electrician"],
    ),
    (
        "health_sport",
        "Здоровье и спорт",
        "медицина, уход, лекарства, спорт",
        ["medicine", "nursing", "pharmacy", "physical_culture"],
    ),
    (
        "education_people",
        "Образование и работа с людьми",
        "педагогика, воспитание, помощь людям",
        ["preschool", "pedagogy_extra", "correction_ped", "social_work"],
    ),
    (
        "money_trade",
        "Финансы, учёт и торговля",
        "банки, учёт, торговля",
        ["banking", "economics", "trade"],
    ),
    (
        "law_safety",
        "Право и безопасность",
        "юриспруденция, охрана порядка, соцобеспечение",
        ["law_court", "law_enforcement", "law_social"],
    ),
    (
        "design_beauty",
        "Дизайн и красота",
        "графика, дизайн, индустрия красоты",
        ["design", "graphic_design", "beauty"],
    ),
]

# Дословные копии scoring.py/main.py — расхождение ловит test_v11_parity.py.
CONSTANTS: dict[str, Any] = {
    "defaultLimit": 12,  # main.DEFAULT_LIMIT
    "interestBonusCap": 3,  # scoring.INTEREST_BONUS_CAP
    "gapTaskLimit": 3,  # scoring.GAP_TASK_LIMIT
    "checkForbiddenWords": ["гарант", "оффер", "офер", "трудоустро", "зарплат"],
}

STRINGS = {
    "whyMatched": "Совпадают навыки: ",
    "whyInterests": "Интересы напрямую соответствуют роли: ",
    "whySpecialty": "Специальность «{specialty}» близка к роли",
    "whySubjects": "Предметы профиля пересекаются с ролью: ",
    "whyNoMatch": "Прямых совпадений с навыками нет — направление включено для старта с нуля",
    "emptyProfileWhy": "Заполните профиль — направление включено как базовый ориентир",
    "gapHuman": "Не хватает навыка: {name}",
    "gapTask": "Закрыть пробел «{name}»: обязательный навык роли, в профиле его нет",
    "checklistDone": "Освоен навык «{id}»",
    "checklistFull": "Профиль покрывает навыки роли — план расширяет опыт",
    "summary": "План на 30 дней для роли «{title}»: 4 недели, {steps} шагов из рубрики роли, {gaps} пробелов в профиле. Все шаги взяты из закрытой базы ролей.",
    "summaryPersonal": " Недели 1–2 начинаются с {n} персональных задач закрытия твоих пробелов.",
    "disclaimer": "План носит рекомендательный характер и не является гарантией трудоустройства или оффера.",
    "checkChoicePrompt": "Что делает {title}?",
    "checkSelfSkillPrompt": "Объясни своими словами: что такое {skill} и зачем оно в роли «{title}»?",
    "checkSelfRolePrompt": "Объясни своими словами: в чём суть роли «{title}»?",
    "checkSource": "role:{id} — description",
    "checkChoiceId": "{id}-what-is",
    "checkSelfId": "{id}-own-words",
}


def _load_roles() -> list[dict[str, Any]]:
    roles: list[dict[str, Any]] = []
    for path in sorted(ROLES_DIR.glob("*.yaml")):
        if path.name == "skills.yaml":
            continue
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError:
            continue
        for role in data if isinstance(data, list) else [data]:
            if (
                isinstance(role, dict)
                and role.get("id")
                and role.get("title")
                and isinstance(role.get("skills_required"), list)
            ):
                roles.append(role)
    return roles


def _clean(role: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(role["id"]),
        "kind": str(role.get("kind") or "role"),
        "title": str(role.get("title", role["id"])),
        "description": str(role.get("description") or ""),
        "skills_required": [
            {"id": str(r.get("id", "")), "weight": float(r.get("weight", 0.0))}
            for r in role.get("skills_required") or []
        ],
        "related_specialties": [str(s) for s in role.get("related_specialties") or []],
        "tags": [str(t) for t in role.get("tags") or []],
        "development_steps": [str(s) for s in role.get("development_steps") or []],
        "resources": [
            {
                "title": str(r.get("title", "")),
                "url": str(r.get("url", "")),
                "type": r.get("type"),
                "minutes": r.get("minutes"),
            }
            for r in role.get("resources") or []
        ],
    }


def build_payload() -> dict[str, Any]:
    aliases = scoring.load_synonyms(ROLES_DIR / "skills.yaml")
    names = scoring.load_skill_names(ROLES_DIR / "skills.yaml")
    roles = sorted((_clean(r) for r in _load_roles()), key=lambda r: r["id"])
    if len(roles) < 20:
        raise SystemExit(f"подозрительно мало ролей: {len(roles)}")
    h = hashlib.sha256()
    for p in sorted(ROLES_DIR.glob("*.yaml")):
        h.update(p.name.encode("utf-8") + b"\n")
        h.update(p.read_bytes() + b"\n")
    return {
        "schema": SCHEMA,
        "generatedBy": "scripts/gen_web_data.py",
        "sourceHash": "sha256:" + h.hexdigest(),
        "aliases": aliases,
        "skill_names": names,
        "roles": roles,
        "constants": CONSTANTS,
        "strings": STRINGS,
    }


def render(payload: dict[str, Any] | None = None) -> str:
    payload = build_payload() if payload is None else payload
    return json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True) + "\n"


def _load_college() -> dict[str, Any]:
    """Снимок сайта колледжа (v14): verbatim-страницы + карта правок опечаток."""
    return json.loads(COLLEGE_SNAPSHOT.read_text(encoding="utf-8"))


def clean_college_names(values: Any, corrections: dict[str, str]) -> list[str]:
    """Ряд списка со страницы сайта → аккуратные подписи карточки (v14).

    Порядок: trim → сжатие пробелов → правка опечатки (точное совпадение
    строки) → дедуп по порядку источника. Дословный текст остаётся в снимке;
    сюда попадает только производная для показа.
    """
    out: list[str] = []
    seen: set[str] = set()
    for raw in values if isinstance(values, list) else []:
        name = re.sub(r"\s+", " ", str(raw)).strip()
        name = corrections.get(name, name)
        if name and name not in seen:
            seen.add(name)
            out.append(name)
    return out


def college_lists(
    page: dict[str, Any],
    corrections: dict[str, str],
    moves: dict[str, str],
) -> tuple[list[str], list[str]]:
    """employers/positions страницы снимка (v14): правки + переносы строк.

    moves — точечные переезды, когда источник положил строку не в тот список
    («3D-визуализатор» в «Где можно работать»): строка не теряется, а встаёт
    в конец целевого списка. Дедуп и порядок источника сохраняются.
    """
    employers = clean_college_names(page.get("work_places"), corrections)
    positions = clean_college_names(page.get("works"), corrections)
    moved_out = [n for n in employers if moves.get(n) == "positions"]
    if moved_out:
        employers = [n for n in employers if moves.get(n) != "positions"]
        positions = positions + [n for n in moved_out if n not in positions]
    moved_back = [n for n in positions if moves.get(n) == "employers"]
    if moved_back:
        positions = [n for n in positions if moves.get(n) != "employers"]
        employers = employers + [n for n in moved_back if n not in employers]
    return employers, positions


def spec_group_map(spec_ids: list[str]) -> dict[str, tuple[str, str, str, int]]:
    """id специальности → (группа, подпись, хинт, порядок) — fail-fast.

    Непокрытая специальность, неизвестный id или дубль останавливают
    генерацию: specialties.json не «потеряет» карточку молча (v15).
    """
    covered: dict[str, tuple[str, str, str, int]] = {}
    for order, (slug, title, hint, ids) in enumerate(SPEC_GROUPS, start=1):
        for sid in ids:
            if sid in covered:
                raise SystemExit(f"направление {sid} попало в две группы")
            covered[sid] = (slug, title, hint, order)
    missing = [sid for sid in spec_ids if sid not in covered]
    if missing:
        raise SystemExit(f"группы не покрывают специальности: {missing}")
    stale = [sid for sid in covered if sid not in spec_ids]
    if stale:
        raise SystemExit(f"в группах неизвестные направления: {stale}")
    return covered


def render_specialties(payload: dict[str, Any] | None = None) -> str:
    """Второй выход (v13, расширен v14): специальности колледжа для витрины.

    Берём те же очищенные роли, что и offlineData.json, раскрываем
    человекочитаемые имена навыков из skill_names — index.tsx не тянет
    ни движок, ни 63 КБ offlineData (гейт чанков v11 остаётся зелёным).
    v14 (совет 7/9): добавляем связку с сайтом колледжа — employers
    («Где можно работать»), positions («Кем можно работать») и source
    (домен и дата снимка). Снимок обязан покрывать все специальности,
    иначе генерация останавливается — данные не «опустеют» молча.
    Правки строк (corrections) и переносы между списками (moves) применяет
    college_lists — источник при этом не искажается (verbatim остаётся в снимке).
    v15 (совет 7/9): каждая специальность получает поля группы из SPEC_GROUPS
    (group_id/group_title/group_hint/group_order) для секций витрин; порядок
    карточек остаётся по id — байт-в-байт гейты и id-порядок не тронуты.
    """
    payload = build_payload() if payload is None else payload
    names = payload.get("skill_names", {})
    college = _load_college()
    corrections = {
        str(k): str(v) for k, v in (college.get("corrections") or {}).items()
    }
    moves = {str(k): str(v) for k, v in (college.get("moves") or {}).items()}
    pages = college.get("specialties") or {}
    host = urlparse(str(college.get("site") or "")).netloc
    fetched = str(college.get("fetched") or "")
    source = f"{host} ({fetched})" if host and fetched else host
    specialties = [
        role for role in payload.get("roles", []) if role.get("kind") == "specialty"
    ]
    missing = [role["id"] for role in specialties if role["id"] not in pages]
    if missing:
        raise SystemExit(f"снимок сайта колледжа не покрывает специальности: {missing}")
    lists = {
        role["id"]: college_lists(pages[role["id"]], corrections, moves)
        for role in specialties
    }
    groups = spec_group_map([role["id"] for role in specialties])
    items = [
        {
            "id": role["id"],
            "title": role["title"],
            "group_id": groups[role["id"]][0],
            "group_title": groups[role["id"]][1],
            "group_hint": groups[role["id"]][2],
            "group_order": groups[role["id"]][3],
            "description": role["description"],
            "skills": [
                {"id": skill["id"], "name": names.get(skill["id"], skill["id"])}
                for skill in role.get("skills_required", [])
            ],
            "employers": lists[role["id"]][0],
            "positions": lists[role["id"]][1],
            "source": source,
        }
        for role in specialties
    ]
    return json.dumps(items, ensure_ascii=False, indent=1) + "\n"


def main() -> int:
    payload = build_payload()
    blob = render(payload)
    spec_blob = render_specialties(payload)
    if "--check" in sys.argv:
        stale = False
        for out, text, name in (
            (OUT, blob, "offlineData.json"),
            (OUT_SPECIALTIES, spec_blob, "specialties.json"),
        ):
            current = out.read_text(encoding="utf-8") if out.is_file() else ""
            if current != text:
                print(f"{name} устарел — перегенерируй", file=sys.stderr)
                stale = True
        if stale:
            return 1
        print("offlineData.json и specialties.json актуальны")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(blob, encoding="utf-8")
    OUT_SPECIALTIES.write_text(spec_blob, encoding="utf-8")
    spec_count = len(json.loads(spec_blob))
    print(
        f"записано {OUT.relative_to(ROOT)}: {len(blob.encode('utf-8'))} байт, "
        f"ролей={len(payload['roles'])}, синонимов={len(payload['aliases'])}; "
        f"{OUT_SPECIALTIES.relative_to(ROOT)}: {len(spec_blob.encode('utf-8'))} байт, "
        f"специальностей={spec_count}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
