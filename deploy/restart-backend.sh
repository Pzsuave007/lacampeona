#!/bin/bash
# ============================================================
#  La Campeona 880 AM — RESTART BACKEND (run as root)
#     sudo bash /home/lacampeona/repo/deploy/restart-backend.sh
#
#  Use this when the site works but NEW backend features (e.g. the
#  bracket Open-Graph share preview /api/bracket/og/...) return 404.
#  That means uvicorn is still running OLD code in memory. This script
#  pulls the latest code, copies server.py and FORCE-restarts uvicorn,
#  then verifies the OG route is live. It does NOT touch the frontend.
# ============================================================
set +e

REPO="/home/lacampeona/repo"
PROD="/opt/lacampeona/backend"
PORT=8006

echo "============================================"
echo "  Restarting backend on port $PORT"
echo "============================================"

# 1. Latest code
git config --global --add safe.directory "$REPO" 2>/dev/null || true
cd "$REPO" && git pull origin main

# 2. Copy backend code into the running prod dir
cp -f "$REPO/backend/server.py" "$PROD/server.py"
mkdir -p "$PROD/routers" "$PROD/utils" "$PROD/models"
cp -rf "$REPO/backend/routers/"*.py "$PROD/routers/" 2>/dev/null || true
cp -rf "$REPO/backend/utils/"*.py   "$PROD/utils/"   2>/dev/null || true
cp -rf "$REPO/backend/models/"*.py  "$PROD/models/"  2>/dev/null || true

# 3. Force restart uvicorn
echo ">>> stopping old uvicorn..."
pkill -f "uvicorn.*${PORT}" 2>/dev/null || true
sleep 2
cd "$PROD"
source "$PROD/venv/bin/activate"
nohup "$PROD/venv/bin/uvicorn" server:app \
    --host 0.0.0.0 --port ${PORT} --workers 2 \
    > "$PROD/backend.log" 2>&1 &
sleep 5

# 4. Verify the NEW Open-Graph route is live (404 = still old code)
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/api/bracket/og/healthcheck")
echo ""
if [ "$CODE" = "307" ] || [ "$CODE" = "200" ]; then
    echo "  ✅ Backend restarted — Open Graph route is LIVE (HTTP $CODE)."
    echo "     Share previews & images will now work on Facebook/WhatsApp."
else
    echo "  ❌ OG route still returns HTTP $CODE — last 30 log lines:"
    tail -n 30 "$PROD/backend.log"
fi
echo "============================================"
