#!/bin/bash
# ============================================================
#  build-for-prod.sh — Build the frontend with prod URL
#  RUN THIS IN EMERGENT (dev) BEFORE clicking "Save to Github".
#  The committed frontend/build/ is what your low-RAM VPS will serve.
# ============================================================
set -e

DOMAIN="lacampeona880am.com"
FRONTEND="/app/frontend"

[ ! -d "$FRONTEND" ] && { echo "❌ $FRONTEND missing"; exit 1; }
cd "$FRONTEND"

echo "============================================"
echo "  Building frontend for prod ($DOMAIN)"
echo "============================================"

rm -rf build
REACT_APP_BACKEND_URL="https://$DOMAIN" yarn build 2>&1 | tail -3

# Verify URL was baked correctly
COUNT=$(grep -oc "$DOMAIN" build/static/js/main.*.js 2>/dev/null || echo 0)
PREVIEW=$(grep -oc "preview.emergentagent" build/static/js/main.*.js 2>/dev/null || echo 0)

if [ "$COUNT" -gt 0 ] && [ "$PREVIEW" -eq 0 ]; then
    SIZE=$(du -sh build | cut -f1)
    echo ""
    echo "  ✅ build/ ready ($SIZE) with URL https://$DOMAIN"
    echo ""
    echo "  Next: click 'Save to Github' to commit & push."
else
    echo ""
    echo "  ❌ Build problem:"
    echo "     - Occurrences of $DOMAIN: $COUNT (should be > 0)"
    echo "     - Occurrences of preview URL: $PREVIEW (should be 0)"
    exit 1
fi
