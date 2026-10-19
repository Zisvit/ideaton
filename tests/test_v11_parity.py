"""Паритет офлайн-движка v11 с настоящим API: TestClient ↔ собранный node-CLI.

Требуется node/npx (CI ставит их до pytest). Локально без node — SKIP.
Сравниваем ответы без profile_hash/cached: hash считает только API (ему это
кэш-ключ), cached — состояние серверного кэша, а не алгоритм.
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"
API_DIR = ROOT / "services" / "api"

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None or shutil.which("npx") is None,
    reason="node/npx недоступны — паритет-тест пропущен",
)

PROFILES = [
    {"skills": ["python", "git"], "interests": [], "subjects": [], "course": 2},
    {
        "skills": ["html", "css", "javascript", "react"],
        "interests": ["erp"],
        "subjects": [],
        "course": 3,
        "specialty": "Информационные системы и технологии",
    },
    {
        "skills": ["accounting", "1c"],
        "interests": ["финансы"],
        "subjects": ["экономика", "налоги"],
        "course": 4,
        "specialty": "Экономика и бухгалтерский учёт (по отраслям)",
    },
    {"skills": [], "interests": [], "subjects": [], "course": 1},
]


@pytest.fixture(scope="module")
def cli(tmp_path_factory):
    """Собирает localEngine+CLI одним tsc-вызовом; возвращает runner(stdin)."""
    out = tmp_path_factory.mktemp("parity")
    proc = subprocess.run(
        [
            "npx",
            "tsc",
            # TS 7: при файлах в командной строке tsconfig не читается —
            # требуем явный флаг (иначе TS5112)
            "--ignoreConfig",
            str(WEB / "scripts" / "parity_cli.ts"),
            "--outDir",
            str(out),
            "--module",
            "node16",
            "--target",
            "ES2019",
            "--moduleResolution",
            "node16",
            "--resolveJsonModule",
            "--esModuleInterop",
            "--skipLibCheck",
        ],
        cwd=WEB,
        capture_output=True,
        text=True,
        timeout=240,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    # tsc не копирует JSON — кладём offlineData.json рядом с localEngine.js
    built_engine = next(out.rglob("localEngine.js"))
    shutil.copy(
        WEB / "lib" / "offlineData.json", built_engine.parent / "offlineData.json"
    )
    cli_js = next(out.rglob("parity_cli.js"))

    def run(payload: dict) -> dict | list | None:
        node_proc = subprocess.run(
            ["node", str(cli_js)],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=60,
            cwd=out,
        )
        assert node_proc.returncode == 0, node_proc.stderr
        return json.loads(node_proc.stdout)

    return run


@pytest.fixture(scope="module")
def client():
    # Паритет считаем на stub-провайдере: внешний LLM в тестах не нужен.
    os.environ.pop("LLM_ENABLED", None)
    os.environ.pop("LLM_URL", None)
    sys.path.insert(0, str(API_DIR))
    try:
        from fastapi.testclient import TestClient  # noqa: PLC0415
        from main import app  # noqa: PLC0415

        return TestClient(app)
    finally:
        sys.path.pop(0)


def _api(client, path: str, payload: dict):
    response = client.post(path, json=payload)
    return response.status_code, response.json()


def _strip(value):
    if isinstance(value, dict):
        return {
            k: _strip(v)
            for k, v in value.items()
            if k not in ("profile_hash", "cached")
        }
    if isinstance(value, list):
        return [_strip(v) for v in value]
    return value


def test_selftest_pyround(cli):
    assert cli({"op": "selftest"})["selftest"]["pyRound"] == [0, 2, 2, 2, 12]


@pytest.mark.parametrize("profile", PROFILES, ids=["python", "web", "finance", "empty"])
def test_recommend_parity(client, cli, profile):
    status, api_data = _api(client, "/recommend", {"profile": profile})
    out = cli({"op": "recommend", "profile": profile})
    assert out["status"] == status
    assert _strip(out["data"]) == _strip(api_data)


@pytest.mark.parametrize("role_id", ["web", "qa", "1c", "support", "startup"])
def test_plan_parity(client, cli, role_id):
    profile = PROFILES[1]
    status, api_data = _api(client, "/plan", {"role_id": role_id, "profile": profile})
    out = cli({"op": "plan", "role_id": role_id, "profile": profile})
    if status != 200:
        assert out is None  # API 404 ↔ движок null
        return
    assert out and out["ok"] is True
    assert _strip(out["data"]) == _strip(api_data)
