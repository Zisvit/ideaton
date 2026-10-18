# API карьерного трекера (FastAPI + uvicorn). Сборка из корня репозитория
# (контекст = корень, иначе data/roles недоступен COPY):
#   docker compose -f infra/docker-compose.yml build api
FROM python:3.12-slim

WORKDIR /app

COPY services/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/api/*.py .

# v7: закрытая база 26 направлений едет в образ; ROLES_DIR указывает на неё,
# иначе main.py берёт встроенный дефолт (5 ролей) и стенд теряет специальности.
COPY data/roles /app/data/roles

# Значения по умолчанию безопасны: LLM выключен, ключ не нужен.
ENV PORT=8000 \
    LLM_ENABLED=false \
    ROLES_DIR=/app/data/roles

EXPOSE 8000

# PORT читаем из окружения контейнера (compose может переопределить).
CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
