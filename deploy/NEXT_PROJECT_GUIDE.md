# 🚀 Emergent → cPanel Deploy — Guía para el Próximo Proyecto

> Lecciones aprendidas del deploy de **La Campeona 880 AM** (Feb 2026).
> Server profile: **GoDaddy VPS + cPanel + AlmaLinux + Apache + Python 3.9 + Node 18 + MongoDB local**.
>
> Sigue esta guía y tu próximo deploy debería tomar **menos de 10 minutos** sin tropiezos.

---

## 📋 Antes de Empezar (Checklist Rápido)

Antes de tocar el servidor, asegúrate de tener listo:

- [ ] Cuenta cPanel creada con un usuario único (ej: `miapp`)
- [ ] Dominio apuntado al servidor (ej: `miapp.com`)
- [ ] **Un puerto libre** elegido para el backend (ver tabla más abajo)
- [ ] Cuenta de GitHub con el repo creado
- [ ] El user de cPanel necesita "Normal Shell" en WHM **O** estar listo para usar `su -s /bin/bash`

### 🔢 Tabla de Puertos por App

| App | Puerto |
|---|---|
| GradeProphet | 8001 |
| OnPar Live | 8005 |
| La Campeona | 8006 |
| **TU NUEVO PROYECTO** | **8007** ← elige el siguiente libre |

⚠️ **NUNCA reutilices un puerto** — cada app tiene el suyo.

---

## 🏗️ Estructura de Archivos del Repo

Tu repo de Emergent debe tener esta estructura **antes** de hacer push:

```
/repo-raiz/
├── deploy.sh                    ← UN comando, lo único que corres en el server
├── bootstrap.sh                 ← solo primera vez en server fresco
├── backend/
│   ├── server.py
│   ├── requirements.txt          ← deps de DEV (con pandas, pytest, etc.)
│   └── .env                      ← deps de DEV (con localhost)
├── frontend/
│   ├── package.json
│   └── src/
└── deploy/                      ← scripts internos (NO los corres tú)
    ├── install_server.sh         ← lo llama deploy.sh primera vez
    ├── fix.sh                    ← lo llama deploy.sh para updates
    ├── setup-autostart.sh        ← crontab @reboot
    ├── htaccess                  ← Apache proxy + SPA
    ├── requirements.prod.txt     ← deps SLIM para Python 3.9
    └── backend.env.production.example  ← plantilla de .env de prod
```

---

## 📝 Reglas de Oro (NO ROMPER)

### ✅ HACER
1. **`safe.directory '*'`** desde el inicio en el server → `git config --global --add safe.directory '*'`
2. **Repo en `/home/USER/repo/`** (subcarpeta, NO en `/home/USER/`)
3. **Puerto único** por app, definido en UNA variable usado en TODOS los scripts
4. **Detectar first-install** por `/opt/APP/backend/venv` (NO por `.git`)
5. **`su -s /bin/bash -l USER -c "..."`** para correr como cPanel user (bypassa "no shell")
6. **`requirements.prod.txt` SLIM** sin pandas/numpy/pytest/black (compatibilidad Python 3.9)
7. **`yarn install --ignore-engines`** (Node 18 vs React 19 mismatch)
8. **`pip install --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/`** para `emergentintegrations`
9. **Generar `JWT_SECRET` automáticamente** con `openssl rand -hex 64`
10. **`REACT_APP_BACKEND_URL=https://DOMINIO`** ESCRITO EN `.env` ANTES del `yarn build`
11. **`.htaccess` con proxy `[P,L]`** Y `SPA fallback` en el mismo archivo
12. **`chmod 711 /home/USER`** (Apache traversal)
13. **Permisos 644 archivos / 755 carpetas** en `public_html/`
14. **Operaciones de root EN deploy.sh**, operaciones de user EN install_server.sh

### ❌ NO HACER
1. **NO** correr `yarn build` en el servidor de producción (poca RAM → crashea). El frontend se construye en Emergent (dev) y `frontend/build/` se commitea al repo
2. **NO** repo en `/home/USER/` directamente (conflicto con cPanel system folders)
3. **NO** `sudo` adentro de install_server.sh/fix.sh (corren como user, sudo pide password)
3. **NO** versiones pineadas en `requirements.prod.txt` (rompe en Python 3.9)
4. **NO** `pandas`/`numpy`/`pytest` en prod (no se usan, agregan 500MB)
5. **NO** apt — usa `dnf` (AlmaLinux es RHEL)
6. **NO** supervisor/systemd — solo `nohup` + crontab `@reboot`
7. **NO** nginx — Apache via cPanel
8. **NO** `withCredentials: true` con cookies httpOnly (proxy de cPanel rompe esto — usa Bearer token en localStorage)
9. **NO** `Access-Control-Allow-Origin: *` con `credentials: true` (browser rechaza)
10. **NO** olvides el `yarn build` en cada deploy (los cambios del frontend no se ven sin esto)
11. **NO** copies frontend `build/` al `public_html/` sin antes hacer `rm` de `static/`, `index.html` (asset hashes viejos)
12. **NO** corras git/instaladores como `root` cuando el dir es de `lacampeona` (dubious ownership)

---

## 🔑 Plantilla de `deploy.sh` para el Próximo Proyecto

Copia este template, reemplaza las 4 variables del header, y listo:

```bash
#!/bin/bash
set -e
# ============ AJUSTA ESTAS 4 VARIABLES ============
REPO_URL="https://github.com/TUUSUARIO/TUREPO.git"
CPANEL_USER="miapp"
PORT=8007                              # siguiente puerto libre
DOMAIN="miapp.com"
# ===================================================
REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${CPANEL_USER}/backend"

[ "$EUID" -ne 0 ] && { echo "❌ Run as root"; exit 1; }
git config --global --add safe.directory '*' 2>/dev/null || true

as_user() { su -s /bin/bash -l "$CPANEL_USER" -c "$1"; }

if [ ! -d "$PROD/venv" ]; then
    echo ">>> FIRST-TIME INSTALL"
    if [ ! -d "$REPO/.git" ]; then
        rm -rf "$REPO" && git clone "$REPO_URL" "$REPO"
    fi
    chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"
    chmod 711 "/home/$CPANEL_USER"
    mkdir -p "$PROD"
    chown -R "$CPANEL_USER:$CPANEL_USER" "/opt/$CPANEL_USER"
    if [ ! -f "$PROD/.env" ]; then
        cp "$REPO/deploy/backend.env.production.example" "$PROD/.env"
        sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 64)|" "$PROD/.env"
        chown "$CPANEL_USER:$CPANEL_USER" "$PROD/.env"
        chmod 600 "$PROD/.env"
    fi
    as_user "bash $REPO/deploy/install_server.sh"
    as_user "bash $REPO/deploy/setup-autostart.sh"
else
    echo ">>> UPDATE"
    chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"
    as_user "bash $REPO/deploy/fix.sh"
fi

sleep 2
if curl -sf "http://localhost:$PORT/api/" >/dev/null; then
    echo "  ✅ Backend OK"
else
    echo "  ❌ Backend not responding:"
    tail -n 20 "$PROD/backend.log" 2>/dev/null
    exit 1
fi
echo "🎉 https://$DOMAIN/login"
```

---

## 📂 Plantillas de Archivos Internos (`deploy/`)

Copia los archivos de **La Campeona** (`/home/lacampeona/repo/deploy/`) y reemplaza:
- `lacampeona` → `miapp` (o el user de tu cPanel)
- `lacampeona880am.com` → `miapp.com`
- `8006` → `8007` (o el puerto que elegiste)
- En `requirements.prod.txt` mantén la lista slim igual

### Archivos clave del folder `deploy/`:

#### `requirements.prod.txt` (SIEMPRE igual entre proyectos)
```
fastapi
uvicorn
python-dotenv
pymongo
motor
pydantic
email-validator
pyjwt
bcrypt
passlib
python-multipart
requests
tzdata
python-jose
emergentintegrations==0.1.0
```

#### `htaccess` (cambia solo el puerto)
```apache
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

RewriteCond %{REQUEST_URI} ^/api
RewriteRule ^(.*)$ http://127.0.0.1:8007/$1 [P,L]

RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

#### `backend.env.production.example`
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=miapp_prod
CORS_ORIGINS=https://miapp.com,https://www.miapp.com
JWT_SECRET=GENERATED_BY_DEPLOY_SCRIPT
JWT_EXPIRY_HOURS=12
ADMIN_EMAIL=admin@miapp.com
ADMIN_PASSWORD=CHANGE_ME
SUPER_ADMIN_EMAIL=pzsuave007@gmail.com
SUPER_ADMIN_PASSWORD=CHANGE_ME
EMERGENT_LLM_KEY=sk-emergent-XXXXXXXXXXXXXXXX
APP_NAME=miapp
```

---

## 🛠️ Pasos de Despliegue (5 minutos en server fresco)

### 1️⃣ Antes de SSH (en Emergent)
- Termina tu app (build, prueba, satisfecho)
- Asegura tener los archivos `deploy.sh`, `bootstrap.sh` y carpeta `deploy/` en el repo
- Click en **"Save to Github"** del chat

### 2️⃣ En el servidor (como root, una sola vez)
```bash
# Habilita git para todo (una sola vez por server)
git config --global --add safe.directory '*'

# Bootstrap → clona repo y corre deploy.sh
curl -sSL https://raw.githubusercontent.com/TUUSUARIO/TUREPO/main/bootstrap.sh | bash
```

Eso clona el repo en `/home/miapp/repo/`, instala todo, arranca backend, configura @reboot. **5 minutos.**

### 3️⃣ En cPanel UI (3 clicks)
1. **SSL/TLS Status** → Let's Encrypt para `miapp.com` + `www.miapp.com`
2. **Domains** → toggle **Force HTTPS Redirect** ON
3. **WHM → EasyApache 4 → Apache Modules** → enable: `mod_proxy`, `mod_proxy_http`, `mod_headers`, `mod_rewrite`

### 4️⃣ Verificar
```bash
curl -i https://miapp.com/api/
# → HTTP 200 + JSON ✅
```

Abre https://miapp.com/login → entra con tu super admin → 🎉

### 5️⃣ Updates futuros (siempre 2 líneas)
```bash
cd /home/miapp/repo && git pull && bash deploy.sh
```

---

## 🔥 Errores Comunes y Sus Fixes (Tabla de Bolsillo)

| Error | Causa | Fix |
|---|---|---|
| `dubious ownership in repository` | Git ≥2.35 + dir owner ≠ current user | `git config --global --add safe.directory '*'` |
| `Shell access is not enabled` | cPanel "no shell" para el user | `su -s /bin/bash -l USER -c "..."` |
| `sudo: a password is required` | install_server.sh usando sudo siendo user | Quitar `sudo`, hacer las ops de root EN deploy.sh |
| `cd: /opt/APP/backend: No such file` | deploy.sh va a UPDATE pero es FIRST | Detectar por `/opt/APP/backend/venv`, no por `.git` |
| `pip install emergentintegrations` falla | Index privado | Agregar `--extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/` |
| `yarn install` falla en engine check | Node 18 vs React 19 | `yarn install --ignore-engines` |
| `Could not build wheels for pandas` | Versión pineada en Py 3.9 | Quitar pandas/numpy del prod, sin versiones pineadas |
| `403 Forbidden` en el dominio | Permisos del public_html | `chmod 711 /home/USER` + `find public_html -type f -exec chmod 644 {} \;` |
| `404 en /super` al recargar | Falta SPA fallback | `.htaccess` con `RewriteRule . /index.html [L]` |
| `502 Bad Gateway` en `/api/*` | Backend no corre | `pgrep -af uvicorn.\*PORT` → si vacío, `bash /home/USER/restart.sh` |
| `mod_proxy` no enabled | EasyApache 4 default | WHM → enable mod_proxy + mod_proxy_http |
| Browser CORS error | `*` con credentials | Origin EXACTO en `CORS_ORIGINS` (https://dominio sin `/`) |
| Cookie httpOnly no se guarda | Proxy inyecta `Origin: *` | Usar Bearer token en localStorage (NO cookies) |
| Login funciona pero `/auth/me` 401 | Misma causa que arriba | Migrar frontend a Bearer + `Authorization` header |
| Cambios del frontend no se ven | Olvidaste `yarn build` | `deploy.sh` lo hace siempre — usa `deploy.sh` |
| Cambios del backend no aplican | Backend no se reinició | Usa `deploy.sh` (mata + restarta uvicorn) |

---

## 🧪 Cómo Probar el Próximo Deploy ANTES de Producir

Antes de hacer `bash deploy.sh` en el server real, prueba localmente:

```bash
# En tu máquina o un VPS de desarrollo
docker run -it --rm -v $(pwd):/repo almalinux:9 bash
# Adentro del container, simula el deploy:
cd /repo && bash deploy.sh
# Si funciona aquí, va a funcionar en cPanel
```

---

## 📞 Cuando Algo Falle

**Logs útiles para mandarme:**
```bash
# Backend
tail -n 100 /opt/USERNAME/backend/backend.log

# Apache
tail -n 50 /var/log/apache2/error_log
tail -n 50 /usr/local/apache/logs/error_log

# El estado del backend
pgrep -af "uvicorn.*PORT"

# El .env de prod (sin pegarme el JWT_SECRET, recórtalo)
grep -v "JWT_SECRET\|PASSWORD" /opt/USERNAME/backend/.env
```

---

## 💡 Tips de Productividad

1. **Alias permanente** en `/root/.bashrc`:
   ```bash
   alias deployapp="bash /home/USERNAME/repo/deploy.sh"
   ```
   Luego solo escribes `deployapp`. 🪄

2. **Notificación a Telegram cuando deploy falla** (agregar al final de `deploy.sh`):
   ```bash
   if [ $? -ne 0 ]; then
       curl -s "https://api.telegram.org/botTOKEN/sendMessage" \
           -d "chat_id=YOUR_CHAT_ID&text=Deploy ${DOMAIN} FAIL"
   fi
   ```

3. **GitHub Actions auto-deploy**: cada `git push` a `main` SSH al server y corre `deploy.sh`. Setup en 5 minutos, ahorra tiempo en cada cambio.

4. **Tener un `restart.sh` de bolsillo** en `/root/`:
   ```bash
   #!/bin/bash
   bash /home/$1/restart.sh
   # uso: bash /root/restart.sh lacampeona
   ```

---

## ✅ Checklist Final del Próximo Proyecto

Cuando arranques tu próximo proyecto en Emergent, copia este checklist:

- [ ] Elegir puerto único (siguiente al último: `8007`+)
- [ ] Crear cuenta cPanel + dominio
- [ ] Subir DNS apuntado al server
- [ ] Crear repo en GitHub
- [ ] Adaptar template `deploy.sh` con 4 variables del header
- [ ] Copiar carpeta `deploy/` desde proyecto anterior
- [ ] Ajustar `requirements.prod.txt` si tu app necesita deps específicas (ej: `stripe`, `twilio`)
- [ ] Ajustar `htaccess` con el nuevo puerto
- [ ] Ajustar `.env.production.example` con dominio correcto
- [ ] Click "Save to Github" en Emergent
- [ ] SSH como root al server
- [ ] `git config --global --add safe.directory '*'` (si server fresco)
- [ ] `curl bootstrap.sh | bash`
- [ ] cPanel: SSL + Force HTTPS + Apache modules
- [ ] `curl https://dominio.com/api/` → HTTP 200 ✅
- [ ] Login → super admin → 🎉

---

**Hecho con cariño tras el deploy de La Campeona 880 AM (Feb 2026).**
**Pzsuave007 — el próximo deploy es de 5 minutos. Lo prometo.**
