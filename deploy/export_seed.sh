#!/bin/bash
# ============================================================
#  La Campeona — Export current DEV MongoDB to seed JSON files
#
#  Run this in the Emergent dev environment whenever you've
#  added/edited locutores (hosts), clientes (advertisers),
#  eventos, or settings, BEFORE pushing to GitHub.
#
#  Usage:
#     bash /app/deploy/export_seed.sh
# ============================================================
set -e

SEED_DIR="/app/deploy/seed_data"
MONGO_URL="mongodb://localhost:27017"
DB_NAME="radio_latina_db"

mkdir -p "$SEED_DIR"

echo "============================================"
echo "  Exporting ${DB_NAME} → ${SEED_DIR}"
echo "============================================"

for COL in hosts advertisers events settings; do
    OUT="$SEED_DIR/${COL}.json"
    mongoexport --uri="$MONGO_URL/$DB_NAME" \
        --collection="$COL" \
        --jsonArray \
        --pretty \
        --out="$OUT" \
        --quiet

    COUNT=$(mongosh --quiet "$MONGO_URL/$DB_NAME" --eval "db.${COL}.countDocuments({})")
    echo "  ✅ ${COL}: ${COUNT} docs → ${OUT}"
done

echo ""
echo "============================================"
echo "  ✅ EXPORT DONE"
echo ""
echo "  Next steps:"
echo "   1. git add deploy/seed_data/"
echo "   2. Click 'Save to Github' in Emergent"
echo "   3. On VPS:"
echo "        cd /home/lacampeona/repo && git pull"
echo "        bash deploy/import_seed.sh"
echo "        bash /home/lacampeona/restart.sh"
echo "============================================"
