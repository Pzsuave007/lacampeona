# La Campeona 880 AM — Production Deploy Guide

**Domain:** `lacampeona880am.com`
**Backend port:** `8006` (unique per app on this shared cPanel server)
**Layout:**
- Repo: `/home/lacampeona/`
- Prod backend: `/opt/lacampeona/backend/` (with `venv/`)
- Web root (cPanel): `/home/lacampeona/public_html/`

---

## 0. One-time prerequisites on the server (root or sudoer)

```bash
# Python 3.11+
python3 --version

# Node + yarn (for building the React frontend on the server)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 18
nvm alias default 18
npm install -g yarn

# MongoDB (local)
sudo systemctl status mongod  # or install mongodb-org if missing

# Apache modules (WHM → EasyApache 4 → Apache Modules)
#   ✅ mod_proxy
#   ✅ mod_proxy_http
#   ✅ mod_headers
#   ✅ mod_deflate
#   ✅ mod_rewrite
```

---

## 1. First-time install

> ⚠️ `/home/lacampeona/` already exists in cPanel with system folders (`mail/`, `public_html/`, `etc/`, etc.). We'll initialize git **inside** that home dir without wiping those folders.

```bash
# As the lacampeona cPanel user (NOT root)
cd /home/lacampeona

# Initialize git in the existing home dir, fetch repo content
git init
git branch -M main
git remote add origin https://github.com/<YOUR-USER>/<YOUR-REPO>.git
git fetch origin main
# Reset working tree to match the repo. cPanel-managed folders
# (public_html/, mail/, etc.) are listed in the repo's .gitignore
# so they are left intact.
git reset --hard origin/main

# Create prod backend dir + set ownership
sudo mkdir -p /opt/lacampeona && sudo chown -R $USER:$USER /opt/lacampeona

# Run installer (creates venv, installs deps, builds frontend with prod URL,
# starts backend on 8006, deploys static files to public_html/)
bash /home/lacampeona/deploy/install_server.sh

# Auto-restart on reboot
bash /home/lacampeona/deploy/setup-autostart.sh
```

The installer will pause once and ask you to edit `/opt/lacampeona/backend/.env`. Fill in:
- `JWT_SECRET` → run `openssl rand -hex 64` and paste the result
- `ADMIN_PASSWORD` → strong password
- Confirm `SUPER_ADMIN_EMAIL=pzsuave007@gmail.com` and `SUPER_ADMIN_PASSWORD=MXmedia007`
- `EMERGENT_LLM_KEY` → already pre-filled with `sk-emergent-eEbDa9fBf2b61E3F28`

---

## 2. cPanel manual configuration (one time)

### 2a. SSL
- cPanel → **SSL/TLS Status** → install Let's Encrypt for `lacampeona880am.com` and `www.lacampeona880am.com`
- cPanel → **Domains** → toggle **Force HTTPS Redirect**

### 2b. Reverse proxy `/api/*` → `localhost:8006`
The included `.htaccess` does this automatically via `mod_proxy`. **Verify after install:**

```bash
curl -i https://lacampeona880am.com/api/
# Should return: HTTP/1.1 200 OK + JSON body
```

If you get a 404 or see "API: ERROR", `mod_proxy` is not enabled in EasyApache 4 — go enable it.

### 2c. (Optional) Use cPanel "Application Manager" instead of `.htaccess` proxy
If your host disables `mod_proxy` for security, you can register the app in cPanel → **Application Manager** with the path `/api/` mapped to port `8006`. The `.htaccess` will still serve as SPA fallback.

---

## 3. Deploy updates (every time you push to `main`)

```bash
# As the lacampeona cPanel user
bash /home/lacampeona/deploy/fix.sh
```

The script does:
1. `git pull origin main`
2. Re-installs Python deps (handles `emergentintegrations` private index)
3. Copies backend files to `/opt/lacampeona/backend/`
4. **Builds frontend with `REACT_APP_BACKEND_URL=https://lacampeona880am.com`**
5. Deploys static files to `public_html/` (preserves `.htaccess`)
6. Restarts backend on port 8006 (consistent everywhere — no more port mismatch)
7. Curl-verifies the API responds

---

## 4. Quick troubleshooting

| Symptom | Check |
|---|---|
| `https://lacampeona880am.com/api/` returns 404 | `mod_proxy` enabled? `tail /opt/lacampeona/backend/backend.log` |
| `https://lacampeona880am.com/super` reloads to 404 | `.htaccess` SPA fallback rules at `public_html/.htaccess`? |
| Login fails with 401 | `JWT_SECRET` and `SUPER_ADMIN_PASSWORD` in `/opt/lacampeona/backend/.env`? |
| Content Studio "Generación falló" | `EMERGENT_LLM_KEY` set in `.env`? Backend can reach the internet? |
| CORS error in browser console | `CORS_ORIGINS` exact match (no trailing slash, both `https://lacampeona880am.com` AND `https://www.lacampeona880am.com`) |
| Backend not running | `pgrep -af 8006` — if empty, run `bash /home/lacampeona/restart.sh` |
| Need to reset super admin password | Edit `.env`, then restart: `bash /home/lacampeona/restart.sh` (seed re-hashes on startup) |

### Common log commands
```bash
tail -f /opt/lacampeona/backend/backend.log     # live backend log
pgrep -af "uvicorn.*8006"                       # is it running?
curl http://localhost:8006/api/                 # backend reachable locally?
curl https://lacampeona880am.com/api/           # backend reachable through proxy?
```

---

## 5. Default credentials after install

| Role | Email | Password | Lands at |
|---|---|---|---|
| **Super Admin** | `pzsuave007@gmail.com` | `MXmedia007` | `/super` |
| Admin | from `.env` | from `.env` | `/admin` |
| Demo DJ | from `.env` | from `.env` | `/dj` |

⚠️ **Change all passwords from the `/super` console after first login.**

---

## 6. Why port 8006?

Each app on this shared cPanel server uses a unique backend port to avoid collisions:
- Other project A → `8001`
- Other project B → `8004`
- **La Campeona → `8006`** ← chosen
- Free for next: `8007`+

The `.htaccess` proxy and `restart.sh` and `fix.sh` all reference `8006` consistently. Don't change the port without updating ALL these files in lockstep.
