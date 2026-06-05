#!/bin/bash
# ============================================================
#  La Campeona — DESBLOQUEAR Y DEPLOY DE EMERGENCIA
#
#  Para cuando el deploy normal falla con "Permission denied"
#  por archivos bloqueados con chattr +i en cPanel.
#
#  USO (como root, una sola vez):
#     bash /home/lacampeona/repo/borrar.sh
#
#  Hace TODO en orden:
#   1. Quita el bloqueo chattr +i de TODOS los archivos del frontend
#   2. Borra los archivos viejos manualmente
#   3. Copia los nuevos del build
#   4. Permisos + ownership correctos
#   5. Reinicia backend
#   6. Verifica que el sitio y la API respondan
# ============================================================
set +e   # Don't bomb out on individual rm failures — we want to see them all

CPANEL_USER="lacampeona"
REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/lacampeona/backend"
WEB="/home/${CPANEL_USER}/public_html"
PORT=8006
DOMAIN="lacampeona880am.com"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   LA CAMPEONA — DESBLOQUEAR + DEPLOY MANUAL      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ---------- 0. Soy root? ----------
if [ "$EUID" -ne 0 ]; then
    echo "❌ Necesitas correr esto como root: sudo bash borrar.sh"
    exit 1
fi

# ---------- 1. git pull (por si los archivos del repo están viejos) ----------
echo "[1/7] Git pull para asegurar archivos nuevos en el repo..."
git config --global --add safe.directory "$REPO" 2>/dev/null
cd "$REPO" && git pull origin main || true
echo ""

# ---------- 2. Verificar que el build esté en el repo ----------
echo "[2/7] Verificando que el build esté listo en el repo..."
if [ ! -f "$REPO/frontend/build/index.html" ]; then
    echo "    ❌ NO existe $REPO/frontend/build/index.html"
    echo "    Necesitas hacer 'Save to Github' en Emergent primero."
    exit 1
fi
BUILD_SIZE=$(du -sh "$REPO/frontend/build" | cut -f1)
echo "    ✓ build/ encontrado ($BUILD_SIZE)"
echo ""

# ---------- 3. DESBLOQUEAR los archivos viejos (chattr -i) ----------
echo "[3/7] Quitando bloqueo inmutable (chattr -i) de archivos viejos..."
# Recursivo en todo public_html (es el patrón seguro)
chattr -i -R "$WEB" 2>/dev/null
# Algunos sistemas necesitan tratarlos uno por uno
find "$WEB" -type f -exec chattr -i {} \; 2>/dev/null
find "$WEB" -type d -exec chattr -i {} \; 2>/dev/null
# Confirma que ya no hay archivos con +i
LOCKED_COUNT=$(lsattr -R "$WEB" 2>/dev/null | grep -c '^\-*i\-*\s' || echo 0)
if [ "$LOCKED_COUNT" -gt 0 ]; then
    echo "    ⚠️  Aún hay $LOCKED_COUNT archivos bloqueados — pruebo lsattr ver:"
    lsattr -R "$WEB" 2>/dev/null | grep '^\-*i\-*\s' | head -5
else
    echo "    ✓ Todos los archivos desbloqueados"
fi
echo ""

# ---------- 4. Borrar archivos viejos del frontend ----------
echo "[4/7] Borrando frontend viejo..."
rm -rf "$WEB/static" 2>&1 | head -3
rm -f "$WEB/index.html" "$WEB/asset-manifest.json" "$WEB/manifest.json" "$WEB/robots.txt" "$WEB/favicon.ico" 2>&1 | head -3
# Verifica que sí se borró
if [ -d "$WEB/static" ]; then
    echo "    ⚠️  /static AÚN existe — intento más agresivo..."
    chattr -i -R "$WEB/static" 2>/dev/null
    chmod -R u+rwx "$WEB/static" 2>/dev/null
    rm -rf "$WEB/static"
fi
if [ -d "$WEB/static" ]; then
    echo "    ❌ NO se pudo borrar /static. Algo más lo protege (SELinux, ACL)."
    echo "    Ejecuta manualmente: getenforce; setfacl --remove-all -R $WEB/static"
    exit 1
fi
echo "    ✓ Archivos viejos eliminados"
echo ""

# ---------- 5. Copiar build nuevo ----------
echo "[5/7] Copiando build nuevo desde $REPO/frontend/build ..."
cp -rf "$REPO/frontend/build/"* "$WEB/"
if [ -f "$REPO/deploy/htaccess" ]; then
    cp -f "$REPO/deploy/htaccess" "$WEB/.htaccess"
fi
# Permisos + ownership correctos para cPanel/Apache
chown -R "${CPANEL_USER}:${CPANEL_USER}" "$WEB"
find "$WEB" -type f -exec chmod 644 {} \;
find "$WEB" -type d -exec chmod 755 {} \;
NEW_SIZE=$(du -sh "$WEB" | cut -f1)
echo "    ✓ Frontend desplegado ($NEW_SIZE)"
echo ""

# ---------- 6. Copiar/actualizar backend y reiniciar ----------
echo "[6/7] Actualizando backend y reiniciando uvicorn en puerto $PORT ..."
cp -f "$REPO/backend/server.py" "$PROD/"
mkdir -p "$PROD/routers" "$PROD/utils" "$PROD/models" "$PROD/tests"
cp -rf "$REPO/backend/routers/"*.py "$PROD/routers/" 2>/dev/null
cp -rf "$REPO/backend/utils/"*.py   "$PROD/utils/"   2>/dev/null
cp -rf "$REPO/backend/models/"*.py  "$PROD/models/"  2>/dev/null

# Mata procesos viejos en el puerto (fuser por si pkill no los pesca)
pkill -9 -f "uvicorn.*${PORT}" 2>/dev/null
fuser -k "${PORT}/tcp" 2>/dev/null
sleep 2

# Levanta nuevo backend
cd "$PROD"
source "$PROD/venv/bin/activate"
nohup uvicorn server:app --host 0.0.0.0 --port "$PORT" --workers 2 \
    > "$PROD/backend.log" 2>&1 &
disown
deactivate
sleep 3
echo "    ✓ Backend reiniciado"
echo ""

# ---------- 7. Pruebas de salud ----------
echo "[7/7] Verificando que todo funcione..."
PASS=0
FAIL=0

# Backend local
if curl -sf "http://localhost:${PORT}/api/" >/dev/null 2>&1; then
    echo "    ✓ Backend respondiendo en localhost:${PORT}"
    PASS=$((PASS+1))
else
    echo "    ❌ Backend NO responde en localhost:${PORT}"
    echo "       Revisa: tail -50 ${PROD}/backend.log"
    FAIL=$((FAIL+1))
fi

# Endpoint /api/now-playing
if curl -sf "http://localhost:${PORT}/api/now-playing" >/dev/null 2>&1; then
    echo "    ✓ /api/now-playing OK"
    PASS=$((PASS+1))
else
    echo "    ⚠️  /api/now-playing no responde"
    FAIL=$((FAIL+1))
fi

# Endpoint /api/bracket/meta (la quiniela nueva)
if curl -sf "http://localhost:${PORT}/api/bracket/meta" >/dev/null 2>&1; then
    TEAMS=$(curl -s "http://localhost:${PORT}/api/bracket/meta" | grep -o '"teams"' | wc -l)
    echo "    ✓ Quiniela /api/bracket/meta OK"
    PASS=$((PASS+1))
else
    echo "    ⚠️  /api/bracket/meta no responde (puede que server.py viejo)"
    FAIL=$((FAIL+1))
fi

# Sitio público vía dominio
if curl -sf "https://${DOMAIN}/" -o /dev/null 2>&1; then
    echo "    ✓ Sitio https://${DOMAIN}/ responde"
    PASS=$((PASS+1))
else
    echo "    ⚠️  https://${DOMAIN}/ no responde — revisa Apache/cPanel"
    FAIL=$((FAIL+1))
fi

# /quiniela frontend (debería devolver index.html)
HTTP_QUINIELA=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/quiniela")
if [ "$HTTP_QUINIELA" = "200" ]; then
    echo "    ✓ https://${DOMAIN}/quiniela responde 200"
    PASS=$((PASS+1))
else
    echo "    ⚠️  https://${DOMAIN}/quiniela devolvió HTTP $HTTP_QUINIELA"
    FAIL=$((FAIL+1))
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
if [ "$FAIL" -eq 0 ]; then
    echo "║   ✅ TODO LISTO — ${PASS} pruebas pasaron               ║"
    echo "╠══════════════════════════════════════════════════╣"
    echo "║   Visita: https://${DOMAIN}              ║"
    echo "║   Quiniela: https://${DOMAIN}/quiniela   ║"
    echo "║   Admin:  https://${DOMAIN}/admin         ║"
    echo "║   Hard refresh: Ctrl+Shift+R                     ║"
else
    echo "║   ⚠️  ${PASS} OK / ${FAIL} con problemas                       ║"
    echo "╠══════════════════════════════════════════════════╣"
    echo "║   Revisa los ❌ y ⚠️ arriba.                       ║"
    echo "║   Log backend: tail -50 ${PROD}/backend.log"
fi
echo "╚══════════════════════════════════════════════════╝"
