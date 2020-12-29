#!/bin/bash
# set -x
set -euo pipefail
IFS=$'\n\t'

REMARK_API_FORK="/app/node_modules/remarkable-typescript-dave/"
if [ ! -d "$REMARK_API_FORK" ]; then
  cd "$REMARK_API_FORK"
  yarn install
fi
if [ ! -f "$REMARK_API_FORK"dist/src/remarkable.js ]; then
  cd "$REMARK_API_FORK"
  npx tsc
  cp ./package.json dist/
fi

if [ ! -f /app/bin/redis-server ]; then
  mkdir -p /app/.data/var/run/
  mkdir -p /app/bin

  cd /tmp
  wget http://download.redis.io/redis-stable.tar.gz
  tar xvzf redis-stable.tar.gz
  cd redis-stable
  nice make PREFIX=/app install
fi

python3 -m rmrl --version || pip3 install rmrl

# cd ~
# pnpm install --reporter silent --prefer-offline --audit false
# npm run-script run --silent
