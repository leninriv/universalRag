#!/usr/bin/env bash
# Prueba end-to-end del RAG: ingesta el texto de ejemplo y hace una pregunta que está en el texto
# y otra que no. Usa la URL y la API key del proyecto vinculado (.insforge/project.json).
set -euo pipefail
cd "$(dirname "$0")/../.."

FUNCTIONS_URL="${INSFORGE_FUNCTIONS_URL:-$(node -p 'require("./.insforge/project.json").oss_host')/functions}"
API_KEY="${INSFORGE_API_KEY:-$(node -p 'require("./.insforge/project.json").api_key')}"
SAMPLE="insforge/samples/nebula-logistica.txt"

post() {
  curl -sS -X POST "$FUNCTIONS_URL/$1" \
    -H "Authorization: Bearer $API_KEY" \
    -H 'Content-Type: application/json' \
    --data-binary @- | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.stringify(JSON.parse(s),null,2))}catch{console.log(s)}})'
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
