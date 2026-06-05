#!/bin/bash
# ============================================================
#  La Campeona 880 AM — Deploy Updates
#  Run after every git push to main:  bash /home/lacampeona/repo/deploy/fix.sh
#  Server: AlmaLinux + cPanel + Apache + Python 3.9 + Node 18
#  Port: 8006   |   Domain: lacampeona880am.com
# ============================================================
set -e

REPO="/home/lacampeona/repo"
PROD="/opt/lacampeona/backend"
WEB="/home/lacampeona/public_html"
PORT=8006
DOMAIN="lacampeona880am.com"
CPANEL_USER="lacampeona"

echo "============================================"
echo "  Deploy Update — port $PORT"
echo "============================================"

# ----- 1. Pull latest code -----
echo "[1/6] git pull..."
git config --global --add safe.directory "$REPO" || true
cd "$REPO"
git pull origin main

# ----- 2. Backend deps (skip if requirements.prod.txt unchanged) -----
echo "[2/6] Backend dependencies..."
REQ="$REPO/deploy/requirements.prod.txt"
STAMP="$PROD/.last-requirements-hash"
NEW_HASH=$(md5sum "$REQ" | awk '{print $1}')
OLD_HASH=$(cat "$STAMP" 2>/dev/null || echo "")
if [ "$NEW_HASH" = "$OLD_HASH" ]; then
    echo "    ✓ unchanged, skipping pip install"
else
    cd "$PROD"
    source "$PROD/venv/bin/activate"
    pip install --quiet \
        --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
        -r "$REQ"
    deactivate
    echo "$NEW_HASH" > "$STAMP" 2>/dev/null || true
    echo "    ✓ deps updated"
fi

# ----- 3. Copy backend files (subfolders optional) -----
echo "[3/6] Backend files..."
cp -f "$REPO/backend/server.py" "$PROD/"
mkdir -p "$PROD/routers" "$PROD/utils" "$PROD/models" "$PROD/tests"
cp -rf "$REPO/backend/routers/"*.py "$PROD/routers/" 2>/dev/null || true
cp -rf "$REPO/backend/utils/"*.py   "$PROD/utils/"   2>/dev/null || true
cp -rf "$REPO/backend/models/"*.py  "$PROD/models/"  2>/dev/null || true
cp -rf "$REPO/backend/tests/"*.py   "$PROD/tests/"   2>/dev/null || true

# ----- 4. Verify pre-built frontend (low-RAM VPS — never build on server) -----
echo "[4/6] Verifying pre-built frontend at $REPO/frontend/build ..."
if [ ! -f "$REPO/frontend/build/index.html" ]; then
    echo "ERROR: $REPO/frontend/build/index.html missing."
    echo "Build the frontend LOCALLY (in Emergent) before deploying:"
    echo "  cd frontend && REACT_APP_BACKEND_URL=https://${DOMAIN} yarn build"
    echo "Then commit frontend/build/ and 'git push'."
    exit 1
fi
echo "    ✓ build/ found ($(du -sh "$REPO/frontend/build" | cut -f1))"

# ----- 5. Deploy frontend + fix ownership -----
echo "[5/6] Deploying frontend to $WEB ..."
# AlmaLinux/cPanel sometimes leaves files with chattr +i (immutable) from a
# previous failed deploy or backup tool. Strip it defensively so rm always works.
chattr -i -R "$WEB/static" 2>/dev/null || true
for f in index.html asset-manifest.json manifest.json robots.txt favicon.ico; do
    chattr -i "$WEB/$f" 2>/dev/null || true
done
rm -rf "$WEB/static" "$WEB/index.html" "$WEB/asset-manifest.json" "$WEB/manifest.json"
cp -rf "$REPO/frontend/build/"* "$WEB/"
cp -f  "$REPO/deploy/htaccess"  "$WEB/.htaccess"
# Re-set ownership and permissions for cPanel/Apache
chown -R "${CPANEL_USER}:${CPANEL_USER}" "$WEB" 2>/dev/null || true
find "$WEB" -type f -exec chmod 644 {} \;
find "$WEB" -type d -exec chmod 755 {} \;

# ----- 6. Restart backend (same port everywhere) -----
echo "[6/6] Restarting backend..."
pkill -f "uvicorn.*${PORT}" 2>/dev/null || true
sleep 2
cd "$PROD"
source "$PROD/venv/bin/activate"
nohup "$PROD/venv/bin/uvicorn" server:app \
    --host 0.0.0.0 --port ${PORT} --workers 2 \
    > "$PROD/backend.log" 2>&1 &
sleep 5

# Verify
if curl -sf "http://localhost:${PORT}/api/" >/dev/null; then
    echo "  ✅ Backend OK on http://localhost:${PORT}"
else
    echo "  ❌ Backend FAILED — check $PROD/backend.log"
    tail -n 30 "$PROD/backend.log"
    exit 1
fi

echo ""
echo "============================================"
echo "  ✅ DEPLOY DONE"
echo "  Visit: https://${DOMAIN}"
echo "============================================"
