#!/bin/bash
# ============================================================
#  La Campeona — FORCE restart backend (kills by port, not name)
#  Use when fix.sh leaves a zombie uvicorn that won't pick up
#  the new code.
#
#  Run:   bash ~/force-restart.sh
# ============================================================
set -e

PROD="/opt/lacampeona/backend"
PORT=8006

echo "╔════════════════════════════════════════════╗"
echo "║   FORCE RESTART — port $PORT                  ║"
echo "╚════════════════════════════════════════════╝"

# ----- 1. Show what's currently on port 8006 -----
echo ""
echo "[1/4] Who is on port ${PORT} right now?"
if command -v lsof >/dev/null; then
    lsof -i :${PORT} -t 2>/dev/null | head -10
else
    fuser ${PORT}/tcp 2>/dev/null || echo "  (fuser/lsof not installed, using ss)"
    ss -tlnp 2>/dev/null | grep ":${PORT}" || true
fi

# ----- 2. NUKE everything on port 8006 (by port, not by name) -----
echo ""
echo "[2/4] Killing anything on port ${PORT}..."
if command -v fuser >/dev/null; then
    fuser -k -9 ${PORT}/tcp 2>/dev/null || true
fi
if command -v lsof >/dev/null; then
    lsof -i :${PORT} -t 2>/dev/null | xargs -r kill -9 2>/dev/null || true
fi
# Belt-and-suspenders: also kill by name patterns
pkill -9 -f "uvicorn" 2>/dev/null || true
pkill -9 -f "${PROD}/venv" 2>/dev/null || true
sleep 3

# Verify nothing left
LEFT=$(ss -tln 2>/dev/null | grep ":${PORT}" | wc -l)
if [ "$LEFT" -gt 0 ]; then
    echo "  ⚠️  Port ${PORT} still in use:"
    ss -tlnp 2>/dev/null | grep ":${PORT}"
    exit 1
fi
echo "    ✓ Port ${PORT} is now free"

# ----- 3. Also clear any python bytecode cache (just in case) -----
echo ""
echo "[3/4] Clearing Python bytecode cache..."
find "$PROD" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find "$PROD" -name "*.pyc" -delete 2>/dev/null || true
echo "    ✓ Cache cleared"

# ----- 4. Start fresh -----
echo ""
echo "[4/4] Starting fresh uvicorn with --workers 2..."
cd "$PROD"
# shellcheck source=/dev/null
source "$PROD/venv/bin/activate"
nohup "$PROD/venv/bin/uvicorn" server:app \
    --host 0.0.0.0 --port ${PORT} --workers 2 \
    > "$PROD/backend.log" 2>&1 &
disown
sleep 6

# ----- Verify -----
echo ""
echo "──── Verifying ────"
if curl -sf "http://localhost:${PORT}/api/" >/dev/null; then
    echo "    ✓ /api/ responding"
else
    echo "    ✗ /api/ NOT responding"
    tail -20 "$PROD/backend.log"
    exit 1
fi

RESP=$(curl -s -m 8 "http://localhost:${PORT}/api/now-playing")
if echo "$RESP" | grep -q "title"; then
    echo "    ✓ /api/now-playing WORKING!"
    echo "      $(echo $RESP | head -c 200)"
else
    echo "    ✗ /api/now-playing still failing:"
    echo "      $RESP"
fi

echo ""
echo "──── Process tree ────"
ps -ef | grep "uvicorn" | grep -v grep | sed 's/^/    /'

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   ✅ FORCE RESTART DONE                    ║"
echo "║                                            ║"
echo "║   Now open in browser:                     ║"
echo "║     https://lacampeona880am.com            ║"
echo "║   And press Ctrl + Shift + R               ║"
echo "╚════════════════════════════════════════════╝"
