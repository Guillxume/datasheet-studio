#!/usr/bin/env bash
# Rendu d'une fiche de test contre un Studio en cours d'execution.
#
#   STUDIO_KEY=sk_... ./fixtures/render.sh [payload.json] [sortie.pdf]
#
# Variables : STUDIO_URL (defaut http://localhost:3000), STUDIO_KEY (requis),
#             ASSET_DIR  (dossier des images de test)
set -euo pipefail

STUDIO_URL="${STUDIO_URL:-http://localhost:3000}"
PAYLOAD="${1:-fixtures/sample-payload.json}"
OUTPUT="${2:-/tmp/fiche.pdf}"
ASSET_DIR="${ASSET_DIR:-fixtures/assets}"

if [ -z "${STUDIO_KEY:-}" ]; then
  echo "STUDIO_KEY manquant. L'obtenir avec : pnpm issue-key <slug>" >&2
  exit 1
fi

# payload=< et non payload=@ : la premiere forme envoie le contenu comme valeur
# de champ, la seconde comme fichier joint. L'API accepte les deux, mais c'est
# la valeur de champ que produit le module PrestaShop.
args=(-F "payload=<${PAYLOAD}")

for file in "$ASSET_DIR"/*; do
  [ -f "$file" ] || continue
  key="$(basename "${file%.*}")"
  args+=(-F "asset[${key}]=@${file}")
done

status="$(curl -sS -w '%{http_code}' -o "$OUTPUT" \
  -X POST "${STUDIO_URL}/api/v1/render" \
  -H "Authorization: Bearer ${STUDIO_KEY}" \
  -D /tmp/studio-render-headers.txt \
  "${args[@]}")"

if [ "$status" != "200" ]; then
  echo "echec HTTP $status :" >&2
  cat "$OUTPUT" >&2
  echo >&2
  exit 1
fi

grep -i 'x-render-warnings' /tmp/studio-render-headers.txt || true
echo "$OUTPUT  ($(wc -c <"$OUTPUT" | tr -d ' ') octets, version de template $(grep -i 'x-template-version' /tmp/studio-render-headers.txt | tr -d '\r' | cut -d' ' -f2))"
