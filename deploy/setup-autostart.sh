#!/bin/bash
# ============================================================
#  Setup auto-restart on server reboot via crontab
# ============================================================
set -e

PROD="/opt/lacampeona/backend"
PORT=8006
RESTART_SCRIPT="/home/lacampeona/restart.sh"

echo "Setting up auto-restart for La Campeona backend (port $PORT)..."

# Create restart helper
cat > "$RESTART_SCRIPT" << EOF
#!/bin/bash
# Auto-restart La Campeona backend on port $PORT
cd "$PROD"
source "$PROD/venv/bin/activate"
pkill -f "uvicorn.*$PORT" 2>/dev/null
sleep 2
nohup "$PROD/venv/bin/uvicorn" server:app \\
    --host 0.0.0.0 --port $PORT --reload \\
    > "$PROD/backend.log" 2>&1 &
EOF
chmod +x "$RESTART_SCRIPT"

# Add to crontab (idempotent — replaces existing line)
( crontab -l 2>/dev/null | grep -v "$RESTART_SCRIPT" ; echo "@reboot /bin/bash $RESTART_SCRIPT" ) | crontab -

echo "✅ Auto-restart configured."
echo "Verify with:  crontab -l"
echo "Test manually: bash $RESTART_SCRIPT"
