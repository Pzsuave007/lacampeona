#!/bin/bash
# ============================================================
#  La Campeona — Import seed data from dev to prod MongoDB
#  Idempotent: drops collections (hosts/advertisers/events/settings)
#  and re-imports from /home/lacampeona/repo/deploy/seed_data/*.json
#
#  USERS, content_drafts, cta_events are NOT touched.
#
#  Usage (as root on the server):
#     bash /home/lacampeona/repo/deploy/import_seed.sh
# ============================================================
set -e

SEED_DIR="/home/lacampeona/repo/deploy/seed_data"
MONGO_URL="mongodb://localhost:27017"
DB_NAME="radio_latina_prod"

if ! command -v mongoimport >/dev/null; then
    echo "❌ mongoimport not found. Install MongoDB tools:"
    echo "   dnf install mongodb-database-tools"
    exit 1
fi

echo "============================================"
echo "  Import seed data → $DB_NAME"
echo "============================================"

for COL in hosts advertisers events settings; do
    FILE="$SEED_DIR/${COL}.json"
    if [ ! -f "$FILE" ]; then
        echo "  ⚠️  $FILE missing, skipping $COL"
        continue
    fi

    # Drop collection so import is clean (no duplicates)
    mongosh --quiet "$MONGO_URL/$DB_NAME" --eval "db.${COL}.drop()" >/dev/null

    # Import from jsonArray export
    mongoimport --uri="$MONGO_URL/$DB_NAME" \
        --collection="$COL" \
        --file="$FILE" \
        --jsonArray \
        --quiet

    COUNT=$(mongosh --quiet "$MONGO_URL/$DB_NAME" --eval "db.${COL}.countDocuments({})")
    echo "  ✅ ${COL}: ${COUNT} docs imported"
done

echo ""
echo "============================================"
echo "  ✅ SEED IMPORT DONE"
echo ""
echo "  Restart backend so it re-reads settings:"
echo "    bash /home/lacampeona/restart.sh"
echo "============================================"
