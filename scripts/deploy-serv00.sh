#!/usr/bin/env bash
set -euo pipefail

REMOTE=prostiner-serv00
REMOTE_DIR=/usr/home/prostiner/domains/demo.prostiner.serv00.net/public_nodejs
DOMAIN=demo.prostiner.serv00.net

if ! ssh "$REMOTE" "test -s '$REMOTE_DIR/.env.production'"; then
  echo "Missing remote .env.production; provision production secrets before deploying." >&2
  exit 1
fi

npm run build
rsync -az \
  --exclude='.env*' \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.next/cache/' \
  --exclude='.playwright-mcp/' \
  --exclude='supabase/' \
  --exclude='compose.db.yml' \
  --exclude='*.log' \
  ./ "$REMOTE:$REMOTE_DIR/"

ssh "$REMOTE" "cd '$REMOTE_DIR' && npm ci --omit=dev && devil www restart '$DOMAIN'"
echo "Deployment complete: https://$DOMAIN"
