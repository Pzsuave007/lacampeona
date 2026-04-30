#!/bin/bash
# ============================================================
#  La Campeona 880 AM — ONE-COMMAND DEPLOY
#  Run as root:
#     bash /home/lacampeona/repo/deploy/deploy.sh
#  -- OR first time, before repo exists:
#     curl -sSL https://raw.githubusercontent.com/Pzsuave007/lacampeona/main/deploy/bootstrap.sh | bash
#
#  This single script:
#   • Detects first-time vs update
#   • Clones or pulls the repo
#   • Auto-generates JWT_SECRET (no manual .env editing needed)
#   • Sets all permissions correctly
#   • Builds frontend + restarts backend
#   • Configures auto-restart on reboot (first time only)
# ============================================================
set -e

REPO_URL="https://github.com/Pzsuave007/lacampeona.git"
REPO="/home/lacampeona/repo"
PROD="/opt/lacampeona/backend"
WEB="/home/lacampeona/public_html"
CPANEL_USER="lacampeona"
PORT=8006
DOMAIN="lacampeona880am.com"

# ----- Must run as root -----
if [ "$EUID" -ne 0 ]; then
    echo "❌ Run as root:  sudo bash $0   OR   become root first"
    exit 1
fi

# ----- Verify lacampeona user exists -----
if ! id "$CPANEL_USER" >/dev/null 2>&1; then
    echo "❌ User '$CPANEL_USER' does not exist. Create the cPanel account first."
    exit 1
fi

echo "============================================"
echo "  La Campeona — ONE-COMMAND DEPLOY"
echo "  Domain: $DOMAIN  |  Port: $PORT"
echo "============================================"

# ----- 1. First-time setup OR update -----
if [ ! -d "$REPO/.git" ]; then
    # ===== FIRST TIME =====
    echo ""
    echo ">>> FIRST-TIME INSTALL detected"
    echo ""

    # Clone
    echo "[1/5] Cloning repo..."
    rm -rf "$REPO"
    git clone "$REPO_URL" "$REPO"
    chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"
    chmod 711 "/home/$CPANEL_USER"

    # Create prod backend dir
    echo "[2/5] Creating /opt/lacampeona ..."
    mkdir -p /opt/lacampeona
    chown -R "$CPANEL_USER:$CPANEL_USER" /opt/lacampeona

    # Pre-create .env with auto-generated JWT_SECRET (no manual edit needed)
    echo "[3/5] Generating .env with random JWT_SECRET ..."
    mkdir -p "$PROD"
    if [ ! -f "$PROD/.env" ]; then
        cp "$REPO/deploy/backend.env.production.example" "$PROD/.env"
        JWT=$(openssl rand -hex 64)
        sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT|" "$PROD/.env"
        chown "$CPANEL_USER:$CPANEL_USER" "$PROD/.env"
        chmod 600 "$PROD/.env"
        echo "    ✓ .env created with auto-generated JWT_SECRET (64-char hex)"
    else
        echo "    ✓ .env exists, kept as-is"
    fi

    # Run installer as lacampeona (no pause since .env already exists)
    # NOTE: -s /bin/bash bypasses cPanel's "no shell access" restriction
    echo "[4/5] Running installer as $CPANEL_USER ..."
    su -s /bin/bash -l "$CPANEL_USER" -c "bash $REPO/deploy/install_server.sh"

    # Auto-restart on reboot
    echo "[5/5] Configuring auto-restart on reboot ..."
    su -s /bin/bash -l "$CPANEL_USER" -c "bash $REPO/deploy/setup-autostart.sh"

    echo ""
    echo "============================================"
    echo "  ✅ FIRST-TIME INSTALL COMPLETE"
    echo "============================================"
else
    # ===== UPDATE =====
    echo ""
    echo ">>> UPDATE detected (existing repo)"
    echo ""

    # Make sure ownership is correct (in case someone ran git as root)
    chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"

    # Run fix.sh as lacampeona
    # NOTE: -s /bin/bash bypasses cPanel's "no shell access" restriction
    echo "[1/1] Running fix.sh as $CPANEL_USER ..."
    if ! su -s /bin/bash -l "$CPANEL_USER" -c "bash $REPO/deploy/fix.sh"; then
        echo "❌ fix.sh failed — see output above"
        exit 1
    fi

    echo ""
    echo "============================================"
    echo "  ✅ UPDATE DEPLOYED"
    echo "============================================"
fi

# ----- Final verification -----
echo ""
echo "Final checks:"
sleep 2
if curl -sf "http://localhost:$PORT/api/" >/dev/null; then
    echo "  ✅ Backend OK on http://localhost:$PORT"
else
    echo "  ⚠️  Backend not responding locally — check $PROD/backend.log"
fi

echo ""
echo "============================================"
echo "  🎉 DONE!"
echo ""
echo "  Open in browser: https://$DOMAIN/login"
echo "  Super Admin    : pzsuave007@gmail.com / MXmedia007"
echo ""
echo "  Next time: just run 'bash $REPO/deploy/deploy.sh'"
echo "============================================"
