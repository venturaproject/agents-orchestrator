#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${SERV00_SSH_TARGET:-prostiner-serv00}"
FRONTEND_DOMAIN="${SERV00_FRONTEND_DOMAIN:-demo.prostiner.serv00.net}"
BACKEND_DOMAIN="${SERV00_BACKEND_DOMAIN:-api.demo.prostiner.serv00.net}"
FRONTEND_DIR="/usr/home/prostiner/domains/${FRONTEND_DOMAIN}/public_nodejs"
BACKEND_DIR="/usr/home/prostiner/domains/${BACKEND_DOMAIN}/public_nodejs"
API_URL="${NEXT_PUBLIC_BACKEND_URL:-https://${BACKEND_DOMAIN}}"
SSH_ARGS=(-o BatchMode=yes)

if [[ -n "${SERV00_SSH_KEY_FILE:-}" ]]; then
  SSH_ARGS+=(-i "$SERV00_SSH_KEY_FILE" -o IdentitiesOnly=yes)
fi
RSYNC_SSH="ssh ${SSH_ARGS[*]}"

cd "$ROOT"
npm ci --prefix frontend
npm ci --prefix backend
make lint
make test
NEXT_PUBLIC_BACKEND_URL="$API_URL" make build
make build-backend

ssh "${SSH_ARGS[@]}" "$TARGET" \
  "test -d '$FRONTEND_DIR' &&
   test -d '$BACKEND_DIR' &&
   test -s '$BACKEND_DIR/.env.production' &&
   if [ -f '$FRONTEND_DIR/.env.production' ] &&
      grep -Eq '^(DATABASE_URL|AUTH_SECRET|GROQ_API_KEY|NVIDIA_API_KEY|AGENT_WORKSPACE_ROOT|FRONTEND_APP_ROOT|SESSION_COOKIE_DOMAIN)=' '$FRONTEND_DIR/.env.production'; then
     echo 'Remove backend-only settings from the frontend .env.production before deployment.' >&2
     exit 1
   fi &&
   grep -Fqx 'NODE_ENV=production' '$BACKEND_DIR/.env.production' &&
   grep -q '^DATABASE_URL=.' '$BACKEND_DIR/.env.production' &&
   grep -q '^AUTH_SECRET=.' '$BACKEND_DIR/.env.production' &&
   grep -q '^FRONTEND_ORIGIN=https://$FRONTEND_DOMAIN\$' '$BACKEND_DIR/.env.production' &&
   grep -Fqx 'SESSION_COOKIE_DOMAIN=.prostiner.serv00.net' '$BACKEND_DIR/.env.production' &&
   grep -Fqx 'FRONTEND_APP_ROOT=$FRONTEND_DIR' '$BACKEND_DIR/.env.production' &&
   grep -q '^AGENT_WORKSPACE_ROOT=.' '$BACKEND_DIR/.env.production' &&
   grep -Eq '^(GROQ_API_KEY|NVIDIA_API_KEY)=.' '$BACKEND_DIR/.env.production'"

rsync -az \
  --exclude='.env*' \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.next/cache/' \
  --exclude='.agent-workspaces/' \
  --exclude='*.tsbuildinfo' \
  -e "$RSYNC_SSH" \
  frontend/ "$TARGET:$FRONTEND_DIR/"

rsync -az \
  --exclude='.env*' \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='*.tsbuildinfo' \
  -e "$RSYNC_SSH" \
  backend/ "$TARGET:$BACKEND_DIR/"

ssh "${SSH_ARGS[@]}" "$TARGET" \
  "chmod 600 '$BACKEND_DIR/.env.production' &&
   cd '$BACKEND_DIR' &&
   npm ci --omit=dev &&
   devil www restart '$BACKEND_DOMAIN' &&
   for attempt in \$(seq 1 20); do
     if curl --fail --silent --show-error --max-time 5 'https://$BACKEND_DOMAIN/api/health' >/dev/null; then break; fi
     if [ \"\$attempt\" -eq 20 ]; then echo 'NestJS health check failed; frontend was not restarted.' >&2; exit 1; fi
     sleep 3
   done &&
   cd '$FRONTEND_DIR' &&
   npm ci --omit=dev &&
   devil www restart '$FRONTEND_DOMAIN'"

echo "Deployment complete: https://$FRONTEND_DOMAIN (API: https://$BACKEND_DOMAIN)"
