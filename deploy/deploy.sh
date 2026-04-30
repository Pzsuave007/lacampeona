#!/bin/bash
# ============================================================
#  La Campeona 880 AM — ONE-COMMAND DEPLOY (run as root)
#     bash /home/lacampeona/repo/deploy/deploy.sh
# ============================================================
set -e

REPO_URL="https://github.com/Pzsuave007/lacampeona.git"
REPO="/home/lacampeona/repo"
PROD="/opt/lacampeona/backend"
WEB="/home/lacampeona/public_html"
CPANEL_USER="lacampeona"
PORT=8006
DOMAIN="lacampeona880am.com"

[ "$EUID" -ne 0 ] && { echo "❌ Run as root"; exit 1; }
id "$CPANEL_USER" >/dev/null 2>&1 || { echo "❌ User $CPANEL_USER missing"; exit 1; }

# Trust git everywhere (one-time, persistent)
git config --global --add safe.directory '*' 2>/dev/null || true

echo "============================================"
echo "  La Campeona — DEPLOY"
echo "  Domain: $DOMAIN  |  Port: $PORT"
echo "============================================"

# Helper: run a command as the cPanel user (bypasses cPanel "no shell" restriction)
as_user() {
    su -s /bin/bash -l "$CPANEL_USER" -c "$1"
}

# ----- Detect FIRST-TIME vs UPDATE based on prod backend -----
if [ ! -d "$PROD/venv" ]; then
    echo ""
    echo ">>> FIRST-TIME INSTALL (no $PROD/venv yet)"
    echo ""

    # 1. Make sure repo exists & ownership is correct
    if [ ! -d "$REPO/.git" ]; then
        echo "[1/5] Cloning repo..."
        rm -rf "$REPO"
        git clone "$REPO_URL" "$REPO"
    else
        echo "[1/5] Repo exists, pulling latest..."
        ( cd "$REPO" && git pull --ff-only origin main )
    fi
    chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"
    chmod 711 "/home/$CPANEL_USER"

    # 2. Create prod dirs with correct ownership
    echo "[2/5] Creating /opt/lacampeona ..."
    mkdir -p "$PROD"
    chown -R "$CPANEL_USER:$CPANEL_USER" "/opt/lacampeona"

    # 3. Pre-generate .env so installer doesn't pause
    echo "[3/5] Generating .env with random JWT_SECRET ..."
    if [ ! -f "$PROD/.env" ]; then
        cp "$REPO/deploy/backend.env.production.example" "$PROD/.env"
        JWT=$(openssl rand -hex 64)
        sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT|" "$PROD/.env"
        chown "$CPANEL_USER:$CPANEL_USER" "$PROD/.env"
        chmod 600 "$PROD/.env"
        echo "    ✓ .env created at $PROD/.env"
    fi

    # 4. Run installer as lacampeona (clean shell)
    echo "[4/5] Running installer ..."
    as_user "bash $REPO/deploy/install_server.sh"

    # 5. Auto-restart on reboot
    echo "[5/5] Setting up @reboot auto-restart ..."
    as_user "bash $REPO/deploy/setup-autostart.sh"
else
    echo ""
    echo ">>> UPDATE (prod backend already installed)"
    echo ""

    chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"
    as_user "bash $REPO/deploy/fix.sh"
fi

# ----- Final verification -----
sleep 2
echo ""
if curl -sf "http://localhost:$PORT/api/" >/dev/null; then
    echo "  ✅ Backend OK on http://localhost:$PORT"
else
    echo "  ❌ Backend not responding — last 20 lines of log:"
    tail -n 20 "$PROD/backend.log" 2>/dev/null || echo "  (no log yet)"
    exit 1
fi

echo ""
echo "============================================"
echo "  🎉 DONE!"
echo "  https://$DOMAIN/login"
echo "  Super: pzsuave007@gmail.com / MXmedia007"
echo "============================================"
