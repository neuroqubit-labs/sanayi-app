#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.example}"
export POSTGRES_PUBLISHED_PORT="${POSTGRES_PUBLISHED_PORT:-55432}"
export REDIS_PUBLISHED_PORT="${REDIS_PUBLISHED_PORT:-56379}"
export LOCALSTACK_PUBLISHED_PORT="${LOCALSTACK_PUBLISHED_PORT:-54566}"
export API_PUBLISHED_PORT="${API_PUBLISHED_PORT:-58000}"

docker compose --env-file "$ENV_FILE" down --remove-orphans >/dev/null 2>&1 || true

docker compose \
  --env-file "$ENV_FILE" \
  up -d postgres redis localstack worker
docker compose \
  --env-file "$ENV_FILE" \
  run --rm api sh -lc \
  "alembic upgrade head && pytest -q tests/test_health.py tests/test_media_smoke.py"
