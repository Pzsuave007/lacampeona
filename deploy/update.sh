#!/bin/bash
# ============================================================
#  La Campeona — One-command update for the VPS
#
#  Just run this from anywhere as root:
#     bash /home/lacampeona/repo/deploy/update.sh
#
#  Or after the first run, simply:
#     bash ~/update.sh
#
#  It does EVERYTHING:
#   1. git pull
#   2. Verifies the new code is on disk
#   3. Runs fix.sh (backend deps, copy files, restart uvicorn)
#   4. Creates a ~/update.sh shortcut so next time it's even easier
#   5. Verifies the API is responding
# ============================================================
set -e

CPANEL_USER="lacampeona"
HOME_DIR="/home/${CPANEL_USER}"
REPO="${HOME_DIR}/repo"
PORT=8006

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   La Campeona — One-Command Update         ║"
echo "╚════════════════════════════════════════════╝"

# ----- 1. git pull -----
echo ""
echo "[1/4] Pulling latest from GitHub..."
git config --global --add safe.directory "$REPO" 2>/dev/null || true
cd "$REPO"
git pull origin main || true

# ----- 2. Quick file check -----
echo ""
echo "[2/4] Verifying new files on disk..."
MISSING=0
for f in \
    "frontend/src/components/Footer.jsx" \
    "frontend/build/index.html" \
    "deploy/fix.sh" \
    "backend/server.py"; do
    if [ -f "$REPO/$f" ]; then
        echo "    ✓ $f"
    else
        echo "    ✗ $f MISSING"
        MISSING=$((MISSING+1))
    fi
done

if [ "$MISSING" -gt 0 ]; then
    echo ""
    echo "❌ Files missing. Click 'Save to Github' in Emergent first."
    exit 1
fi

# ----- 3. Run the real deploy script -----
echo ""
echo "[3/4] Running deploy/fix.sh ..."
bash "$REPO/deploy/fix.sh"

# ----- 4. Create handy shortcut for next time + verify API -----
echo ""
echo "[4/4] Creating ~/update.sh shortcut & verifying..."
# Create in both lacampeona home AND root home, since SSH usually = root
for TARGET_HOME in "${HOME_DIR}" "/root"; do
    if [ -d "$TARGET_HOME" ]; then
        cat > "${TARGET_HOME}/update.sh" << EOF
#!/bin/bash
exec bash "${REPO}/deploy/update.sh" "\$@"
EOF
        chmod +x "${TARGET_HOME}/update.sh"
    fi
done
chown ${CPANEL_USER}:${CPANEL_USER} "${HOME_DIR}/update.sh" 2>/dev/null || true

# Verify API
sleep 2
if curl -sf "http://localhost:${PORT}/api/" >/dev/null; then
    echo "    ✓ Backend responding on port ${PORT}"
else
    echo "    ✗ Backend NOT responding — check /opt/lacampeona/backend/backend.log"
fi

# Verify now-playing endpoint
if curl -sf "http://localhost:${PORT}/api/now-playing" >/dev/null; then
    echo "    ✓ /api/now-playing endpoint working"
else
    echo "    ⚠️  /api/now-playing not responding (may not be deployed yet)"
fi

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   ✅ UPDATE COMPLETE                       ║"
echo "╠════════════════════════════════════════════╣"
echo "║   Next time, just run:                     ║"
echo "║      bash ~/update.sh                      ║"
echo "║                                            ║"
echo "║   Visit: https://lacampeona880am.com       ║"
echo "║   Hard refresh: Ctrl+Shift+R               ║"
echo "╚════════════════════════════════════════════╝"
