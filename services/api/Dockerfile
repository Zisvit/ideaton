# API карьерного трекера (FastAPI + uvicorn). Сборка из корня:
#   docker compose -f infra/docker-compose.yml build api
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py .

# Значения по умолчанию безопасны: LLM выключен, ключ не нужен.
ENV PORT=8000 \
    LLM_ENABLED=false

EXPOSE 8000

# PORT читаем из окружения контейнера (compose может переопределить).
CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
