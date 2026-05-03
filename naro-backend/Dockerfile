FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /app

COPY pyproject.toml README.md ./
RUN uv pip install --system --no-cache -e ".[dev]"

COPY . .

EXPOSE 8000

# Production default — uvicorn tek worker (Render Starter plan tek instance).
# Worker servisi (ARQ) bu image'i ayrı process olarak çalıştırır:
#   `arq app.workers.settings.WorkerSettings` (render.yaml > naro-worker).
# Local dev için docker-compose `command:` ile --reload override eder.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
