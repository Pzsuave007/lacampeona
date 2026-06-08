#!/bin/bash
# ============================================================
#  La Campeona 880 AM — ONE-COMMAND DEPLOY (run as root)
#     bash /home/lacampeona/repo/deploy.sh
#
#  • First install → clones repo, sets up backend, builds frontend,
#    auto-imports seed data (hosts/advertisers/events/settings).
#  • Update → git pull + rebuild frontend + restart backend.
#  • Re-import seed manually any time:
#       bash /home/lacampeona/repo/deploy.sh --seed
# ============================================================
set -e

REPO_URL="https://github.com/Pzsuave007/lacampeona.git"
REPO="/home/lacampeona/repo"
PROD="/opt/lacampeona/backend"
SEED_DIR="$REPO/deploy/seed_data"
CPANEL_USER="lacampeona"
PORT=8006
DOMAIN="lacampeona880am.com"
DB_NAME="radio_latina_prod"
MONGO_URL="mongodb://localhost:27017"

[ "$EUID" -ne 0 ] && { echo "❌ Run as root"; exit 1; }
id "$CPANEL_USER" >/dev/null 2>&1 || { echo "❌ User $CPANEL_USER missing"; exit 1; }

git config --global --add safe.directory '*' 2>/dev/null || true

as_user() { su -s /bin/bash -l "$CPANEL_USER" -c "$1"; }

# ----- Seed import helper (runs on first install OR --seed flag) -----
import_seed() {
    if ! command -v mongoimport >/dev/null 2>&1; then
        echo "  ⚠️  mongoimport not found — installing mongodb-database-tools..."
        dnf install -y mongodb-database-tools 2>&1 | tail -5 || {
            echo "  ❌ Failed to install mongo tools. Skipping seed import."
            return 0
        }
    fi
    if [ ! -d "$SEED_DIR" ]; then
        echo "  ⚠️  No seed_data/ folder, skipping seed import"
        return 0
    fi
    echo ""
    echo ">>> IMPORTING SEED DATA (hosts, advertisers, events, settings)"
    for COL in hosts advertisers events settings; do
        FILE="$SEED_DIR/${COL}.json"
        [ ! -f "$FILE" ] && { echo "  ⚠️  $FILE missing, skipping"; continue; }
        mongosh --quiet "$MONGO_URL/$DB_NAME" --eval "db.${COL}.drop()" >/dev/null 2>&1 || true
        mongoimport --uri="$MONGO_URL/$DB_NAME" \
            --collection="$COL" --file="$FILE" --jsonArray --quiet
        COUNT=$(mongosh --quiet "$MONGO_URL/$DB_NAME" --eval "db.${COL}.countDocuments({})")
        echo "  ✅ ${COL}: ${COUNT} docs"
    done
}

# ----- Manual --seed flag -----
if [ "$1" = "--seed" ]; then
    import_seed
    bash /home/lacampeona/restart.sh 2>/dev/null || pkill -HUP -f "uvicorn.*$PORT" 2>/dev/null
    echo "🎉 Seed re-imported. Backend reloading."
    exit 0
fi

echo "============================================"
echo "  La Campeona — DEPLOY"
echo "  Domain: $DOMAIN  |  Port: $PORT"
echo "============================================"

# ----- Detect FIRST-TIME vs UPDATE -----
if [ ! -d "$PROD/venv" ]; then
    echo ""
    echo ">>> FIRST-TIME INSTALL"
    echo ""

    # 1. Clone or update repo
    if [ ! -d "$REPO/.git" ]; then
        echo "[1/6] Cloning repo..."
        rm -rf "$REPO"
        git clone "$REPO_URL" "$REPO"
    else
        echo "[1/6] Repo exists, pulling latest..."
        ( cd "$REPO" && git pull --ff-only origin main )
    fi
    chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"
    chmod 711 "/home/$CPANEL_USER"

    # 2. Create prod dirs
    echo "[2/6] Creating /opt/lacampeona ..."
    mkdir -p "$PROD"
    chown -R "$CPANEL_USER:$CPANEL_USER" "/opt/lacampeona"

    # 3. Pre-generate .env
    echo "[3/6] Generating .env with random JWT_SECRET ..."
    if [ ! -f "$PROD/.env" ]; then
        cp "$REPO/deploy/backend.env.production.example" "$PROD/.env"
        sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 64)|" "$PROD/.env"
        chown "$CPANEL_USER:$CPANEL_USER" "$PROD/.env"
        chmod 600 "$PROD/.env"
        echo "    ✓ .env created"
    fi

    # 4. Run installer
    echo "[4/6] Running installer ..."
    as_user "bash $REPO/deploy/install_server.sh"

    # 5. Auto-restart on reboot
    echo "[5/6] Setting up @reboot ..."
    as_user "bash $REPO/deploy/setup-autostart.sh"

    # 6. Auto-import seed on first install
    echo "[6/6] Importing seed data ..."
    import_seed
else
    echo ""
    echo ">>> UPDATE"
    echo ""
    chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"
    # /opt/lacampeona/backend must be writable by the cPanel user, otherwise
    # fix.sh (which runs as that user) cannot write the deps stamp, copy the
    # new server.py, or restart the backend — aborting the whole update.
    chown -R "$CPANEL_USER:$CPANEL_USER" "$PROD" 2>/dev/null || true
    # Don't let a fix.sh hiccup abort the deploy before the backend restarts.
    as_user "bash $REPO/deploy/fix.sh" || echo "  ⚠️  fix.sh reported an issue — forcing a backend restart below..."
fi

# ----- Guaranteed backend restart (covers the case where fix.sh aborted) -----
# Ensures the running uvicorn always picks up the latest server.py (e.g. the
# /api/bracket/og Open Graph routes), even if an earlier step failed.
cp -f "$REPO/backend/server.py" "$PROD/server.py" 2>/dev/null || true
OG_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/bracket/og/healthcheck" 2>/dev/null)
if [ "$OG_CODE" != "307" ] && [ "$OG_CODE" != "200" ]; then
    echo ">>> Backend missing new routes (HTTP $OG_CODE) — force restarting uvicorn..."
    pkill -f "uvicorn.*${PORT}" 2>/dev/null || true
    sleep 2
    as_user "cd $PROD && source venv/bin/activate && nohup venv/bin/uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 2 > $PROD/backend.log 2>&1 &"
    sleep 5
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
echo ""
echo "  Re-import seed data any time:"
echo "    bash $REPO/deploy.sh --seed"
echo "============================================"
