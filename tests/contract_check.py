#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""contract_check.py — офлайн-проверка контрактов «Карьерного трекера».

Запуск без сервера и без сети:

    python3 tests/contract_check.py

Что проверяем:
  1. packages/contracts/openapi.yaml — парсинг (PyYAML, а если его нет —
     встроенный fallback-парсер) и наличие 4 эндпоинтов: health, recommend,
     plan, chat. У каждого эндпоинта есть хотя бы одна операция и 2xx-ответ.
  2. data/roles/*.yaml — парсинг каждого файла, обязательные поля роли
     (берём из packages/contracts/roles.schema.json, иначе встроенный список)
     и сверка id навыков из skills_required со закрытым словарём skills.yaml.
     Дубликаты id ролей между файлами — ошибка.
  3. data/students_demo.json — парсинг и наличие студента с ПУСТЫМ профилем.

Поведение на отсутствующих файлах: SKIP с предупреждением, код выхода 0 —
CI зелёный с первого дня, пока артефакты параллельных потоков не приземлились.
STRICT_MISSING=1 превращает пропуски в ошибки (для будущего строгого гейта).

Код выхода: 0 — нет FAIL (SKIP/WARN не считаются), 1 — есть хотя бы один FAIL.

Переменные окружения (пути, относительные считаются от корня репозитория):
  OPENAPI_FILE    packages/contracts/openapi.yaml
  ROLES_DIR       data/roles
  ROLES_SCHEMA    packages/contracts/roles.schema.json
  SKILLS_FILE     data/skills.yaml
  DEMO_FILE       data/students_demo.json
  STRICT_MISSING  1 → отсутствующие файлы это FAIL, а не SKIP
"""

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _p(env_name, default_rel):
    val = os.environ.get(env_name)
    return Path(val) if val else (ROOT / default_rel)


OPENAPI_FILE = _p("OPENAPI_FILE", "packages/contracts/openapi.yaml")
ROLES_DIR = _p("ROLES_DIR", "data/roles")
ROLES_SCHEMA = _p("ROLES_SCHEMA", "packages/contracts/roles.schema.json")
SKILLS_FILE = _p("SKILLS_FILE", "data/skills.yaml")
DEMO_FILE = _p("DEMO_FILE", "data/students_demo.json")
STRICT_MISSING = os.environ.get("STRICT_MISSING") == "1"

# Группы эндпоинтов, которые дожны быть в контракте (smoke.sh гоняет их же).
ENDPOINT_GROUPS = [
    ("health", ("health", "healthz", "ping", "livez")),
    ("recommend", ("recommend", "recommendation", "career", "suggest")),
    ("plan", ("plan", "roadmap")),
    ("chat", ("chat", "ask", "assistant", "conversation", "consult")),
]
HTTP_METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}

# Фолбэк, если roles.schema.json ещё не в репозитории (совпадает с текущей схемой).
DEFAULT_REQUIRED = (
    "id",
    "title",
    "description",
    "skills_required",
    "related_specialties",
    "development_steps",
    "partner_companies",
    "resources",
)
MIN_ITEMS_FIELDS = {"skills_required": 1, "development_steps": 1, "resources": 1}
SKILL_ENTRY_ID_KEYS = ("id", "skill", "skill_id", "name")
ROLE_ID_ENV_STRICT = os.environ.get("ROLE_ENUM_STRICT") == "1"


# ---------------------------------------------------------------- вывод ------


class Report:
    def __init__(self):
        self.ok = self.warn = self.skip = self.fail = 0

    def _emit(self, tag, msg):
        print("  [%s] %s" % (tag, msg))

    def good(self, msg):
        self.ok += 1
        self._emit(" OK ", msg)

    def warning(self, msg):
        self.warn += 1
        self._emit("WARN", msg)

    def skipped(self, msg):
        self.skip += 1
        self._emit("SKIP", msg)

    def failed(self, msg):
        self.fail += 1
        self._emit("FAIL", msg)

    def missing(self, what, path, hint=""):
        text = "%s: %s — файл/каталог отсутствует" % (what, path)
        if hint:
            text += " (%s)" % hint
        if STRICT_MISSING:
            self.failed(text + " [STRICT_MISSING=1]")
        else:
            self.skipped(text + "; CI зелёный, пока контракт не приземлился")


REPORT = Report()


def section(title):
    print("\n== %s ==" % title)


# ------------------------------------------------ фолбэк-YAML-парсер ---------
# Нужен, если PyYAML не установлен (в CI бывает). Покрывает подмножество,
# которого хватает контрактным файлам проекта: вложенные маппы, последовательности
# (в том числе «- key: value» с продолжением), flow-последовательности [a, b],
# flow-маппы {a: b}, блочные скаляры | и >, кавычки, комментарии, ---/'...'.
# Всё экзотическое (anchors &a, aliases *a, теги !!x, многострочные plain-
# скаляры) — явная ошибка с номером строки и подсказкой поставить PyYAML.


class YamlError(Exception):
    pass


_BLOCK_SCALAR_RE = re.compile(r"^([|>])([+-]?)$")


def _fallback_load(text):
    lines = []
    for ln, raw in enumerate(text.splitlines(), 1):
        if not raw.strip():
            continue
        stripped = raw.strip()
        if stripped.startswith("#"):
            continue
        if stripped in ("---", "..."):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        if "\t" in raw[:indent]:
            raise YamlError("строка %d: табуляция в отступе не поддерживается" % ln)
        lines.append([indent, raw[indent:], ln])
    if not lines:
        return None
    obj, pos = _parse_block(lines, 0, lines[0][0])
    if pos != len(lines):
        ind, content, ln = lines[pos]
        raise YamlError("строка %d: неожиданное содержимое %r" % (ln, content))
    return obj


def _parse_block(lines, pos, indent):
    ind, content, _ = lines[pos]
    if content == "-" or content.startswith("- "):
        return _parse_seq(lines, pos, indent)
    return _parse_map(lines, pos, indent)


def _parse_map(lines, pos, indent):
    result = {}
    while pos < len(lines):
        ind, content, ln = lines[pos]
        if ind < indent:
            break
        if ind > indent:
            raise YamlError("строка %d: неожиданный отступ" % ln)
        if content == "-" or content.startswith("- "):
            break
        key, rest = _split_key(content, ln)
        pos += 1
        if rest == "":
            if pos < len(lines) and lines[pos][0] > indent:
                child, pos = _parse_block(lines, pos, lines[pos][0])
            elif (
                pos < len(lines)
                and lines[pos][0] == indent
                and (lines[pos][1] == "-" or lines[pos][1].startswith("- "))
            ):
                child, pos = _parse_seq(lines, pos, indent)
            else:
                child = None
        else:
            m = _BLOCK_SCALAR_RE.match(rest)
            if m:
                child, pos = _parse_block_scalar(
                    lines, pos, indent, m.group(1), m.group(2)
                )
            else:
                child = _parse_scalar(rest, ln)
        result[key] = child  # дубликаты ключей: побеждает последний (как в PyYAML)
    return result, pos


def _parse_seq(lines, pos, indent):
    seq = []
    while pos < len(lines):
        ind, content, ln = lines[pos]
        if ind < indent:
            break
        if ind > indent:
            raise YamlError("строка %d: неожиданный отступ" % ln)
        if not (content == "-" or content.startswith("- ")):
            break
        after = content[1:].lstrip()
        item_col = ind + (len(content) - len(after))
        if after == "":
            pos += 1
            if pos < len(lines) and lines[pos][0] > ind:
                child, pos = _parse_block(lines, pos, lines[pos][0])
            else:
                child = None
            seq.append(child)
            continue
        kv = None
        if after[0] not in "{[":
            kv = _try_split_key(after)
        if kv is None:
            if after[0] in "&*!":
                raise YamlError(
                    "строка %d: anchor/alias/tag %r не поддерживается "
                    "fallback-парсером — поставьте PyYAML" % (ln, after)
                )
            seq.append(_parse_scalar(after, ln))
            pos += 1
        else:
            # «- key: value» + продолжение тех же отступов — маппа внутри элемента
            lines[pos] = [item_col, after, ln]
            child, pos = _parse_map(lines, pos, item_col)
            seq.append(child)
    return seq, pos


def _parse_block_scalar(lines, pos, parent_indent, style, chomp):
    body = []
    block_indent = None
    while pos < len(lines):
        ind, content, _ = lines[pos]
        if ind <= parent_indent:
            break
        if block_indent is None:
            block_indent = ind
        if ind < block_indent:
            break
        body.append(content)
        pos += 1
    if style == "|":
        text = "\n".join(body)
    else:
        text = ""
        prev_blank = False
        for i, b in enumerate(body):
            if b.strip() == "":
                text += "\n"
                prev_blank = True
            else:
                if i > 0 and not prev_blank:
                    text += " "
                text += b
                prev_blank = False
    if not body:
        return "", pos
    if chomp == "-":
        text = text.rstrip("\n")
    elif chomp != "+":
        text = text.rstrip("\n") + "\n"
    return text, pos


def _split_key(content, ln):
    quote = None
    for i, ch in enumerate(content):
        if quote:
            if ch == quote:
                quote = None
            continue
        if ch in "\"'":
            quote = ch
            continue
        if ch == "#" and i > 0 and content[i - 1] in " \t":
            break
        if ch == ":" and (i + 1 == len(content) or content[i + 1] in " \t"):
            key = _strip_quotes(content[:i].strip())
            return key, content[i + 1 :].strip()
    raise YamlError(
        "строка %d: ожидалась пара «ключ: значение», получено %r" % (ln, content)
    )


def _try_split_key(content):
    if content[:1] in ("{", "["):
        return None  # flow-коллекция — не пара «ключ: значение»
    try:
        return _split_key(content, 0)
    except YamlError:
        return None


def _strip_quotes(s):
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        return s[1:-1]
    return s


def _strip_comment(text):
    quote = None
    for i, ch in enumerate(text):
        if quote:
            if ch == quote:
                quote = None
            continue
        if ch in "\"'":
            quote = ch
            continue
        if ch == "#" and (i == 0 or text[i - 1] in " \t"):
            return text[:i]
    return text


def _parse_scalar(text, ln):
    text = _strip_comment(text).strip()
    if text == "":
        return None
    if text[0] in "\"'":
        q = text[0]
        buf = []
        i = 1
        while i < len(text):
            ch = text[i]
            if q == "'" and ch == "'":
                if i + 1 < len(text) and text[i + 1] == "'":
                    buf.append("'")
                    i += 2
                    continue
                break
            if q == '"' and ch == "\\" and i + 1 < len(text):
                nxt = text[i + 1]
                buf.append({"n": "\n", "t": "\t"}.get(nxt, nxt))
                i += 2
                continue
            if ch == q:
                break
            buf.append(ch)
            i += 1
        if i >= len(text):
            raise YamlError("строка %d: незакрытая кавычка" % ln)
        return "".join(buf)
    if text.startswith("["):
        return _parse_flow_seq(text, ln)
    if text.startswith("{"):
        return _parse_flow_map(text, ln)
    low = text.lower()
    if low in ("null", "~"):
        return None
    if low == "true":
        return True
    if low == "false":
        return False
    if text[0] in "&*!":
        raise YamlError(
            "строка %d: anchor/alias/tag %r не поддерживается "
            "fallback-парсером — поставьте PyYAML" % (ln, text)
        )
    try:
        return int(text)
    except ValueError:
        pass
    try:
        return float(text)
    except ValueError:
        pass
    return text


def _split_flow(text):
    parts, buf, depth, quote = [], [], 0, None
    for ch in text:
        if quote:
            buf.append(ch)
            if ch == quote:
                quote = None
            continue
        if ch in "\"'":
            quote = ch
            buf.append(ch)
            continue
        if ch in "[{(":
            depth += 1
        elif ch in "]})":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append("".join(buf))
            buf = []
            continue
        buf.append(ch)
    if "".join(buf).strip():
        parts.append("".join(buf))
    return parts


def _parse_flow_seq(text, ln):
    t = text.strip()
    if not (t.startswith("[") and t.endswith("]")):
        raise YamlError(
            "строка %d: несбалансированная flow-последовательность %r" % (ln, t)
        )
    return [_parse_scalar(p, ln) for p in _split_flow(t[1:-1])]


def _parse_flow_map(text, ln):
    t = text.strip()
    if not (t.startswith("{") and t.endswith("}")):
        raise YamlError("строка %d: несбалансированная flow-маппа %r" % (ln, t))
    out = {}
    for part in _split_flow(t[1:-1]):
        kv = _try_split_key(part.strip())
        if kv is None:
            raise YamlError(
                "строка %d: элемент flow-маппы без «:» — %r" % (ln, part.strip())
            )
        k, v = kv
        out[k] = _parse_scalar(v, ln) if v else None
    return out


def load_yaml(path):
    """Вернёт (документ, движок). Движок: 'pyyaml' или 'fallback'."""
    data = path.read_text(encoding="utf-8-sig")
    try:
        import yaml  # noqa: WPS433 (опциональная зависимость)
    except ImportError:
        return _fallback_load(data), "fallback"
    try:
        return yaml.safe_load(data), "pyyaml"
    except Exception as exc:
        raise YamlError(str(exc))


# ------------------------------------------------------- 1. openapi.yaml -----


def _has_2xx(responses):
    if not isinstance(responses, dict):
        return False
    for key in responses:
        ks = str(key).strip().strip("'\"")
        if ks.isdigit() and 200 <= int(ks) < 300:
            return True
    return False


def check_openapi():
    section("openapi.yaml: парсинг и 4 эндпоинта")
    if not OPENAPI_FILE.is_file():
        REPORT.missing("openapi.yaml", OPENAPI_FILE, "mimo")
        return
    try:
        doc, engine = load_yaml(OPENAPI_FILE)
    except YamlError as exc:
        REPORT.failed("openapi.yaml: %s" % exc)
        return
    except OSError as exc:
        REPORT.failed("openapi.yaml: не читается: %s" % exc)
        return
    if not isinstance(doc, dict):
        REPORT.failed(
            "openapi.yaml: корневой узел не mapping (получили %s)" % type(doc).__name__
        )
        return
    REPORT.good("openapi.yaml: парсинг ок (движок: %s)" % engine)

    version = doc.get("openapi") or doc.get("swagger")
    if version is None:
        REPORT.warning("openapi.yaml: нет поля openapi/swagger")
    elif not str(version).startswith("3"):
        REPORT.warning(
            "openapi.yaml: версия %s не 3.x — проверьте совместимость" % version
        )

    info = doc.get("info")
    if isinstance(info, dict):
        if not info.get("title") or not info.get("version"):
            REPORT.warning("openapi.yaml: в info нет title/version")
    else:
        REPORT.warning("openapi.yaml: нет секции info")

    paths = doc.get("paths")
    if not isinstance(paths, dict) or not paths:
        REPORT.failed(
            "openapi.yaml: секция paths отсутствует или пуста — эндпоинтов нет"
        )
        return

    matched_all = set()
    for group, needles in ENDPOINT_GROUPS:
        hits = [p for p in paths if any(n in p.lower() for n in needles)]
        if not hits:
            REPORT.failed(
                "openapi.yaml: эндпоинт группы %r не найден (искали подстроки %s "
                "в %d путях: %s)"
                % (group, list(needles), len(paths), ", ".join(sorted(paths)))
            )
            continue
        for p in sorted(hits):
            matched_all.add(p)
            ops = paths[p]
            if not isinstance(ops, dict):
                REPORT.failed("openapi.yaml: %s — ожидался mapping операций" % p)
                continue
            methods = sorted(
                k.upper()
                for k in ops
                if isinstance(k, str) and k.lower() in HTTP_METHODS
            )
            if not methods:
                REPORT.failed("openapi.yaml: %s — нет ни одной HTTP-операции" % p)
                continue
            bad_resp = [
                m
                for m in methods
                if not _has_2xx((ops.get(m.lower()) or {}).get("responses"))
            ]
            if bad_resp:
                REPORT.failed(
                    "openapi.yaml: %s %s — нет 2xx-ответа в responses"
                    % (p, "/".join(bad_resp))
                )
            else:
                REPORT.good(
                    "openapi.yaml: %s %s [%s] — операция и 2xx на месте"
                    % (p, "/".join(methods), group)
                )

    extra = [p for p in paths if p not in matched_all]
    if extra:
        REPORT.good(
            "openapi.yaml: доп. пути вне 4 целевых групп: %s" % ", ".join(sorted(extra))
        )


# --------------------------------------------------------- 2. data/roles -----


def _load_role_schema():
    if not ROLES_SCHEMA.is_file():
        return list(DEFAULT_REQUIRED), None
    try:
        schema = json.loads(ROLES_SCHEMA.read_text(encoding="utf-8-sig"))
    except Exception as exc:
        REPORT.warning(
            "roles.schema.json: не парсится (%s) — беру встроенный "
            "список обязательных полей" % exc
        )
        return list(DEFAULT_REQUIRED), None
    required = schema.get("required")
    if not isinstance(required, list) or not required:
        return list(DEFAULT_REQUIRED), None
    enum = None
    props = schema.get("properties")
    if isinstance(props, dict) and isinstance(props.get("id"), dict):
        e = props["id"].get("enum")
        if isinstance(e, list):
            enum = [str(x) for x in e]
    return [str(x) for x in required], enum


def _normalize_roles(doc, path):
    if isinstance(doc, dict):
        roles = doc.get("roles")
        if isinstance(roles, list):
            return roles
        if "roles" in doc and not isinstance(roles, list):
            raise YamlError("%s: ключ roles не список" % path.name)
        return [doc]
    if isinstance(doc, list):
        return doc
    raise YamlError("%s: корневой узел не mapping со полями роли" % path.name)


def _entry_skill_id(entry):
    if isinstance(entry, str):
        return entry.strip() or None
    if isinstance(entry, dict):
        for key in SKILL_ENTRY_ID_KEYS:
            val = entry.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
    return None


def _extract_skill_ids(doc):
    ids = set()

    def from_list(items):
        for it in items:
            sid = _entry_skill_id(it)
            if sid:
                ids.add(sid)

    def from_map(mapping):
        for k, v in mapping.items():
            if isinstance(k, str) and k.strip():
                ids.add(k.strip())

    if isinstance(doc, dict):
        bucket = None
        for key in ("skills", "skill_ids", "catalog", "dictionary"):
            if isinstance(doc.get(key), (list, dict)):
                bucket = doc[key]
                break
        if isinstance(bucket, list):
            from_list(bucket)
        elif isinstance(bucket, dict):
            from_map(bucket)
        elif not bucket and all(
            isinstance(v, (dict, type(None))) for v in doc.values()
        ):
            from_map(doc)  # плоский словарь {python: {...}, ...}
    elif isinstance(doc, list):
        from_list(doc)
    return ids


def check_roles():
    section("data/roles: парсинг, обязательные поля, навыки из skills.yaml")
    if not ROLES_DIR.is_dir():
        REPORT.missing("data/roles", ROLES_DIR, "longcat")
        return

    files = sorted(set(ROLES_DIR.glob("*.yaml")) | set(ROLES_DIR.glob("*.yml")))
    if not files:
        jsons = sorted(ROLES_DIR.glob("*.json"))
        if jsons:
            REPORT.warning(
                "data/roles: YAML-файлов нет, но есть %d JSON (%s). "
                "README описывает роли как JSON — yaml-контракт не приземлился"
                % (len(jsons), ", ".join(j.name for j in jsons[:5]))
            )
        REPORT.missing("data/roles/*.yaml", ROLES_DIR, "longcat")
        return

    catalog = None
    if SKILLS_FILE.is_file():
        try:
            sdoc, _ = load_yaml(SKILLS_FILE)
        except YamlError as exc:
            REPORT.failed("skills.yaml: %s" % exc)
        else:
            catalog = _extract_skill_ids(sdoc)
            if catalog:
                REPORT.good("skills.yaml: %d навыков в закрытом словаре" % len(catalog))
            else:
                REPORT.warning(
                    "skills.yaml: не удалось извлечь id навыков "
                    "(неизвестная форма) — сверка навыков ролей пропущена"
                )
                catalog = (
                    None  # пустой словарь ≠ закрытый пустой словарь: роли не фейлим
                )
    else:
        REPORT.skipped(
            "skills.yaml: %s — файл отсутствует; сверка id навыков "
            "пропущена, остальные проверки ролей выполняются" % SKILLS_FILE
        )

    required, role_enum = _load_role_schema()
    seen = {}
    for path in files:
        label = path.name
        try:
            doc, _ = load_yaml(path)
        except YamlError as exc:
            REPORT.failed("%s: %s" % (label, exc))
            continue
        if doc is None:
            REPORT.failed("%s: пустой документ" % label)
            continue
        try:
            roles = _normalize_roles(doc, path)
        except YamlError as exc:
            REPORT.failed("%s: %s" % (label, exc))
            continue

        local_ids = []
        for idx, role in enumerate(roles, 1):
            if not isinstance(role, dict):
                REPORT.failed(
                    "%s: роль #%d не mapping (%s)" % (label, idx, type(role).__name__)
                )
                continue
            missing = [f for f in required if role.get(f) is None]
            if missing:
                REPORT.failed(
                    "%s: роль #%d (%r) — нет обязательных полей: %s"
                    % (label, idx, role.get("id"), ", ".join(missing))
                )
            for field, min_items in MIN_ITEMS_FIELDS.items():
                val = role.get(field)
                if isinstance(val, list) and len(val) < min_items:
                    REPORT.warning(
                        "%s: роль #%d (%r) — %s должен содержать ≥%d элементов"
                        % (label, idx, role.get("id"), field, min_items)
                    )
            rid = role.get("id")
            if not isinstance(rid, str) or not rid.strip():
                REPORT.failed(
                    "%s: роль #%d — поле id не непустая строка" % (label, idx)
                )
                continue
            rid = rid.strip()
            if rid in seen:
                REPORT.failed(
                    "%s: дубликат id роли %r (уже объявлен в %s)"
                    % (label, rid, seen[rid])
                )
            seen[rid] = label
            local_ids.append(rid)
            if role_enum is not None and rid not in role_enum:
                msg = "%s: id роли %r вне enum схемы %s" % (label, rid, role_enum)
                if ROLE_ID_ENV_STRICT:
                    REPORT.failed(msg + " [ROLE_ENUM_STRICT=1]")
                else:
                    REPORT.warning(msg)

            skills = role.get("skills_required")
            if skills is None:
                skills = role.get("skills")
                if skills is not None:
                    REPORT.warning(
                        "%s: роль %r — использовано нестандартное поле "
                        "skills вместо skills_required" % (label, rid)
                    )
            if skills is None:
                continue
            if not isinstance(skills, list):
                REPORT.failed("%s: роль %r — skills_required не список" % (label, rid))
                continue
            skill_ids = []
            for entry in skills:
                sid = _entry_skill_id(entry)
                if sid is None:
                    REPORT.failed(
                        "%s: роль %r — элемент навыка без распознаваемого "
                        "id: %r" % (label, rid, entry)
                    )
                    continue
                skill_ids.append(sid)
                if isinstance(entry, dict) and "weight" in entry:
                    w = entry.get("weight")
                    if not isinstance(w, (int, float)) or isinstance(w, bool):
                        REPORT.warning(
                            "%s: роль %r — weight навыка %r не число: %r"
                            % (label, rid, sid, w)
                        )
                    elif not (0 <= w <= 1):
                        REPORT.warning(
                            "%s: роль %r — weight навыка %r вне [0,1]: %r"
                            % (label, rid, sid, w)
                        )
            if catalog is not None and skill_ids:
                unknown = [s for s in skill_ids if s not in catalog]
                if unknown:
                    REPORT.failed(
                        "%s: роль %r — навыки вне словаря skills.yaml: %s"
                        % (label, rid, ", ".join(sorted(set(unknown))))
                    )
        REPORT.good(
            "%s: %d роль(ей): %s" % (label, len(local_ids), ", ".join(local_ids) or "—")
        )


# -------------------------------------------------- 3. students_demo.json ----


def _students_of(doc):
    if isinstance(doc, list):
        return [s for s in doc if isinstance(s, dict)]
    if isinstance(doc, dict):
        val = doc.get("students")
        if isinstance(val, list):
            return [s for s in val if isinstance(s, dict)]
        if isinstance(val, dict):
            return [s for s in val.values() if isinstance(s, dict)]
        return [doc]
    return []


def _profile_of(student):
    profile = student.get("profile")
    return profile if isinstance(profile, dict) else student


def _is_empty_profile(student):
    profile = _profile_of(student)
    if profile == {}:
        return True
    skills = profile.get("skills")
    if skills is None:
        return True
    return isinstance(skills, list) and len(skills) == 0


def check_demo():
    section("students_demo.json: парсинг и пустой профиль")
    if not DEMO_FILE.is_file():
        REPORT.missing("students_demo.json", DEMO_FILE, "longcat")
        return
    try:
        doc = json.loads(DEMO_FILE.read_text(encoding="utf-8-sig"))
    except Exception as exc:
        REPORT.failed("students_demo.json: не парсится: %s" % exc)
        return
    students = _students_of(doc)
    if not students:
        REPORT.failed("students_demo.json: не найдено ни одного студента")
        return
    empties = [s for s in students if _is_empty_profile(s)]
    if not empties:
        REPORT.failed(
            "students_demo.json: нет студента с пустым профилем "
            "(ожидаем skills: [] или отсутствие skills) — "
            "демо холодного старта невозможно"
        )
        return
    labels = [
        str(s.get("id") or s.get("user_id") or "#%d" % i)
        for i, s in enumerate(empties, 1)
    ]
    REPORT.good(
        "students_demo.json: %d студент(ов), пустой профиль у: %s"
        % (len(students), ", ".join(labels))
    )
    no_id = [
        i for i, s in enumerate(students, 1) if not s.get("id") and not s.get("user_id")
    ]
    if no_id:
        REPORT.warning(
            "students_demo.json: у студентов #%s нет id/user_id"
            % ", #".join(str(i) for i in no_id)
        )


# ------------------------------------------------------------------ main -----


def main():
    print("== contract_check: Карьерный трекер (офлайн, без сервера) ==")
    checks = (
        ("openapi", check_openapi),
        ("roles", check_roles),
        ("demo", check_demo),
    )
    for name, fn in checks:
        try:
            fn()
        except Exception as exc:  # контракт-чек не должен падать без диагноза
            REPORT.failed("%s: необработанное исключение: %r" % (name, exc))
    print(
        "\n--- итог: ok=%d warn=%d skip=%d fail=%d ---"
        % (REPORT.ok, REPORT.warn, REPORT.skip, REPORT.fail)
    )
    if REPORT.fail:
        print("VERDICT: FAIL — контракт нарушен")
        return 1
    print("VERDICT: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
