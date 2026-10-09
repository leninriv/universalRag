#!/usr/bin/env bash
# Prueba `send-whatsapp`. Uso: INSFORGE_USER_TOKEN=... ./test-send-whatsapp.sh 593998129299 "texto"
# (o INSFORGE_TEST_EMAIL / INSFORGE_TEST_PASSWORD para iniciar sesión).
set -euo pipefail
BASE=https://fkk6yt6n.us-east.insforge.app
TOKEN=${INSFORGE_USER_TOKEN:-}
if [ -z "$TOKEN" ]; then
  TOKEN=$(curl -s -X POST "$BASE/api/auth/sessions" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$INSFORGE_TEST_EMAIL\",\"password\":\"$INSFORGE_TEST_PASSWORD\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
fi
curl -s -w '\n[%{http_code}]\n' -X POST "$BASE/functions/send-whatsapp" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"phone\":\"${1:-593998129299}\",\"text\":\"${2:-Prueba desde Universal RAG}\"}"
