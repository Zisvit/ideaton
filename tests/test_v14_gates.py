"""Гейты волны v14 (совет 7/9): связка «колледж → студент → работодатели».

Волна v14:
  1) снапшот страниц сайта колледжа (data/college/sielom_specialties.json) —
     verbatim-списки «Где/Кем» на дату + карта правок/переносов (corrections/
     moves); пересъёмка — scripts/refresh_college_snapshot.py; генератор
     кладёт производные в specialties.json (employers/positions/source);
  2) чипы: мёртвые FastAPI/Docker/Kubernetes заменены (их нет ни в одной роли
     и специальности), третий ряд навыков специальностей → покрытие 21/21;
  3) кнопка «Показать мои направления» — выше витрины (сразу под формой);
  4) интерфейс работодателя /employer — каталог 21 направления + фильтр по
     навыкам (только агрегаты учебной базы; офлайн/гость/без API);
  5) кросс-ссылки «Я работодатель» (/) и «Я студент» (/employer) — маршруты.

Статические сканы исходников (как test_v13_gates): читаем TS/TSX/JSON.
"""

import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
ROLES_DIR = ROOT / "data" / "roles"

SNAPSHOT = json.loads(
    (ROOT / "data" / "college" / "sielom_specialties.json").read_text(encoding="utf-8")
)
SPEC_RAW = (WEB / "lib" / "specialties.json").read_text(encoding="utf-8")
SPEC = json.loads(SPEC_RAW)
DATA = json.loads((WEB / "lib" / "offlineData.json").read_text(encoding="utf-8"))


def _strip_comments(text: str) -> str:
    """Комментарии вне скана: гейт смотрит на код, а не на прозу."""
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    text = re.sub(r"^\s*//.*$", "", text, flags=re.M)
    return text


INDEX = _strip_comments((WEB / "pages" / "index.tsx").read_text(encoding="utf-8"))
CARD = _strip_comments(
    (WEB / "components" / "DirectionCard.tsx").read_text(encoding="utf-8")
)
WORK = _strip_comments(
    (WEB / "components" / "CollegeWork.tsx").read_text(encoding="utf-8")
)
EMPLOYER = _strip_comments((WEB / "pages" / "employer.tsx").read_text(encoding="utf-8"))
RESULT = _strip_comments((WEB / "pages" / "result.tsx").read_text(encoding="utf-8"))
GROUPS = _strip_comments(
    (WEB / "components" / "DirectionGroups.tsx").read_text(encoding="utf-8")
)
CSS = (WEB / "styles" / "globals.css").read_text(encoding="utf-8")

SPEC_IDS = [r["id"] for r in DATA["roles"] if r.get("kind") == "specialty"]
SPEC_SKILLS = {
    r["id"]: [s["id"] for s in r["skills_required"]]
    for r in DATA["roles"]
    if r.get("kind") == "specialty"
}

CATALOG = yaml.safe_load((ROLES_DIR / "skills.yaml").read_text(encoding="utf-8"))[
    "skills"
]
FORMS: dict[str, str] = {}
for _sid, _meta in CATALOG.items():
    for _form in [_sid, _meta.get("name", ""), *(_meta.get("synonyms") or [])]:
        FORMS[str(_form).strip().lower().replace("ё", "е")] = str(_sid)


def _norm(text: str) -> str:
    return str(text).strip().lower().replace("ё", "е")


def _arr(src: str, name: str) -> list[str]:
    m = re.search(r"const " + name + r" = \[([^\]]*)\]", src)
    assert m, f"нет массива {name}"
    return re.findall(r"'([^']+)'", m.group(1))


# --------------------------------------------------------------- снапшот сайта
def test_snapshot_covers_all_specialties_with_date():
    assert SNAPSHOT["site"] == "https://sielom.ru"
    # дата съёмки — формат без привязки к дню: пересъёмка скриптом не ломает гейт
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", SNAPSHOT["fetched"])
    pages = SNAPSHOT["specialties"]
    assert len(pages) == 21
    assert set(pages) == set(SPEC_IDS)
    for sid, page in pages.items():
        assert page["slug"] and page["url"].endswith("/" + page["slug"]), sid
        assert page["url"].startswith("https://sielom.ru/specialties/"), sid
        assert page["site_title"].strip(), sid
        assert isinstance(page["work_places"], list), sid
        assert isinstance(page["works"], list), sid


def test_snapshot_data_not_empty_at_date():
    """«Не опустеет»: порог вместо точных чисел — пересъёмка не требует правок.

    На дату снимка «Где» непусто у 14/21 страниц, «Кем» — у 19/21: пустота
    честная (у части направлений блоков на сайте нет). Порог ловит массовое
    обнуление источника или поломку парсинга, не мешая плановой пересъёмке.
    """
    pages = SNAPSHOT["specialties"]
    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        import gen_web_data  # noqa: PLC0415 — модуль лежит в scripts/

        corr = SNAPSHOT["corrections"]
        moves = SNAPSHOT["moves"]
        emp = {
            sid
            for sid, page in pages.items()
            if gen_web_data.college_lists(page, corr, moves)[0]
        }
        pos = {
            sid
            for sid, page in pages.items()
            if gen_web_data.college_lists(page, corr, moves)[1]
        }
    finally:
        sys.path.pop(0)
    assert len(emp) >= 10, sorted(set(pages) - emp)
    assert len(pos) >= 15, sorted(set(pages) - pos)


def test_specialties_lockstep_with_snapshot():
    """specialties.json — производная снимка: правки, дедуп, source (без дрейфа)."""
    pages = SNAPSHOT["specialties"]
    source = f"sielom.ru ({SNAPSHOT['fetched']})"
    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        import gen_web_data  # noqa: PLC0415

        corr = SNAPSHOT["corrections"]
        moves = SNAPSHOT["moves"]
        for item in SPEC:
            page = pages[item["id"]]
            employers, positions = gen_web_data.college_lists(page, corr, moves)
            assert item["employers"] == employers, item["id"]
            assert item["positions"] == positions, item["id"]
            assert item["source"] == source, item["id"]
            for name in item["employers"] + item["positions"]:
                assert isinstance(name, str) and name == name.strip() and name, (
                    item["id"],
                    name,
                )
    finally:
        sys.path.pop(0)
    by_id = {i["id"]: i for i in SPEC}
    # verbatim остаётся в снимке; вычищенное — только в specialties.json
    assert "Школы искуств" in pages["preschool"]["work_places"]
    raw_blob = json.dumps(pages, ensure_ascii=False)
    for wrong in SNAPSHOT["corrections"]:
        assert wrong in raw_blob, f"правка без источника: {wrong!r}"
    assert "Школы искуств" not in SPEC_RAW and "Типоргафии" not in SPEC_RAW
    assert "агенства" not in SPEC_RAW and "басейн" not in SPEC_RAW
    assert "Мерчандайзером" not in SPEC_RAW
    assert "Школы искусств" in by_id["preschool"]["employers"]
    assert "Типографии" in by_id["graphic_design"]["employers"]
    assert by_id["design"]["employers"].count("Фриланс") == 1  # дедуп
    # «3D-визуализатор» — профессия, ошибочно попавшая в список мест: переносим
    assert "3D-визуализатор" not in by_id["design"]["employers"]
    assert by_id["design"]["positions"] == ["Дизайнер", "3D-визуализатор"]
    assert by_id["infocom"]["employers"] == ["Любые организации"]  # trim
    assert by_id["software_dev"]["employers"] == []
    assert by_id["software_dev"]["positions"] == []
    assert by_id["trade"]["positions"][0] == "Предприниматель"


def test_snapshot_moves_reclassify_from_raw_source():
    """moves: перенос строки между списками — источник строки остаётся в снимке."""
    moves = SNAPSHOT["moves"]
    assert set(moves.values()) <= {"employers", "positions"}, moves
    assert moves.get("3D-визуализатор") == "positions"
    raw_blob = json.dumps(SNAPSHOT["specialties"], ensure_ascii=False)
    for name in moves:
        assert name in raw_blob, f"перенос без источника: {name!r}"


# ------------------------------------------------------------------- чипы v14
def test_chips_resolve_and_cover_college():
    it = _arr(INDEX, "SKILLS")
    life = _arr(INDEX, "SKILLS_LIFE")
    spec_row = _arr(INDEX, "SKILLS_SPEC")
    # мёртвые чипы (нет ни в одной роли/специальности) заменены
    for dead in ("FastAPI", "Docker", "Kubernetes"):
        assert dead not in it, dead
        assert dead not in life and dead not in spec_row
    assert it == [
        "Python",
        "JavaScript",
        "TypeScript",
        "React",
        "Node.js",
        "Git",
        "HTML",
        "CSS",
    ]
    # каждый чип резолвится в навык из data/roles/skills.yaml (после lowercase)
    resolved: dict[str, str] = {}
    for chip in it + life + spec_row:
        sid = FORMS.get(_norm(chip))
        assert sid, f"чип без навыка в skills.yaml: {chip!r}"
        resolved[chip] = sid
    # третий ряд — ровно 8 навыков специальностей, у каждого есть своё направление
    assert spec_row == [
        "Банковские продукты",
        "Услуги красоты",
        "Графические редакторы",
        "Инфокоммуникационные системы",
        "Судебное делопроизводство",
        "Лекарственные средства",
        "Тренировочный процесс",
        "Социальная помощь",
    ]
    for chip in spec_row:
        hits = [rid for rid, skills in SPEC_SKILLS.items() if resolved[chip] in skills]
        assert hits, f"чип {chip!r} не связан ни с одним направлением колледжа"
    # витрина: каждое из 21 направления покрыто хотя бы одним чипом
    covered = set(resolved.values())
    for rid, skills in SPEC_SKILLS.items():
        assert covered & set(skills), f"направление {rid} без своего чипа"
    # fillExample подсвечивает чипами все три ряда
    assert "[...SKILLS, ...SKILLS_LIFE, ...SKILLS_SPEC]" in INDEX


# ------------------------------------------------- кнопка выше витрины (п.3)
def test_cta_above_showcase():
    assert INDEX.index('id="skills-text"') < INDEX.index("cta-sticky")
    assert INDEX.index("cta-sticky") < INDEX.index("spec-section")
    # v15: витрину рендерит общий DirectionGroups (секции-группы по данным)
    assert "DirectionGroups" in INDEX and "specs={SPECS}" in INDEX


# --------------------------------------------------- интерфейс работодателя
def test_direction_card_shared_between_pages():
    # v15: обе страницы идут через общий DirectionGroups → DirectionCard
    assert "DirectionGroups" in INDEX and "DirectionGroups" in EMPLOYER
    assert "DirectionCard" in GROUPS
    assert "CollegeWork" in CARD
    assert "spec-item" in CARD and "spec-skill" in CARD
    for src in (CARD, WORK, GROUPS):
        assert "Math.random" not in src
        assert "offlineData" not in src and "localEngine" not in src
        assert "localStorage" not in src


def test_employer_interface_is_offline_guest_safe():
    assert "import specialties from '../lib/specialties.json'" in EMPLOYER
    for banned in (
        "offlineData",
        "localEngine",
        "from '../lib/api'",
        "localStorage",
        "fetch(",
        "Math.random",
    ):
        assert banned not in EMPLOYER, f"в /employer не должно быть {banned!r}"
    # фильтр: дедуп по id, детерминированный порядок −count, затем id
    assert "new Map<string, SkillOption>()" in EMPLOYER
    assert "b.count - a.count" in EMPLOYER
    # пустой выбор → все 21; совпадение — «И»-логика по всем выбранным навыкам
    assert "selected.size === 0" in EMPLOYER
    assert "Array.from(selected).every(" in EMPLOYER
    assert "aria-pressed={active}" in EMPLOYER
    assert "aria-live" in EMPLOYER and "Сбросить фильтр" in EMPLOYER
    assert "Ничего не найдено" in EMPLOYER


def test_college_work_rules_and_employer_variant():
    # витрина: «Где» приоритетом, «Кем» — усечение до 4 + хвост «и ещё N»
    assert "POSITION_LIMIT = 4" in WORK
    assert "full ? positions : positions.slice(0, POSITION_LIMIT)" in WORK
    assert "и ещё {rest}" in WORK
    assert "Где можно работать" in WORK and "Кем можно работать" in WORK
    assert "return null" in WORK  # нет данных — нет блока (без пустых обещаний)
    # /employer: оба списка целиком (variant=employer → full)
    assert "'showcase' | 'employer'" in CARD
    assert "variant === 'employer'" in CARD
    assert 'variant="employer"' in EMPLOYER


def test_cross_links_are_route_based():
    assert 'href="/employer"' in INDEX and "Я работодатель" in INDEX
    assert 'href="/"' in EMPLOYER and "Я студент" in EMPLOYER
    assert "useRouter" not in INDEX and "useRouter" not in EMPLOYER


def test_result_specialty_work_block():
    assert "from '../components/CollegeWork'" in RESULT
    assert "import specialties from '../lib/specialties.json'" in RESULT
    assert "COLLEGE.get(role.role_id)" in RESULT
    # блок тот же, что на витрине (showcase-правила), скрыт при пустых данных
    assert "CollegeWork" in RESULT
    # v14-доработка: блок и в hero-карточке, и в строках — две точки вывода
    assert "topSpec" in RESULT
    assert RESULT.count("<CollegeWork") == 2
    # hero тёмная: токены блока перекрашены только для экрана — печать чёрная
    assert ".hero-card .spec-work__list li" in CSS
    assert ".hero-card .spec-work__source" in CSS
    assert "@media screen {" in CSS


def test_generator_fails_without_full_coverage():
    src = (ROOT / "scripts" / "gen_web_data.py").read_text(encoding="utf-8")
    assert (
        'COLLEGE_SNAPSHOT = ROOT / "data" / "college" / "sielom_specialties.json"'
        in src
    )
    assert "не покрывает специальности" in src
    assert "clean_college_names" in src
    assert "college_lists" in src


def test_refresh_script_keeps_snapshot_reproducible():
    """Пересъёмка — скриптом репозитория: stdlib, сбой не трогает снимок."""
    src = (ROOT / "scripts" / "refresh_college_snapshot.py").read_text(encoding="utf-8")
    assert "urllib.request" in src
    for banned in ("requests", "bs4", "playwright", "selenium"):
        assert banned not in src, banned
    assert "__NEXT_DATA__" in src
    assert "--check" in src
    assert "sielom_specialties.json" in src
    # «всё-или-ничего»: пишем только после успешной пересъёмки всех страниц
    assert 'updated["fetched"]' in src
    assert "снимок не изменён" in src
    # снимок сам рассказывает, как обновляться
    assert "refresh_college_snapshot.py" in SNAPSHOT["note"]
