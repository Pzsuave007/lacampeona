#!/bin/bash
# ============================================================
#  La Campeona — Create home-directory shortcuts
#
#  Run ONCE as root (or with sudo):
#     bash /home/lacampeona/repo/deploy/setup-shortcuts.sh
#
#  After this you can deploy from anywhere with just:
#     bash ~/fix.sh        (or ~/deploy.sh)
#
#  Safe to re-run (idempotent — just overwrites).
# ============================================================
set -e

CPANEL_USER="lacampeona"
HOME_DIR="/home/${CPANEL_USER}"
REPO="${HOME_DIR}/repo"

echo "Creating shortcuts in ${HOME_DIR}/ ..."

# ----- fix.sh shortcut -----
cat > "${HOME_DIR}/fix.sh" << EOF
#!/bin/bash
# Shortcut → runs the real deploy/fix.sh from the repo
exec bash "${REPO}/deploy/fix.sh" "\$@"
EOF
chmod +x "${HOME_DIR}/fix.sh"

# ----- deploy.sh shortcut (alias) -----
cat > "${HOME_DIR}/deploy.sh" << EOF
#!/bin/bash
# Shortcut → runs the real deploy/fix.sh from the repo
exec bash "${REPO}/deploy/fix.sh" "\$@"
EOF
chmod +x "${HOME_DIR}/deploy.sh"

# ----- ownership (so cPanel user can read them) -----
chown ${CPANEL_USER}:${CPANEL_USER} "${HOME_DIR}/fix.sh" "${HOME_DIR}/deploy.sh" 2>/dev/null || true

echo ""
echo "============================================"
echo "  ✅ SHORTCUTS READY"
echo "============================================"
echo ""
echo "  From now on, deploy updates with just:"
echo "    cd ~ && git -C repo pull && bash fix.sh"
echo ""
echo "  Or even shorter:"
echo "    ~/fix.sh"
echo "============================================"
