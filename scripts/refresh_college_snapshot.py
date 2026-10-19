#!/usr/bin/env python3
"""Пересъёмка снимка страниц специальностей сайта колледжа (v14).

Снимок data/college/sielom_specialties.json хранит дословные work_places/works
всех 21 страницы sielom.ru (сайт серверный — данные лежат в __NEXT_DATA__).
Скрипт заново снимает все страницы и синхронизирует снимок: slug/url, карта
правок (corrections/moves) и порядок ключей сохраняются, дата fetched
обновляется на сегодняшнюю.

    python3 scripts/refresh_college_snapshot.py          # пересъёмка и запись
    python3 scripts/refresh_college_snapshot.py --check  # сверка без записи (exit 1 при дрейфе)

Правило всё-или-ничего: файл перезаписывается только после успешного снятия
всех страниц, иначе снимок остаётся нетронутым (exit 2). Сокращение любого
списка печатается предупреждением — сигнал «не опустеет» (порог держит
tests/test_v14_gates.py: ниже порога падает гейт, а не остаётся незамеченным).
"""

from __future__ import annotations

import datetime as dt
import json
import re
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "college" / "sielom_specialties.json"
PAUSE_S = 0.25


def find_speciality(obj: Any) -> dict[str, Any] | None:
    """Первый объект страницы, у которого есть work_places и works (как в скане)."""
    if isinstance(obj, dict):
        if "work_places" in obj and "works" in obj:
            return obj
        for value in obj.values():
            found = find_speciality(value)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for value in obj:
            found = find_speciality(value)
            if found is not None:
                return found
    return None


def names(values: Any) -> list[str]:
    out: list[str] = []
    for item in values or []:
        if isinstance(item, dict):
            out.append(str(item.get("name") or item.get("title") or "?"))
        else:
            out.append(str(item))
    return out


def fetch_page(slug: str) -> dict[str, Any]:
    """Дословные поля одной страницы специальности (как их снял скан v14)."""
    url = f"https://sielom.ru/specialties/{slug}"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    raw = urllib.request.urlopen(request, timeout=25).read().decode("utf-8", "replace")
    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>', raw)
    if not match:
        raise RuntimeError(f"{slug}: в HTML нет __NEXT_DATA__")
    page = find_speciality(json.loads(match.group(1)))
    if page is None:
        raise RuntimeError(f"{slug}: объект специальности не найден")
    # code/site_title — служебные метаданные, пишем с trim (сайт отдаёт
    # «33.02.01 » с хвостовым пробелом); списки «Где/Кем» остаются дословными —
    # на них смотрит карта правок corrections/moves.
    return {
        "code": str(page.get("code") or "").strip(),
        "site_title": str(page.get("title") or page.get("name") or "?").strip(),
        "work_places": names(page.get("work_places")),
        "works": names(page.get("works")),
    }


def refresh(check: bool) -> int:
    snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    pages: dict[str, Any] = snapshot.get("specialties") or {}
    if not pages:
        raise RuntimeError("в снимке нет specialties — нечего переснимать")
    live: dict[str, dict[str, Any]] = {}
    drift: list[str] = []
    total = len(pages)
    for index, spec_id in enumerate(sorted(pages), start=1):
        page = fetch_page(pages[spec_id]["slug"])
        live[spec_id] = page
        for field in ("code", "site_title", "work_places", "works"):
            before = pages[spec_id].get(field)
            after = page[field]
            if before != after:
                drift.append(f"{spec_id}.{field}")
            if field in ("work_places", "works") and len(after) < len(before or []):
                print(
                    f"ВНИМАНИЕ: {spec_id}.{field} сократился "
                    f"({len(before)} → {len(after)}) — проверь, не сломан ли парсинг",
                    file=sys.stderr,
                )
        print(
            f"[{index}/{total}] {spec_id}: "
            f"где={len(page['work_places'])}, кем={len(page['works'])}",
            flush=True,
        )
        time.sleep(PAUSE_S)
    if drift:
        print("дрейф снимка от сайта:")
        for item in drift:
            print(f"  {item}")
    else:
        print(f"снимок совпадает с сайтом: {total} страниц, дрейфа нет")
    if check:
        return 1 if drift else 0
    updated = dict(snapshot)
    updated["fetched"] = dt.date.today().isoformat()
    updated["specialties"] = {
        spec_id: {**pages[spec_id], **live[spec_id]} for spec_id in sorted(pages)
    }
    SNAPSHOT.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"записано: {SNAPSHOT.relative_to(ROOT)} (fetched: {updated['fetched']})")
    return 0


def main() -> int:
    try:
        return refresh(check="--check" in sys.argv[1:])
    except Exception as exc:  # noqa: BLE001 — пересъёмка не имеет права портить снимок
        print(f"пересъёмка не удалась, снимок не изменён: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
