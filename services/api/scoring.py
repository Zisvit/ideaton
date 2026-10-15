"""Чистый rule-based скоринг карьерных ролей.

Зависимости: только pyyaml + стандартная библиотека. Никакого I/O в
score/rank — все функции чистые, детерминированные (тай-брейк по role_id).

Формула (по ТЗ):
    raw   = sum(weight_i * match_i) + min(|interests ∩ tags роли|, 3)
    score = round(100 * raw / max_raw),  max_raw = sum(weights) + 3
    gaps  = skills_required роли − skills профиля

Нормализация навыков — по словарю синонимов data/roles/skills.yaml. Словарь
бывает в двух форматах (оба поддержаны):
  * вложенный (реальный файл):  {skills: {id: {name, synonyms: [...]}}}
  * плоский (legacy/фолбэк):    {id: [синоним, ...]}
Кириллические синонимы («1с» → id «1c») обрабатываются: ключи и синонимы
нормализуются через strip().lower().
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

INTEREST_BONUS_CAP = 3


def _put_alias(alias_to_id: dict[str, str], alias: str, canonical: str) -> None:
    key = str(alias).strip().lower()
    if key:
        alias_to_id.setdefault(key, canonical)


def load_synonyms(path: Path) -> dict[str, str]:
    """Строит словарь alias → canonical id из skills.yaml (оба формата).

    Нечитаемый/отсутствующий файл → пустой словарь (нормализация — identity).
    Сам canonical id тоже является alias'ом. Словарь имён (name) тоже
    учитывается как синоним («1С» → id «1c»).
    """
    alias_to_id: dict[str, str] = {}
    if not path.is_file():
        return alias_to_id
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError:
        return alias_to_id
    if not isinstance(data, dict):
        return alias_to_id

    # Вложенный формат: {'skills': {id: {name, synonyms}}}
    container: dict[str, Any] = data
    inner = data.get("skills")
    if isinstance(inner, dict):
        container = inner

    for canonical, meta in container.items():
        cid = str(canonical).strip().lower()
        if not cid:
            continue
        alias_to_id[cid] = cid
        if isinstance(meta, dict):
            _put_alias(alias_to_id, str(meta.get("name", "")), cid)
            synonyms = meta.get("synonyms")
            if isinstance(synonyms, list):
                for alias in synonyms:
                    _put_alias(alias_to_id, str(alias), cid)
        elif isinstance(meta, list):  # плоский формат: {id: [синонимы]}
            for alias in meta:
                _put_alias(alias_to_id, str(alias), cid)
    return alias_to_id


def normalize_skill(skill: str, alias_to_id: dict[str, str]) -> str:
    """Нормализует навык профиля к каноническому id (или к lower/strip виду)."""
    key = str(skill).strip().lower()
    return alias_to_id.get(key, key)


def role_tags(role: dict[str, Any]) -> set[str]:
    """Теги роли: поле tags (если есть) + related_specialties в lower-виде."""
    tags: set[str] = set()
    for t in role.get("tags") or []:
        s = str(t).strip().lower()
        if s:
            tags.add(s)
    for s in role.get("related_specialties") or []:
        s2 = str(s).strip().lower()
        if s2:
            tags.add(s2)
    return tags


def score_role(
    profile: dict[str, Any],
    role: dict[str, Any],
    alias_to_id: dict[str, str],
) -> tuple[int, list[str], list[str], list[str]]:
    """Оценивает одну роль.

    Возвращает (score 0–100, matched skill ids, gaps, matched interests).
    """
    profile_skills = {
        normalize_skill(s, alias_to_id) for s in profile.get("skills") or []
    }
    matched: list[str] = []
    weights_sum = 0.0
    raw = 0.0
    for req in role.get("skills_required") or []:
        rid = str(req.get("id", "")).strip().lower()
        weight = float(req.get("weight", 0.0))
        weights_sum += weight
        if rid and rid in profile_skills:
            matched.append(rid)
            raw += weight

    profile_interests = {str(i).strip().lower() for i in profile.get("interests") or []}
    overlap = profile_interests & role_tags(role)
    raw += min(len(overlap), INTEREST_BONUS_CAP)

    max_raw = weights_sum + INTEREST_BONUS_CAP
    score = int(round(100 * raw / max_raw)) if max_raw > 0 else 0
    score = max(0, min(100, score))

    required_ids = {
        str(req.get("id", "")).strip().lower()
        for req in role.get("skills_required") or []
        if req.get("id")
    }
    gaps = sorted(required_ids - profile_skills)
    return score, matched, gaps, sorted(overlap)


def build_why(
    profile: dict[str, Any],
    role: dict[str, Any],
    matched: list[str],
    overlap_interests: list[str],
    alias_to_id: dict[str, str],
) -> list[str]:
    """Human-причины «почему роль подходит» (контракт: why, minItems 1)."""
    why: list[str] = []
    if matched:
        shown: list[str] = []
        for req in role.get("skills_required") or []:
            rid = str(req.get("id", "")).strip().lower()
            if rid in matched:
                shown.append(rid)
        why.append("Совпадают навыки: " + ", ".join(shown or matched))
    if overlap_interests:
        why.append(
            "Интересы напрямую соответствуют роли: " + ", ".join(overlap_interests)
        )
    specialty = str(profile.get("specialty") or "").strip().lower()
    if specialty:
        for spec in role.get("related_specialties") or []:
            if specialty == str(spec).strip().lower():
                why.append(f"Специальность «{profile.get('specialty')}» близка к роли")
                break
    subjects = {str(s).strip().lower() for s in profile.get("subjects") or []}
    if subjects:
        joined = (
            " ".join(str(s) for s in (role.get("description") or "")).lower()
            + " "
            + " ".join(str(s) for s in role_tags(role))
        )
        hit = sorted(subj for subj in subjects if subj and subj in joined)
        if hit:
            why.append("Предметы профиля пересекаются с ролью: " + ", ".join(hit))
    if not why:
        # Контракт требует why.minItems = 1 — честная формулировка при score 0.
        why.append(
            "Прямых совпадений с навыками роли нет — роль включена как направление "
            "для старта с нуля"
        )
    return why


def rank_roles(
    profile: dict[str, Any],
    roles: list[dict[str, Any]],
    alias_to_id: dict[str, str],
) -> list[dict[str, Any]]:
    """Скорит и отранжирует роли. Детерминированно: (-score, role_id)."""
    rows: list[dict[str, Any]] = []
    for role in roles:
        score, matched, gaps, overlap = score_role(profile, role, alias_to_id)
        rows.append(
            {
                "role_id": role["id"],
                "title": role.get("title", role["id"]),
                "score": score,
                "matched": matched,
                "gaps": gaps,
                "overlap_interests": overlap,
            }
        )
    rows.sort(key=lambda r: (-r["score"], r["role_id"]))
    return rows
