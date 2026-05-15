#!/bin/bash
# ============================================================
#  La Campeona — FORCE restart backend (simple, fast)
#
#  Run:   bash ~/repo/deploy/force-restart.sh
# ============================================================
PROD="/opt/lacampeona/backend"
PORT=8006

echo "Killing anything on port ${PORT}..."
sudo fuser -k ${PORT}/tcp 2>/dev/null
sleep 3

echo "Clearing Python cache..."
find "$PROD" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
find "$PROD" -name "*.pyc" -delete 2>/dev/null

echo "Starting fresh uvicorn..."
cd "$PROD"
source "$PROD/venv/bin/activate"
nohup "$PROD/venv/bin/uvicorn" server:app \
    --host 0.0.0.0 --port ${PORT} --workers 2 \
    > "$PROD/backend.log" 2>&1 &
disown
sleep 6

echo ""
echo "──── Verifying ────"
curl -s http://localhost:${PORT}/api/ && echo ""
echo ""
RESP=$(curl -s -m 8 http://localhost:${PORT}/api/now-playing)
if echo "$RESP" | grep -q "title"; then
    echo "✅ /api/now-playing WORKING:"
    echo "   $RESP"
    echo ""
    echo "✅ ALL FIXED. Open https://lacampeona880am.com + Ctrl+Shift+R"
else
    echo "✗ Still failing: $RESP"
    tail -10 "$PROD/backend.log"
fi
