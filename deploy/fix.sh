#!/bin/bash
# ============================================================
#  La Campeona 880 AM — Deploy Updates
#  Run after every git push to main:  bash /home/lacampeona/deploy/fix.sh
#  Port: 8006   |   Domain: lacampeona880am.com
# ============================================================
set -e

REPO="/home/lacampeona"
PROD="/opt/lacampeona/backend"
WEB="/home/lacampeona/public_html"
PORT=8006

echo "============================================"
echo "  Deploy Update — port $PORT"
echo "============================================"

# ----- 1. Pull latest code -----
echo "[1/6] git pull..."
cd "$REPO"
git pull origin main

# ----- 2. Backend deps (handles emergentintegrations index) -----
echo "[2/6] Backend dependencies..."
cd "$PROD"
source "$PROD/venv/bin/activate"
pip install --quiet \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
    -r "$REPO/backend/requirements.txt"

# ----- 3. Copy backend files (subfolders optional) -----
echo "[3/6] Backend files..."
cp -f "$REPO/backend/server.py" "$PROD/"
mkdir -p "$PROD/routers" "$PROD/utils" "$PROD/models" "$PROD/tests"
cp -rf "$REPO/backend/routers/"*.py "$PROD/routers/" 2>/dev/null || true
cp -rf "$REPO/backend/utils/"*.py   "$PROD/utils/"   2>/dev/null || true
cp -rf "$REPO/backend/models/"*.py  "$PROD/models/"  2>/dev/null || true
cp -rf "$REPO/backend/tests/"*.py   "$PROD/tests/"   2>/dev/null || true

# ----- 4. Build frontend with PROD URL (CRITICAL) -----
echo "[4/6] Building frontend..."
cd "$REPO/frontend"
echo "REACT_APP_BACKEND_URL=https://lacampeona880am.com" > .env.production
echo "WDS_SOCKET_PORT=443" >> .env.production
yarn install --frozen-lockfile --silent
yarn build

# ----- 5. Deploy frontend (preserves .htaccess) -----
echo "[5/6] Deploying frontend to $WEB ..."
rm -rf "$WEB/static" "$WEB/index.html" "$WEB/asset-manifest.json" "$WEB/manifest.json"
cp -rf "$REPO/frontend/build/"* "$WEB/"
# Refresh .htaccess from repo (in case rules changed)
cp -f "$REPO/deploy/htaccess" "$WEB/.htaccess"

# ----- 6. Restart backend (consistent port everywhere) -----
echo "[6/6] Restarting backend..."
pkill -f "uvicorn.*$PORT" 2>/dev/null || true
sleep 2
cd "$PROD"
nohup "$PROD/venv/bin/uvicorn" server:app \
    --host 0.0.0.0 --port $PORT --reload \
    > "$PROD/backend.log" 2>&1 &
sleep 5

# Verify (same port everywhere — no more contradictions)
if curl -sf "http://localhost:$PORT/api/" >/dev/null; then
    echo "  ✅ Backend OK on http://localhost:$PORT"
else
    echo "  ❌ Backend FAILED — check $PROD/backend.log"
    tail -n 30 "$PROD/backend.log"
    exit 1
fi

echo ""
echo "============================================"
echo "  ✅ DEPLOY DONE"
echo "  Visit: https://lacampeona880am.com"
echo "============================================"
