#!/usr/bin/env bash
# Prueba end-to-end del RAG: ingesta el texto de ejemplo y hace una pregunta que está en el texto
# y otra que no. `ingest` y `ask` solo aceptan usuarios con sesión iniciada:
#   INSFORGE_USER_TOKEN=<token> ./insforge/scripts/test-rag.sh
#   INSFORGE_TEST_EMAIL=... INSFORGE_TEST_PASSWORD=... ./insforge/scripts/test-rag.sh
# Las preguntas quedan guardadas en un chat nuevo del usuario.
set -euo pipefail
cd "$(dirname "$0")/../.."

BASE_URL="${INSFORGE_URL:-$(node -p 'require("./.insforge/project.json").oss_host')}"
SAMPLE="insforge/samples/nebula-logistica.txt"

pretty() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.stringify(JSON.parse(s),null,2))}catch{console.log(s)}})'
}

if [ -z "${INSFORGE_USER_TOKEN:-}" ]; then
  : "${INSFORGE_TEST_EMAIL:?Define INSFORGE_USER_TOKEN o INSFORGE_TEST_EMAIL e INSFORGE_TEST_PASSWORD}"
  : "${INSFORGE_TEST_PASSWORD:?Define INSFORGE_TEST_PASSWORD}"
  INSFORGE_USER_TOKEN=$(
    node -e 'console.log(JSON.stringify({email:process.env.INSFORGE_TEST_EMAIL,password:process.env.INSFORGE_TEST_PASSWORD}))' |
      curl -sS -X POST "$BASE_URL/api/auth/sessions?client_type=server" -H 'Content-Type: application/json' --data-binary @- |
      node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.accessToken){console.error("No se pudo iniciar sesión:",s);process.exit(1)}console.log(j.accessToken)})'
  )
fi

post() {
  curl -sS -X POST "$BASE_URL/functions/$1" \
    -H "Authorization: Bearer $INSFORGE_USER_TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary @- | pretty
}

echo "== ingest ($SAMPLE)"
node -e 'const fs=require("fs");console.log(JSON.stringify({source:"nebula-logistica.txt",text:fs.readFileSync(process.argv[1],"utf8")}))' "$SAMPLE" | post ingest

for question in \
  "¿Cuántos días de vacaciones tiene un empleado durante su primer año?" \
  "¿Cuál es el salario promedio de los conductores de Nébula Logística?"; do
  echo
  echo "== ask: $question"
  node -e 'console.log(JSON.stringify({question:process.argv[1]}))' "$question" | post ask
done
