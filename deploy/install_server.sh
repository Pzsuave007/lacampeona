#!/bin/bash
# ============================================================
#  La Campeona 880 AM — First-time Server Installation
#  Server: AlmaLinux + cPanel + Apache + Python 3.9 + Node 18 + MongoDB local
#  Domain: lacampeona880am.com  |  Port: 8006
# ============================================================
set -e

REPO="/home/lacampeona/repo"
PROD="/opt/lacampeona/backend"
WEB="/home/lacampeona/public_html"
PORT=8006
DOMAIN="lacampeona880am.com"
APP_NAME="lacampeona"
CPANEL_USER="lacampeona"

echo "============================================"
echo "  La Campeona — First-time Setup"
echo "  Repo: $REPO"
echo "  Prod: $PROD"
echo "  Web : $WEB"
echo "  Port: $PORT  |  Domain: $DOMAIN"
echo "============================================"

# ----- 1. Pre-flight checks (AlmaLinux 3.9 + Node 18) -----
echo "[1/9] Checking system requirements..."
python3 --version || { echo "ERROR: python3 missing. dnf install python3"; exit 1; }
pip3 --version  || { echo "ERROR: pip3 missing. dnf install python3-pip"; exit 1; }
node --version  || { echo "ERROR: node missing. nvm install 18"; exit 1; }
yarn --version  || { echo "ERROR: yarn missing. npm install -g yarn"; exit 1; }
git --version   || { echo "ERROR: git missing. dnf install git"; exit 1; }

# Trust this dir for git (cPanel users hit dubious-ownership errors otherwise)
git config --global --add safe.directory "$REPO" || true

# Apache needs traversal — already handled by deploy.sh (chmod 711 as root)

# ----- 2. Verify prod backend dir (created by deploy.sh as root) -----
echo "[2/9] Verifying $PROD exists..."
[ ! -d "$PROD" ] && { echo "ERROR: $PROD missing. Run via deploy.sh"; exit 1; }

# ----- 3. Python venv + slim prod deps (no pinned versions) -----
echo "[3/9] Creating Python venv + installing prod deps..."
cd "$PROD"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip --quiet

# emergentintegrations is on Emergent's private index
pip install --quiet \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
    -r "$REPO/deploy/requirements.prod.txt"
deactivate

# ----- 4. Setup .env (production) — pause for the user -----
echo "[4/9] Setting up backend .env..."
if [ ! -f "$PROD/.env" ]; then
    cp "$REPO/deploy/backend.env.production.example" "$PROD/.env"
    echo ""
    echo "  >>> EDIT real secrets now: nano $PROD/.env"
    echo "  >>> Set JWT_SECRET (run 'openssl rand -hex 64' in another shell)"
    echo "  >>> Confirm SUPER_ADMIN_EMAIL=pzsuave007@gmail.com SUPER_ADMIN_PASSWORD=MXmedia007"
    read -p "  >>> Press ENTER once you have edited .env..."
else
    echo "  .env exists, leaving untouched."
fi

# ----- 5. Copy backend files -----
echo "[5/9] Copying backend files to prod..."
cp -f "$REPO/backend/server.py" "$PROD/"
mkdir -p "$PROD/routers" "$PROD/utils" "$PROD/models" "$PROD/tests"
cp -rf "$REPO/backend/routers/"*.py "$PROD/routers/" 2>/dev/null || true
cp -rf "$REPO/backend/utils/"*.py   "$PROD/utils/"   2>/dev/null || true
cp -rf "$REPO/backend/models/"*.py  "$PROD/models/"  2>/dev/null || true
cp -rf "$REPO/backend/tests/"*.py   "$PROD/tests/"   2>/dev/null || true

# ----- 6. Verify pre-built frontend (built locally and committed to repo) -----
echo "[6/9] Verifying pre-built frontend at $REPO/frontend/build ..."
if [ ! -f "$REPO/frontend/build/index.html" ]; then
    echo "ERROR: $REPO/frontend/build/index.html missing."
    echo "Build the frontend LOCALLY (in Emergent) before deploying:"
    echo "  cd frontend && REACT_APP_BACKEND_URL=https://${DOMAIN} yarn build"
    echo "Then commit frontend/build/ and 'git push'."
    exit 1
fi
echo "    ✓ build/ found ($(du -sh "$REPO/frontend/build" | cut -f1))"

# ----- 7. Deploy frontend + fix ownership/permissions -----
echo "[7/9] Deploying frontend to $WEB ..."
mkdir -p "$WEB"
rm -rf "$WEB/static" "$WEB/index.html" "$WEB/asset-manifest.json" "$WEB/manifest.json"
cp -rf "$REPO/frontend/build/"* "$WEB/"
cp -f  "$REPO/deploy/htaccess"  "$WEB/.htaccess"
# chown not needed — lacampeona already owns public_html
find "$WEB" -type f -exec chmod 644 {} \;
find "$WEB" -type d -exec chmod 755 {} \;

# ----- 8. Start backend (consistent port everywhere) -----
echo "[8/9] Starting backend on port $PORT ..."
pkill -f "uvicorn.*${PORT}" 2>/dev/null || true
sleep 2
cd "$PROD"
source "$PROD/venv/bin/activate"
nohup "$PROD/venv/bin/uvicorn" server:app \
    --host 0.0.0.0 --port ${PORT} --reload \
    > "$PROD/backend.log" 2>&1 &
sleep 5

# ----- 9. Verify -----
echo "[9/9] Verifying backend..."
if curl -sf "http://localhost:${PORT}/api/" >/dev/null; then
    echo "  ✅ Backend OK on port ${PORT}"
else
    echo "  ❌ Backend FAILED — check $PROD/backend.log"
    tail -n 30 "$PROD/backend.log"
    exit 1
fi

echo ""
echo "============================================"
echo "  ✅ INSTALL DONE"
echo "============================================"
echo "Manual cPanel steps remaining:"
echo "  1. SSL/TLS Status → Let's Encrypt for ${DOMAIN} + www"
echo "  2. Force HTTPS Redirect ON"
echo "  3. WHM → EasyApache 4 → enable: mod_proxy, mod_proxy_http,"
echo "                                     mod_headers, mod_rewrite"
echo "  4. Test: curl -i https://${DOMAIN}/api/   (expect HTTP 200 + JSON)"
echo "  5. Open: https://${DOMAIN}/login"
echo "          Super: pzsuave007@gmail.com / MXmedia007"
echo ""
echo "Auto-restart on reboot: bash $REPO/deploy/setup-autostart.sh"
echo "============================================"
