# La Campeona 880 AM — Production Deploy Guide

> Server profile: **AlmaLinux + cPanel + Apache + Python 3.9 + Node 18 + MongoDB local + GoDaddy VPS**.
> Same pattern as your existing apps (GradeProphet on `8001`, OnPar on `8005`).

| Setting | Value |
|---|---|
| Domain | `lacampeona880am.com` (+ `www.lacampeona880am.com`) |
| Backend port | **`8006`** (unique on this shared server) |
| Repo location | `/home/lacampeona/repo/` |
| Prod backend | `/opt/lacampeona/backend/` (with `venv/`) |
| Web root | `/home/lacampeona/public_html/` |
| Process manager | `nohup uvicorn` + crontab `@reboot` |
| Web server | Apache (mod_proxy proxies `/api/*` to `:8006`) |
| MongoDB | local on `mongodb://localhost:27017` |

---

## Critical rules (don't break these)

- ❌ NO `apt` — use `dnf` (AlmaLinux is RHEL-based)
- ❌ NO `supervisor`, NO `systemd` — only `nohup` + crontab
- ❌ NO `nginx` — Apache via cPanel
- ❌ NO pinned Python versions — `requirements.prod.txt` already follows this rule
- ✅ `yarn install --ignore-engines` always (Node 18 vs React 19 mismatch)
- ✅ `chmod 711 /home/lacampeona` so Apache can traverse
- ✅ All files owned by `lacampeona:lacampeona`

---

## 0. One-time prerequisites on the server

```bash
# As root or via WHM
dnf install -y git python3 python3-pip
# Node 18 via nvm (as the lacampeona user)
su - lacampeona
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 18 && nvm alias default 18
npm install -g yarn

# Apache modules — WHM → EasyApache 4 → Apache Modules
#   ✅ mod_proxy
#   ✅ mod_proxy_http
#   ✅ mod_headers
#   ✅ mod_rewrite
#   ✅ mod_deflate (optional)
```

---

## 1. First-time install (run as root)

```bash
# 1a. Clone the repo INTO the lacampeona home
cd /home/lacampeona
git clone https://github.com/Pzsuave007/lacampeona.git repo
chown -R lacampeona:lacampeona /home/lacampeona/repo

# 1b. Create prod backend dir
mkdir -p /opt/lacampeona
chown -R lacampeona:lacampeona /opt/lacampeona

# 1c. Run installer (as the lacampeona user — important for file ownership)
sudo -u lacampeona bash /home/lacampeona/repo/deploy/install_server.sh

# 1d. Auto-restart on reboot
sudo -u lacampeona bash /home/lacampeona/repo/deploy/setup-autostart.sh
```

The installer pauses ONCE for you to edit `/opt/lacampeona/backend/.env`:

```bash
# In another terminal (or after Ctrl+C the pause):
nano /opt/lacampeona/backend/.env

# Generate a strong JWT_SECRET:
openssl rand -hex 64
# Paste the output as the value of JWT_SECRET=

# Verify SUPER_ADMIN_EMAIL=pzsuave007@gmail.com
# Verify SUPER_ADMIN_PASSWORD=MXmedia007
# Verify EMERGENT_LLM_KEY=sk-emergent-eEbDa9fBf2b61E3F28
# Save (Ctrl+O, Enter, Ctrl+X), then press ENTER in the installer.
```

---

## 2. cPanel manual configuration (one-time)

### 2a. SSL
- cPanel → **SSL/TLS Status** → install Let's Encrypt for `lacampeona880am.com` AND `www.lacampeona880am.com`
- cPanel → **Domains** → toggle **Force HTTPS Redirect** ON

### 2b. Verify `.htaccess` is in place
The installer copies `/home/lacampeona/repo/deploy/htaccess` → `/home/lacampeona/public_html/.htaccess`. Verify:

```bash
cat /home/lacampeona/public_html/.htaccess | head -20
# Should contain "RewriteRule ^(.*)$ http://127.0.0.1:8006/$1 [P,L]"
```

### 2c. Test
```bash
curl -i https://lacampeona880am.com/api/
# → HTTP/1.1 200 OK + JSON body  ✅
# If 404: mod_proxy not enabled in EasyApache 4
# If 502: backend not running — `pgrep -af uvicorn.*8006`
```

---

## 3. Deploy updates (every push to `main`)

```bash
sudo -u lacampeona bash /home/lacampeona/repo/deploy/fix.sh
```

The script is idempotent and does:
1. `git pull origin main`
2. Re-installs Python deps (handles `emergentintegrations` private index)
3. Copies backend files to `/opt/lacampeona/backend/`
4. **Builds frontend with `REACT_APP_BACKEND_URL=https://lacampeona880am.com`**
5. Deploys static files + `.htaccess` to `public_html/`
6. `chown` to `lacampeona:lacampeona` + correct file permissions (prevents 403)
7. Restarts backend on port 8006 (consistent everywhere)
8. `curl`-verifies the API responds locally

---

## 4. 403 Forbidden? (permissions fix)

If Apache returns 403, run as root:

```bash
chmod 711 /home/lacampeona
chown -R lacampeona:lacampeona /home/lacampeona/public_html
find /home/lacampeona/public_html -type f -exec chmod 644 {} \;
find /home/lacampeona/public_html -type d -exec chmod 755 {} \;
```

---

## 5. Common troubleshooting

| Symptom | Fix |
|---|---|
| `curl localhost:8006/api/` → connection refused | Backend not running. `bash /home/lacampeona/restart.sh` |
| `https://lacampeona880am.com/api/` → 404 | `mod_proxy` not enabled (EasyApache 4) |
| `https://lacampeona880am.com/super` reload → 404 | `.htaccess` missing or SPA fallback rule missing |
| 403 Forbidden | run permissions fix in section 4 |
| Login 401 with correct password | `JWT_SECRET` mismatch or empty in `.env`; restart backend |
| Content Studio "Generación falló" | `EMERGENT_LLM_KEY` missing or backend can't reach internet |
| CORS error in browser console | `CORS_ORIGINS` must include exact `https://lacampeona880am.com` AND `https://www.lacampeona880am.com` |
| Need to reset super admin password | Edit `.env` → `bash /home/lacampeona/restart.sh` (seed re-hashes on boot) |
| `pip install emergentintegrations` fails | Missing `--extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/` |
| `yarn install` fails on engine check | Add `--ignore-engines` flag |
| `git pull` says "dubious ownership" | Run as the dir owner: `sudo -u lacampeona bash /home/lacampeona/repo/deploy/fix.sh` |

### Useful commands
```bash
tail -f /opt/lacampeona/backend/backend.log    # live backend log
pgrep -af "uvicorn.*8006"                      # is it running?
curl http://localhost:8006/api/                # backend reachable locally?
curl -i https://lacampeona880am.com/api/       # backend through proxy?
crontab -l -u lacampeona                       # auto-restart configured?
```

---

## 6. Default credentials after install

| Role | Email | Password | Lands at |
|---|---|---|---|
| **Super Admin** | `pzsuave007@gmail.com` | `MXmedia007` | `/super` |
| Admin | from `.env` | from `.env` | `/admin` |
| Demo DJ | from `.env` | from `.env` | `/dj` |

⚠️ **Change all passwords from the `/super` console after first login.**

---

## 7. Why port 8006?

| Project | Port |
|---|---|
| GradeProphet | 8001 |
| OnPar Live | 8005 |
| **La Campeona** | **8006** ← chosen |
| Next free | 8007+ |

The port appears in `install_server.sh`, `fix.sh`, `setup-autostart.sh` and `htaccess` — all consistent. Don't change it without updating ALL files.
