#!/bin/bash
set -e
export CI=true
pnpm install --no-frozen-lockfile
# Only push DB schema if the db workspace package exists
if pnpm list --filter db 2>/dev/null | grep -q "^db"; then
  pnpm --filter db push
fi
