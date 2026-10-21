"""Гейты v21: нормализация лиса после «упоротого» v20.

Совет (7/7, раунды 1–2) назвал три причины: поперечная текстура («вагонка»),
перегруженное лицо (бровь, мешок, линия к морде) и отсутствие шеи/нагрудник
на шее. v21: штрихи вдоль корпуса, текстура снята с головы/ушей, лицо
спокойное, голова +12% статичной обёрткой, нагрудник перенесён на грудь.
"""

from __future__ import annotations

import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FOX = (ROOT / "apps/web/components/IntroScene.tsx").read_text()
SCRIPT = (ROOT / "scripts/gen_fox_fur.py").read_text()
PNG = ROOT / "apps/web/public/fox-fur-128.png"


def _angle_range(name: str) -> tuple[int, int]:
    m = re.search(rf"^{name} = \((-?\d+), (-?\d+)\)$", SCRIPT, flags=re.M)
    assert m, f"в генераторе нет {name}"
    return int(m.group(1)), int(m.group(2))


def test_fur_strokes_go_along_body_not_across() -> None:
    # 0° = вдоль корпуса. v20 рисовал 78..102° (поперёк) — на горизонтальном
    # корпусе это читалось как вагонка. Держим ворс в узком диапазоне.
    for name in ("DARK_ANGLE", "MID_ANGLE", "LIGHT_ANGLE"):
        lo, hi = _angle_range(name)
        assert -20 <= lo <= hi <= 20, f"{name} = {(lo, hi)}° — снова поперёк корпуса"
    assert "DARK_ANGLE = (78, 102)" not in SCRIPT, "вернулись вертикальные штрихи v20"


def test_fur_tile_is_still_baked_png() -> None:
    raw = PNG.read_bytes()
    assert raw[:8] == b"\x89PNG\r\n\x1a\n", "fox-fur-128.png — не PNG"
    w, h = struct.unpack(">II", raw[16:24])
    assert (w, h) == (128, 128), f"плитка должна быть 128×128: {(w, h)}"
    assert raw[25] == 3, "ожидаем палитровый PNG с tRNS"
    assert len(raw) <= 12288, f"PNG > 12KB: {len(raw)}"


def test_texture_only_on_body_and_tail() -> None:
    # Голова/уши — крупные кремовые массы, без растровой сетки: тайл 128u
    # на 49u головы давал пятно, а не волос.
    assert FOX.count("url(#foxFurBody)") == 1, "текстура должна быть только на корпусе"
    assert FOX.count("url(#foxFurTail)") == 1, "текстура должна быть только на хвосте"
    for base in ("foxHeadBase", "foxEarFarBase", "foxEarNearBase"):
        assert f'href="#{base}" fill="url(#foxFur' not in FOX, (
            f"текстура вернулась на {base}"
        )

    body_use = FOX.split('fill="url(#foxFurBody)"', 1)[1][:80]
    tail_use = FOX.split('fill="url(#foxFurTail)"', 1)[1][:80]
    assert 'opacity=".14"' in body_use, "корпус: ожидали opacity .14"
    assert 'opacity=".16"' in tail_use, "хвост: ожидали opacity .16"


def test_face_is_calm_not_derpy() -> None:
    # Бровь, «мешок» и линия глаз→морда давали взгляд «упоротой» (совет).
    assert "fx-brow" not in FOX
    assert "fx-eye-bag" not in FOX
    assert "fx-eye" in FOX
    # Глаз ближе к морде, зрачок — мягкий вертикальный овал, один блик.
    assert 'cx="332" cy="114" rx="6" ry="4.6"' in FOX
    assert 'cx="332.4" cy="114.3" rx="1.6" ry="2.5"' in FOX
    assert FOX.count('<circle cx="330" cy="111.6" r="1.2"') == 1
    # Нос-пуговица 4.3×3.7, а не 5.6×4.6.
    assert 'cx="354" cy="121" rx="4.3" ry="3.7"' in FOX
    # Без нижней кремовой челюсти и воротника: белая щека не смыкается
    # с белой грудью в «шарф».
    assert "M318 140 C326 142 334 140 340 135" not in FOX, "вернулась нижняя челюсть"
    assert "M298 126 C308 130 314 138 313 147" not in FOX, "вернулся воротник"


def test_whiskers_short_and_faint() -> None:
    # Длинные чёрные усы через шею/грудь читались как шов/усы-«мостик».
    assert "M340 132 C334 133 329 135 324 137" in FOX
    assert "M340 132 C332 134 324 137 317 140" not in FOX
    assert "M341 135 C333 139 326 143 320 148" not in FOX
    assert "M339 129 C331 129 323 130 316 132" not in FOX
    whiskers = FOX.split('className="fx-whiskers"', 1)[1][:260]
    assert 'strokeWidth="1.3"' in whiskers and 'opacity=".3"' in whiskers


def test_upper_body_raised_for_longer_legs() -> None:
    # v21: корпус, хвост и голова подняты на 12u одной и той же величиной.
    # Голова поднята ровно на столько же, на сколько корпус, иначе рвётся
    # стык шеи (проверено: раздельный подъём давал «плавающую маску»).
    assert FOX.count('<g transform="translate(0 -12)">') == 2, (
        "нет подъёма корпуса/хвоста"
    )
    assert "translate(354 103) scale(1.12)" in FOX, "голова поднята не на 12u"
    assert "M146 156 C138 180 127 196 121 207" in FOX, "бедро не дотянуто до корпуса"
    assert "M252 152 C254 166 256 181 257 192" in FOX, "переднее бедро не дотянуто"


def test_head_scaled_and_neck_not_a_scarf() -> None:
    # Голова +12% статичной обёрткой вокруг носа; шарниры --ox/--oy
    # остаются в локальных координатах и масштабируются вместе с геометрией.
    wrapper = "translate(354 103) scale(1.12) translate(-354 -121)"
    assert FOX.count(wrapper) == 2, "обёртка головы/дальнего уха потерялась"
    assert "--ox': '300px', '--oy': '134px'" in FOX  # шея головы
    assert "--ox': '332px', '--oy': '114px'" in FOX  # глаз
    # Нагрудник — на груди, внутри контура; кремовый живот — полосой внутри.
    assert "M278 148 C282 152 283 158 281 164" in FOX, "нагрудник не на груди"
    assert "M284 173 C272 172 256 171 240 170" in FOX, "кремовый живот не внутри"
