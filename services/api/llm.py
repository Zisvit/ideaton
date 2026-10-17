"""Провайдеры LLM: Protocol + Stub + External (env-driven).

StubProvider — детерминированный черновик без сети. ExternalProvider ходит в
LLM_URL (OpenAI-совместимый /chat/completions или произвольный POST) с
таймаутом 12с и двумя повторами; при любой ошибке молча возвращает черновик —
LLM у нас только перефраз, факты из рубрики он менять не должен.
"""

from __future__ import annotations

import logging
import os
from typing import Protocol

import httpx

TIMEOUT_SECONDS = 12.0
RETRIES = 2

log = logging.getLogger("career.llm")
_WARNED_MISSING_URL = False


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
    """External при LLM_ENABLED=true И заданном LLM_URL, иначе stub.

    Fail-soft (совет red-team): включённый, но не настроенный LLM не должен
    ронять сервис молча ИЛИ фейлить весь API перед демо. Логируем ОДНО
    предупреждение и работаем stub'ом — UI показывает честный бейдж режима.
    """
    global _WARNED_MISSING_URL
    enabled_raw = os.getenv("LLM_ENABLED", "").strip().lower()
    enabled = enabled_raw in {"true", "1", "yes", "on"}
    url = os.getenv("LLM_URL", "").strip()
    if enabled and url:
        return ExternalProvider(
            url=url,
            api_key=os.getenv("LLM_API_KEY", "").strip(),
            model=os.getenv("LLM_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini",
        )
    if enabled and not url and not _WARNED_MISSING_URL:
        _WARNED_MISSING_URL = True
        log.warning(
            "LLM_ENABLED=%s, но LLM_URL не задан — консультант работает в "
            "демо-режиме (stub); для живого LLM задай LLM_URL/LLM_API_KEY/LLM_MODEL",
            enabled_raw,
        )
    return StubProvider()
