#!/bin/bash
# ============================================================
#  La Campeona 880 AM — First-time Server Installation
#  Domain: lacampeona880am.com
#  Backend port: 8006 (unique per app on shared server)
# ============================================================
set -e

REPO="/home/lacampeona"
PROD="/opt/lacampeona/backend"
WEB="/home/lacampeona/public_html"
PORT=8006

echo "============================================"
echo "  La Campeona — First-time Setup"
echo "  Repo: $REPO"
echo "  Prod: $PROD"
echo "  Web : $WEB"
echo "  Port: $PORT"
echo "============================================"

# ----- 1. Verify pre-requisites -----
echo "[1/8] Checking system requirements..."
python3 --version || { echo "ERROR: Install Python 3.11+ first"; exit 1; }
pip3 --version || python3 -m ensurepip --upgrade
node --version || { echo "ERROR: Install Node.js 18+ first (nvm install 18)"; exit 1; }
yarn --version || { echo "ERROR: Install yarn (npm install -g yarn)"; exit 1; }

# ----- 2. Create prod directories -----
echo "[2/8] Creating prod directories..."
sudo mkdir -p "$PROD"
sudo chown -R "$USER:$USER" "$PROD"
mkdir -p "$WEB"

# ----- 3. Setup Python venv + install deps -----
echo "[3/8] Creating Python venv + installing deps..."
cd "$PROD"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip --quiet

# IMPORTANT: emergentintegrations is on Emergent's private index
pip install --quiet \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
    -r "$REPO/backend/requirements.txt"

# ----- 4. Setup .env (production) -----
echo "[4/8] Setting up backend .env..."
if [ ! -f "$PROD/.env" ]; then
    if [ -f "$REPO/deploy/backend.env.production.example" ]; then
        cp "$REPO/deploy/backend.env.production.example" "$PROD/.env"
        echo "  >>> EDIT real secrets now: nano $PROD/.env"
        echo "  >>> Set MONGO_URL, JWT_SECRET, EMERGENT_LLM_KEY, SUPER_ADMIN_*"
        read -p "  >>> Press ENTER once you have edited .env..."
    else
        echo "ERROR: missing template $REPO/deploy/backend.env.production.example"
        exit 1
    fi
else
    echo "  .env exists, leaving untouched."
fi

# ----- 5. Copy backend files -----
echo "[5/8] Copying backend files to prod..."
cp -f "$REPO/backend/server.py" "$PROD/"
mkdir -p "$PROD/routers" "$PROD/utils" "$PROD/models" "$PROD/tests"
cp -rf "$REPO/backend/routers/"*.py "$PROD/routers/" 2>/dev/null || true
cp -rf "$REPO/backend/utils/"*.py   "$PROD/utils/"   2>/dev/null || true
cp -rf "$REPO/backend/models/"*.py  "$PROD/models/"  2>/dev/null || true
cp -rf "$REPO/backend/tests/"*.py   "$PROD/tests/"   2>/dev/null || true

# ----- 6. Build frontend with PROD URL -----
echo "[6/8] Building frontend (yarn install + yarn build)..."
cd "$REPO/frontend"
# Critical: REACT_APP_BACKEND_URL is baked at build time!
echo "REACT_APP_BACKEND_URL=https://lacampeona880am.com" > .env.production
echo "WDS_SOCKET_PORT=443" >> .env.production
yarn install --frozen-lockfile --silent
yarn build

# ----- 7. Deploy frontend static files -----
echo "[7/8] Deploying frontend to $WEB ..."
# Wipe old static, keep .htaccess, cgi-bin etc.
rm -rf "$WEB/static" "$WEB/index.html" "$WEB/asset-manifest.json" "$WEB/manifest.json"
cp -rf "$REPO/frontend/build/"* "$WEB/"
# .htaccess for SPA routing (overwrite to ensure correct rules)
cp -f "$REPO/deploy/htaccess" "$WEB/.htaccess"

# ----- 8. Start backend (kill prev + nohup) -----
echo "[8/8] Starting backend on port $PORT ..."
pkill -f "uvicorn.*$PORT" 2>/dev/null || true
sleep 2
cd "$PROD"
nohup "$PROD/venv/bin/uvicorn" server:app \
    --host 0.0.0.0 --port $PORT --reload \
    > "$PROD/backend.log" 2>&1 &
sleep 5

# Verify
if curl -sf "http://localhost:$PORT/api/" >/dev/null; then
    echo "  ✅ Backend OK on port $PORT"
else
    echo "  ❌ Backend FAILED — check $PROD/backend.log"
    tail -n 30 "$PROD/backend.log"
    exit 1
fi

echo ""
echo "============================================"
echo "  ✅ INSTALL DONE"
echo "============================================"
echo "Next manual steps in cPanel:"
echo "  1. Create reverse proxy:  /api/*  →  http://localhost:$PORT/api/"
echo "     (cPanel → Application Manager  OR  edit .htaccess at $WEB)"
echo "  2. Force HTTPS on lacampeona880am.com (cPanel → SSL/TLS Status)"
echo "  3. Test: https://lacampeona880am.com/api/  → should return JSON"
echo "  4. Test: https://lacampeona880am.com/login → super admin login"
echo "============================================"
