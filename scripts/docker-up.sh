#!/usr/bin/env bash
set -euo pipefail

if [[ ! -s .env.docker ]]; then
  echo "Missing .env.docker. Copy .env.docker.example and set local values first." >&2
  exit 1
fi

COMPOSE=(docker compose --env-file .env.docker -f compose.yml)
APP_PORT="$(sed -n 's/^APP_PORT=//p' .env.docker | tail -n 1)"
APP_PORT="${APP_PORT:-8088}"

"${COMPOSE[@]}" build frontend backend
"${COMPOSE[@]}" up -d postgres
"${COMPOSE[@]}" run --rm backend npm run db:migrate:container
"${COMPOSE[@]}" up -d frontend backend nginx

echo "Crew: http://localhost:${APP_PORT}"
echo "Crew API health: http://localhost:${APP_PORT}/api/health"
