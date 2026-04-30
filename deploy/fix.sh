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

# ----- 2. Backend deps (slim prod list, --extra-index-url for emergentintegrations) -----
echo "[2/6] Backend dependencies..."
cd "$PROD"
source "$PROD/venv/bin/activate"
pip install --quiet \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
    -r "$REPO/deploy/requirements.prod.txt"
deactivate

# ----- 3. Copy backend files (subfolders optional) -----
echo "[3/6] Backend files..."
cp -f "$REPO/backend/server.py" "$PROD/"
mkdir -p "$PROD/routers" "$PROD/utils" "$PROD/models" "$PROD/tests"
cp -rf "$REPO/backend/routers/"*.py "$PROD/routers/" 2>/dev/null || true
cp -rf "$REPO/backend/utils/"*.py   "$PROD/utils/"   2>/dev/null || true
cp -rf "$REPO/backend/models/"*.py  "$PROD/models/"  2>/dev/null || true
cp -rf "$REPO/backend/tests/"*.py   "$PROD/tests/"   2>/dev/null || true

# ----- 4. Build frontend (yarn --ignore-engines for Node 18) -----
echo "[4/6] Building frontend..."
cd "$REPO/frontend"
cat > .env <<EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
WDS_SOCKET_PORT=443
EOF
yarn install --ignore-engines --silent
yarn build

# ----- 5. Deploy frontend + fix ownership -----
echo "[5/6] Deploying frontend to $WEB ..."
rm -rf "$WEB/static" "$WEB/index.html" "$WEB/asset-manifest.json" "$WEB/manifest.json"
cp -rf "$REPO/frontend/build/"* "$WEB/"
cp -f  "$REPO/deploy/htaccess"  "$WEB/.htaccess"
# chown not needed — lacampeona already owns public_html
find "$WEB" -type f -exec chmod 644 {} \;
find "$WEB" -type d -exec chmod 755 {} \;

# ----- 6. Restart backend (same port everywhere) -----
echo "[6/6] Restarting backend..."
pkill -f "uvicorn.*${PORT}" 2>/dev/null || true
sleep 2
cd "$PROD"
source "$PROD/venv/bin/activate"
nohup "$PROD/venv/bin/uvicorn" server:app \
    --host 0.0.0.0 --port ${PORT} --reload \
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
