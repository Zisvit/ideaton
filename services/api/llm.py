"""Провайдеры LLM: Protocol + Stub + External (env-driven).

StubProvider — детерминированный черновик без сети. ExternalProvider ходит в
LLM_URL (OpenAI-совместимый /chat/completions или произвольный POST) с
таймаутом 12с и двумя повторами; при любой ошибке молча возвращает черновик —
LLM у нас только перефраз, факты из рубрики он менять не должен.
"""

from __future__ import annotations

import os
from typing import Protocol

import httpx

TIMEOUT_SECONDS = 12.0
RETRIES = 2


class LLMProvider(Protocol):
    """Единый контракт провайдера: перефраз черновика."""

    name: str

    def rephrase(self, draft: str, context: str = "") -> str: ...


class StubProvider:
    """Без LLM: возвращает черновик как есть. name = 'stub'."""

    name = "stub"

    def rephrase(self, draft: str, context: str = "") -> str:
        return draft


class ExternalProvider:
    """Внешний LLM-эндпоинт из env: LLM_URL, LLM_API_KEY, LLM_MODEL."""

    name = "external"

    def __init__(
        self,
        url: str,
        api_key: str = "",
        model: str = "gpt-4o-mini",
        timeout: float = TIMEOUT_SECONDS,
        retries: int = RETRIES,
    ) -> None:
        self._url = url
        self._api_key = api_key
        self._model = model
        self._timeout = timeout
        self._retries = max(0, retries)

    def rephrase(self, draft: str, context: str = "") -> str:
        prompt = (
            "Перефразируй текст, не добавляя новых фактов и не меняя смысл. "
            "Ответ — только перефразированный текст.\n"
            f"Контекст: {context or '—'}\n"
            f"Текст: {draft}"
        )
        payload = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        }
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        for attempt in range(self._retries + 1):
            try:
                resp = httpx.post(
                    self._url, json=payload, headers=headers, timeout=self._timeout
                )
                resp.raise_for_status()
                data = resp.json()
                content = self._extract_text(data)
                if content:
                    return content.strip()
            except (httpx.HTTPError, ValueError, KeyError, TypeError):
                pass
        return draft

    @staticmethod
    def _extract_text(data: object) -> str:
        """Достаёт текст из OpenAI-совместимого или простого {text: ...} ответа."""
        if isinstance(data, dict):
            choices = data.get("choices")
            if isinstance(choices, list) and choices:
                first = choices[0]
                if isinstance(first, dict):
                    message = first.get("message")
                    if isinstance(message, dict) and isinstance(
                        message.get("content"), str
                    ):
                        return message["content"]
                    if isinstance(first.get("text"), str):
                        return first["text"]
            if isinstance(data.get("text"), str):
                return data["text"]
            if isinstance(data.get("content"), str):
                return data["content"]
        return ""


def get_provider() -> LLMProvider:
    """External только при LLM_ENABLED=true И задан LLM_URL, иначе stub."""
    enabled = os.getenv("LLM_ENABLED", "").strip().lower() == "true"
    url = os.getenv("LLM_URL", "").strip()
    if enabled and url:
        return ExternalProvider(
            url=url,
            api_key=os.getenv("LLM_API_KEY", "").strip(),
            model=os.getenv("LLM_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini",
        )
    return StubProvider()
