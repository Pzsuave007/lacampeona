#!/bin/bash
# ============================================================
#  La Campeona — HOTFIX: remove uvicorn --reload from prod
#
#  What it does (idempotent, safe to re-run):
#   1. Kills any uvicorn process on port 8006 (incl. zombie --reload ones)
#   2. Relaunches uvicorn with --workers 2 (no --reload)
#   3. Regenerates /home/lacampeona/restart.sh without --reload
#      so the crontab @reboot hook also uses the new command.
#   4. Verifies CPU is low and API responds.
#
#  Run as root on the VPS:
#     cd /home/lacampeona/repo && git pull
#     bash deploy/hotfix-reload.sh
# ============================================================
set -e

PROD="/opt/lacampeona/backend"
PORT=8006
RESTART_SCRIPT="/home/lacampeona/restart.sh"

echo "============================================"
echo "  La Campeona HOTFIX — removing --reload"
echo "============================================"

# ----- 1. Show current state -----
echo ""
echo "[1/5] Current uvicorn processes BEFORE fix:"
ps aux | grep -E "uvicorn.*${PORT}" | grep -v grep || echo "  (none)"

# ----- 2. Kill the zombie process(es) -----
echo ""
echo "[2/5] Killing uvicorn on port ${PORT}..."
pkill -9 -f "uvicorn.*${PORT}" 2>/dev/null || true
sleep 3

# Double-check nothing left
REMAINING=$(pgrep -af "uvicorn.*${PORT}" | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo "  ⚠️  Still running, forcing kill..."
    pgrep -af "uvicorn.*${PORT}" | awk '{print $1}' | xargs -r kill -9
    sleep 2
fi
echo "  ✅ Port ${PORT} clean"

# ----- 3. Relaunch WITHOUT --reload, WITH --workers 2 -----
echo ""
echo "[3/5] Starting uvicorn with --workers 2 (no --reload)..."
cd "$PROD"
# shellcheck source=/dev/null
source "$PROD/venv/bin/activate"
nohup "$PROD/venv/bin/uvicorn" server:app \
    --host 0.0.0.0 --port ${PORT} --workers 2 \
    > "$PROD/backend.log" 2>&1 &
sleep 6

# ----- 4. Regenerate /home/lacampeona/restart.sh so @reboot won't reinject --reload -----
echo ""
echo "[4/5] Regenerating ${RESTART_SCRIPT} (used by crontab @reboot)..."
cat > "$RESTART_SCRIPT" << EOF
#!/bin/bash
# Auto-restart La Campeona backend on port ${PORT} (no --reload in prod)
cd "${PROD}"
source "${PROD}/venv/bin/activate"
pkill -f "uvicorn.*${PORT}" 2>/dev/null
sleep 2
nohup "${PROD}/venv/bin/uvicorn" server:app \\
    --host 0.0.0.0 --port ${PORT} --workers 2 \\
    > "${PROD}/backend.log" 2>&1 &
EOF
chmod +x "$RESTART_SCRIPT"

# Make sure crontab entry exists (idempotent)
( crontab -l 2>/dev/null | grep -v "$RESTART_SCRIPT" ; echo "@reboot /bin/bash $RESTART_SCRIPT" ) | crontab -
echo "  ✅ restart.sh & crontab updated"

# ----- 5. Verify -----
echo ""
echo "[5/5] Verifying..."
sleep 2
if curl -sf "http://localhost:${PORT}/api/" >/dev/null; then
    echo "  ✅ Backend responding on port ${PORT}"
else
    echo "  ❌ Backend NOT responding — check $PROD/backend.log"
    tail -20 "$PROD/backend.log"
    exit 1
fi

# Show new process tree
echo ""
echo "  New uvicorn processes (should be 1 master + 2 workers, all low CPU):"
ps -o pid,pcpu,pmem,cmd --sort=-pcpu -C uvicorn 2>/dev/null | head -5 || \
    ps aux | grep "uvicorn.*${PORT}" | grep -v grep

# Check no --reload anywhere
LEAK=$(ps aux | grep -- "--reload" | grep -v grep | wc -l)
if [ "$LEAK" -gt 0 ]; then
    echo ""
    echo "  ⚠️  Found --reload still running somewhere:"
    ps aux | grep -- "--reload" | grep -v grep
else
    echo "  ✅ No --reload anywhere on the system"
fi

echo ""
echo "============================================"
echo "  ✅ HOTFIX APPLIED"
echo ""
echo "  Watch CPU for 5 min:"
echo "    top -p \$(pgrep -f 'uvicorn.*${PORT}' | tr '\\n' ',' | sed 's/,\$//')"
echo ""
echo "  Expected: <5% CPU per process in idle."
echo "============================================"
