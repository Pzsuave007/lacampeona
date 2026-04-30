#!/bin/bash
# ============================================================
#  La Campeona — Bootstrap (download + run deploy.sh)
#  Use ONLY the first time on a fresh server. After that just
#  run /home/lacampeona/repo/deploy/deploy.sh.
#
#  Usage (as root, ONE LINE):
#     curl -sSL https://raw.githubusercontent.com/Pzsuave007/lacampeona/main/deploy/bootstrap.sh | bash
# ============================================================
set -e

if [ "$EUID" -ne 0 ]; then
    echo "❌ Run as root."
    exit 1
fi

REPO_URL="https://github.com/Pzsuave007/lacampeona.git"
REPO="/home/lacampeona/repo"
CPANEL_USER="lacampeona"

# Verify cPanel user exists
if ! id "$CPANEL_USER" >/dev/null 2>&1; then
    echo "❌ User '$CPANEL_USER' does not exist. Create the cPanel account first."
    exit 1
fi

# Clone (idempotent — wipes any half-cloned attempt)
echo ">>> Cloning $REPO_URL ..."
rm -rf "$REPO"
git clone "$REPO_URL" "$REPO"
chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"

# Now hand off to the full deploy script
echo ">>> Handing off to deploy.sh ..."
bash "$REPO/deploy/deploy.sh"
