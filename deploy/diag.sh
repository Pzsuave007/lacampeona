#!/bin/bash
# ============================================================
#  La Campeona — Diagnostic Tool
#
#  Just run:    bash ~/diag.sh
#  And paste the output to the agent.
# ============================================================

CPANEL_USER="lacampeona"
HOME_DIR="/home/${CPANEL_USER}"
PROD="/opt/${CPANEL_USER}/backend"
WEB="${HOME_DIR}/public_html"
PORT=8006

echo "╔════════════════════════════════════════════╗"
echo "║   La Campeona — Diagnostic Report          ║"
echo "╚════════════════════════════════════════════╝"

echo ""
echo "──── 1. Backend has /api/now-playing endpoint? ────"
if grep -q "now-playing" "${PROD}/server.py" 2>/dev/null; then
    echo "    ✓ YES — endpoint code present in ${PROD}/server.py"
    grep -n "now-playing\|NOW_PLAYING_URL" "${PROD}/server.py" | head -5
else
    echo "    ✗ NO — endpoint NOT in ${PROD}/server.py"
fi

echo ""
echo "──── 2. Backend responds to /api/now-playing? ────"
RESP=$(curl -s -m 8 -w "\nHTTP_CODE:%{http_code}" "http://localhost:${PORT}/api/now-playing" 2>&1)
echo "$RESP"

echo ""
echo "──── 3. Frontend build has now-playing code? ────"
COUNT=$(grep -o "now-playing" ${WEB}/static/js/main.*.js 2>/dev/null | wc -l)
echo "    refs to 'now-playing' in deployed bundle: $COUNT"
ls -la ${WEB}/static/js/main.*.js 2>/dev/null | head -3

echo ""
echo "──── 4. Frontend has player-artwork test id? ────"
COUNT2=$(grep -o "player-artwork" ${WEB}/static/js/main.*.js 2>/dev/null | wc -l)
echo "    refs to 'player-artwork': $COUNT2"

echo ""
echo "──── 5. uvicorn processes running ────"
ps aux | grep "uvicorn.*${PORT}" | grep -v grep | awk '{printf "    PID=%s CPU=%s%% MEM=%s%% CMD=%s\n", $2, $3, $4, $11" "$12" "$13" "$14" "$15" "$16}'

echo ""
echo "──── 6. Last 10 lines of backend.log ────"
tail -10 "${PROD}/backend.log" 2>/dev/null | sed 's/^/    /'

echo ""
echo "──── 7. Streaming Pulse endpoint reachable from server? ────"
SP=$(curl -s -m 8 -w "\nHTTP_CODE:%{http_code}" "https://us7.maindigitalstream.com/4550/?c=KWIP" 2>&1 | tail -3)
echo "$SP" | sed 's/^/    /'

echo ""
echo "──── 8. index.html in webroot is fresh? ────"
ls -la "${WEB}/index.html" 2>/dev/null
grep -o "main\.[a-f0-9]*\.js" "${WEB}/index.html" 2>/dev/null | head -2 | sed 's/^/    bundle: /'

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   Copy ALL of the output above & paste it   ║"
echo "║   to the agent.                              ║"
echo "╚════════════════════════════════════════════╝"
