#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
docker compose up --build -d
printf '\nSignFlow is starting: http://localhost:3000\n'
