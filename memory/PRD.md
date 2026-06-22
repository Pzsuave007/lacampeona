# KWIP La Campeona — PRD

## Original Problem Statement
Modern, mobile-first web app for KWIP La Campeona (880 AM / 103.9 FM) — Spanish radio station from Dallas, Oregon. Engagement + monetization with sticky live player, dynamic advertiser system (radio-style scheduling + SmartCTA popup), DJ scheduling, WhatsApp integration, World Cup 2026 page, advertiser sales landing, **Events system with multi-day support and dedicated landing pages**, and **Click Analytics dashboards** (admin overview + per-advertiser/event public reports).

## User Language
**Spanish (es)** — all UI copy and agent communication in Spanish.

## Core Architecture
- **Frontend**: React + Tailwind + Shadcn UI + Recharts (mobile-first)
- **Backend**: FastAPI on `/api/*`
- **DB**: MongoDB (users, hosts, advertisers, events, settings, **cta_events**)
- **Storage**: Emergent Object Storage (banners/flyers/galleries)
- **Auth**: JWT (admin only); **opaque report_token** for public per-entity reports

## Implemented Features (Feb 2026)

### Live Radio
- Sticky player streaming KWIP La Campeona (mobile no rounded corners, attached to SmartCTA, stable height)

### Hosts / DJs
- Dynamic HostHero by station timezone schedule
- WeeklyScheduleGrid in Admin
- Default Hero fallback

### Advertisers
- Radio-style scheduling: spots/hour, spot_duration_sec, priority 1–10
- **Weighted round-robin rotation** with **configurable pause** between spots (default 60s — `cta_pause_seconds` in settings)
- "Anúnciate aquí" CTA on Home

### Events
- Full CRUD: title, **multi-day** (event_date + end_date), times, location, **address** for Maps, description, image, **gallery** (multi-photo), ticket_url, category
- Public `/eventos` listing (auto-hides past events) + Home teaser
- **Dedicated landing `/eventos/:slug`** with hero + gallery navigation, info card (date/time/location), Buy tickets / Get directions / Share buttons
- Promote as SmartCTA flotante (joins rotation alongside ads in promotion window)

### SmartCTA
- Floating popup, mobile-friendly (collapsed by default, attached to player)
- Renders both advertisers and events polymorphically
- Minimize button, never dismissible
- 3-line collapsed view: "PROMOCIÓN · Toca para abrir" + name + offer

### Click Analytics (NEW)
- **Tracking**: POST `/api/track` records `impression | call | whatsapp | directions | visit | tickets` per entity
- 30-second per-session impression dedupe to prevent inflation from polling
- **Admin overview**: GET `/api/admin/analytics/overview` — totals + sorted entity ranking with name enrichment
- **Per-entity drilldown**: GET `/api/admin/analytics/{type}/{id}` — 30-day daily series
- **Public report**: GET `/api/report/{token}` — opaque token-based dashboard, no auth required
- **Frontend**:
  - Admin "Reportes" tab with overview + entities table + drilldown (Recharts line chart)
  - "Copiar link" per entity to share with business owners
  - Public `/reporte/:token` page with same dashboard, branded with entity hero
  - Period selector: 7/14/30/90 days
- **Privacy**: `report_token` and `owner_email` stripped from public `/api/advertisers`, `/api/events`, `/api/active`. Admin-only `/api/admin/advertisers` returns full data.

### Pages
- `/` — Home (HostHero/Default + Mundial + Events teaser + Advertisers + Community CTA)
- `/eventos` — Events listing
- `/eventos/:slug` — Event landing
- `/reporte/:token` — Public analytics dashboard
- `/mundial` — World Cup 2026 schedule
- `/anuncia` — Advertising sales pitch
- `/advertisers` + `/a/:slug` — Advertisers
- `/admin` — Admin dashboard (5 tabs: Radio, Locutores, Anunciantes, Eventos, Reportes)
- `/dj` — **DJ Content Studio**
- `/super` — **Super Admin Center** (NEW — owner-only)

### Super Admin Center (Feb 2026) ✅
- New role `super_admin` (>admin >dj). Single owner account: `pzsuave007@gmail.com / MXmedia007`, seeded from `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` env vars on backend startup.
- Access: `/login` redirects super_admin → `/super` (owner-only). Super admin also bypasses `get_admin` and `get_dj` checks.
- **Tab Usuarios**: full user CRUD (create/edit/delete admins, DJs, additional super admins). Email is the unique identifier; can't self-delete or self-demote. DJ creation includes a Host dropdown to set `host_slug`. Password reset modal per user.
- **Tab Estadísticas**: 8 platform cards — total users by role, hosts/advertisers/events count, drafts (total + 30d), impressions/clicks/CTR (30d).
- **Tab Herramientas**: regenerate `report_token` for any advertiser or event (auto-copies new public URL to clipboard); shortcut tiles to `/admin`, `/dj`, public site.
- API: `GET/POST/PATCH/DELETE /api/super/users`, `POST /api/super/users/{id}/password`, `GET /api/super/stats`, `POST /api/super/rotate-token/{type}/{id}`.

### Content Studio for DJs (Sprint 1 — Feb 2026) ✅
- **Auth**: shared `/login`, role-based redirect — admins → `/admin`, DJs → `/dj`. Demo DJ seeded: `dj@radiolatina.fm / dj123` linked to first host (`host_slug` field on user).
- **AI generation**: POST `/api/dj/generate` → Claude Sonnet 4.5 via `emergentintegrations` (uses `EMERGENT_LLM_KEY`). System prompt enforces format `[CAPTION] / [HASHTAGS] / [CTA]` in Spanish. Per-template instruction injected.
- **8 transformative templates** (copyright-safe reposts): `today_in_history`, `hot_take`, `throwback`, `poll`, `behind_scenes`, `important_day`, `inspirational_quote`, `musical_recommendation`. GET `/api/dj/templates` exposes label/emoji/fields (instruction kept server-side only).
- **Drafts CRUD**: POST/GET/PATCH/DELETE `/api/dj/drafts`. DJs see only their `host_slug`; admin sees all. Status enum: `draft | scheduled | published`. Optional `scheduled_at` for editorial calendar.
- **Variant tones (Feb 2026 enhancement)**: `/api/dj/generate` accepts optional `variant_tone` ∈ {`casual`, `motivational`, `shorter`, `emotional`}. Frontend exposes 4 one-click buttons inside the editor that regenerate the same prompt+inputs with a different tone — DJ can spin one idea into 5 variants for a week of content.
- **Frontend**: `/dj` shows DJ greeting + drafts list + monthly calendar view. Composer modal: pick template → fill inputs → generate → edit textarea → save. Copy-to-clipboard + status pills + platform selector (IG/FB/TikTok/X).
- **Tests**: `/app/backend/tests/test_content_studio.py` (19/19 pass, 2 real LLM calls).

## Backlog
### P1
- Visual Weekly Schedule Grid for Advertisers in Admin
- Add `owner_email` field to AdminAdvertiserForm/AdminEventForm with copy-link button inline
- Content Studio Sprint 2: UGC Inbox (permission flow), gamified DJ missions (points/streaks), banco de "Días Importantes"
- Server-side validation of required template fields in /api/dj/generate (currently only frontend)
- Per-user rate limit on /api/dj/generate (e.g. 30/hour) to prevent LLM abuse

### P2
- Content Studio Sprint 3: Auto-Share Kit + métricas de tráfico social
- "Compartir" button on event cards (native share sheet)
- Stripe-powered self-serve advertiser portal
- Reorder gallery images (drag & drop)
- Token rotation: `POST /admin/{type}/{id}/rotate-token`
- Mongo aggregation pipeline for analytics (currently in-memory aggregation)
- Rate limiting on `/api/track`
- Refactor server.py (~1460 lines) into routers (auth, advertisers, events, hosts, analytics, dj, settings, files)
- Replace native date/time pickers with shadcn Calendar in AdminEventForm
- Pagination on `/api/dj/drafts` (currently `to_list(500)`)
- Tighten ContentDraft.status as `Literal['draft','scheduled','published']`

## Key Files
- `/app/backend/server.py` — all API
- `/app/backend/tests/test_radio_api.py`, `test_events_rotation.py`, `test_tracking_analytics.py` — pytest 60+ tests passing
- `/app/frontend/src/components/SmartCTA.jsx` — floating popup with tracking
- `/app/frontend/src/components/ReportDashboard.jsx` — shared analytics UI
- `/app/frontend/src/pages/AdminDashboard.jsx` — 5-tab admin including ReportsTab
- `/app/frontend/src/pages/EventoLanding.jsx` — event landing
- `/app/frontend/src/pages/ReportePublic.jsx` — public report
- `/app/frontend/src/lib/tracking.js` — track() helper

## Test Credentials
See `/app/memory/test_credentials.md` (admin@radiolatina.fm / admin123).

## Changelog — Feb 22, 2026

### DJ Studio — 5 plantillas locales nuevas (Sprint A)
Total ahora: 13 plantillas (8 originales + 5 locales).
- 🎂 `birthday_shoutout` — Cumpleaños / Saludo (nombre, ocasión, de parte de, ciudad)
- 🛒 `local_business` — Negocio del Día (nombre, qué hacen, ciudad, historia)
- 🍳 `abuela_recipe` — Receta de la Abuela (platillo, región, secreto)
- 🙏 `saints_calendar` — Día Santo / Efeméride (día, tradición, mensaje)
- 🌽 `farm_voice` — La Voz del Campo (tema, mensaje clave, recurso)

Cada plantilla incluye su `SUGGESTION_PROMPT` ajustado al Pacífico NW (Dallas/Salem/Woodburn) y comunidad agrícola.
- ✅ `/api/dj/templates` ahora devuelve 13 entries — verificado.
- ✅ Probado generación real con Claude (birthday_shoutout) — texto en español con Las Mañanitas, geo local correcto.
- ✅ Probado sugerencias (local_business) — 10 ideas concretas (taquerías Woodburn, carnicerías Salem, etc.).
- Frontend lee plantillas dinámicamente de `/api/dj/templates` — cero cambios en React.

## Changelog — Feb 21, 2026

### DJ Studio Image Generation — OpenAI gpt-image-1
- Swapped Gemini Nano Banana → OpenAI `gpt-image-1` via `emergentintegrations` `OpenAIImageGeneration` (uses `EMERGENT_LLM_KEY`).
- Endpoint: `POST /api/dj/generate-image` { draft_id?, prompt?, aspect: wide|square }.
- Returns valid PNG (~1.9MB), stored in Emergent Object Storage at `radio-latina/banners/<uuid>.png`, draft auto-updated with `cover_image`.
- ✅ Tested end-to-end (~15s): login → generate → verify file fetchable → draft updated.
- `build-for-prod.sh` ran successfully, frontend bundle ready for VPS deploy.

## Changelog — Apr 30, 2026

### Seed data export (prod migration)
- Created `/app/deploy/export_seed.sh` so dev DB (hosts/advertisers/events/settings) can be refreshed into `deploy/seed_data/*.json` before pushing to GitHub.
- Re-exported current dev data: 3 hosts, 3 advertisers, 2 events, 1 settings.
- Flow: `bash /app/deploy/export_seed.sh` → Save to Github → on VPS `git pull && bash deploy/import_seed.sh && bash restart.sh`.
- `import_seed.sh` leaves users, dj_drafts, cta_events untouched.

### Global Footer with attribution
- New `/app/frontend/src/components/Footer.jsx` (bilingual ES/EN) with copyright + link to https://uni2mkt.com ("Uni2 Marketing Group").
- Wired into `App.js` — visible on all routes above the sticky RadioPlayer.
- Built for prod via `bash build-for-prod.sh` (fixed `grep -oc` bug in the verification step).

### World Cup Bracket — Visual Tournament Tree (Jun 2026)
- Refactored `/quiniela/bracket` (`QuinielaBracket.jsx`) from a step-by-step knockout wizard into a single interactive **visual tournament tree**.
- Flow: `Tus datos → Grupos → Mejores 3os → Bracket (árbol) → Compartir`.
- **Desktop (≥1024px)**: two-sided bracket converging to a central Final (recursive `renderHalf`, "]" connectors). **Mobile**: rounds stacked vertically (32avos→Final). A single layout is rendered per viewport via a `useIsDesktop()` matchMedia hook (no duplicate DOM/testids).
- Tap a team in any match to advance it; `pickWinner` + `sanitize` auto-populate the next round and cascade-clear downstream picks when an earlier pick changes. Champion banner updates live.
- Backend payload unchanged (`/api/bracket/submit`, mode `pro`, picks_quick + picks_pro).
- Fixed a build blocker: the `emergentbase-visual-edits` babel plugin stack-overflowed on a self-referencing recursive JSX component — solved by converting it to a plain recursive function (`renderHalf`).
- Validated end-to-end by testing agent (iteration_7); rebuilt prod bundle via `bash build-for-prod.sh`.
- **Fix share que no funcionaba en prod (Jun 2026)**: Usuario reportó que el share no mostraba imagen y "copiar link" no copiaba nada. Causas/arreglos: (1) **Pillow faltaba en `deploy/requirements.prod.txt`** → en el servidor el endpoint de imagen daba 500; agregado `Pillow` (prod) y `Pillow>=10.0.0` (dev). (2) La fuente usaba ruta Debian inexistente en AlmaLinux → `_og_font` ahora prueba rutas Debian+RHEL y cae a `ImageFont.load_default(size=)` escalable (texto legible en cualquier OS). (3) "Copiar link" ahora tiene fallback (`execCommand`) + un campo de texto visible y seleccionable con la URL (`share-url-input`) para copiar manual. NOTA: requiere desplegar (Save to GitHub + `deploy.sh`, que reinstala deps porque cambió `requirements.prod.txt` y reinicia el backend). El proxy `[P]` del `.htaccess` preserva el Host, así que la URL base funciona aun sin `PUBLIC_BASE_URL`. Usuario reportó que al compartir el bracket no salía vista previa ni decía que era una quiniela del Mundial. Causa: las redes (Facebook/WhatsApp) no ejecutan JS, así que leían `index.html` sin tags OG. Solución backend: (1) `GET /api/bracket/og-image/{id}.png` genera con Pillow una imagen 1200x630 con el CAMPEÓN elegido, dueño del bracket y CTA "Haz tu bracket gratis en La Campeona 880 AM"; (2) `GET /api/bracket/og/{id}` sirve HTML con tags Open Graph/Twitter (título con el nombre, descripción que invita a otros, og:image) y redirige a humanos a `/quiniela/ver/{id}`. El share del frontend ahora usa esa URL OG. Base pública robusta vía `PUBLIC_BASE_URL` (env) → x-forwarded-host → host. Agregados tags OG genéricos a `index.html` para shares del sitio. **PROD requiere `PUBLIC_BASE_URL=https://lacampeona880am.com` en backend .env** (ya está en `deploy/backend.env.production.example`). Verificado en preview: HTML+imagen 200 OK, imagen legible. Usuario reportó "Estados Unidos" apareciendo dos veces (como 1B ganador y como 3°). Causa: al reordenar un grupo después de elegir los mejores terceros, un pick quedaba obsoleto (un equipo que era 3° pasaba a 1°/2° pero seguía guardado como tercero). Fix: (1) `buildR32Matchups` ahora solo usa terceros que SON 3° de su grupo actualmente (`validThirds`); (2) un `useEffect` reconcilia `bestThirds` cuando cambian los grupos, descartando picks inválidos y manteniendo el conteo 8/8 real. Verificado con unit test (`/tmp/unit_bracket.js`): escenario contaminado → 0 duplicados; escenario legítimo (3° real) y normal → 32/32 sin duplicados. Build de prod recompilado. Replaced the naive sequential R32 pairing with the REAL FIFA/Fox Sports Round-of-32 slot layout. The 16 slots are defined by group position (1A–1L winners, 2A–2L runners-up, and 8 best thirds restricted to FIFA's allowed-group sets per slot, e.g. `1A vs 3(CEFHI)`, `1F vs 2C`, `2A vs 2B`). Best-thirds are assigned to their valid slots via a Kuhn bipartite-matching algorithm (`buildR32Matchups` / `matchThirdsToSlots`). Each R32 match now shows the official seed code badge (1A / 2C / 3°). Verified: all 16 matchups resolve to the correct teams, thirds respect allowed groups, full advance → champion + submit works (backend scoring is set-based, unaffected). Source: foxsports.com FIFA 2026 bracket.


### Bracket share-link + Hero logos fix (Jun 8 2026)
- **P0 enlace de compartir vacío al refrescar**: el objeto `submission` (con el `id` del bracket) no se persistía en `localStorage`, así que un `Ctrl+Shift+R` en el paso "Compartir" lo borraba y el campo `share-url-input` quedaba vacío. Fix en `QuinielaBracket.jsx`: todo el estado del wizard ahora se **lazy-inicializa desde `localStorage` (`loadSaved()`)** incluyendo `submission`, y `submission` se incluye en el efecto de guardado. Se eliminó el `useEffect` de hidratación (que disparaba el lint `react-hooks/set-state-in-effect`, regla NO soportada por el eslint de CRA → rompía la compilación con comentarios `eslint-disable`). El filtrado de "terceros obsoletos" se movió de un `useEffect` a la función `moveTeam`. Verificado por screenshot: tras refrescar en review, el link muestra `.../api/bracket/og/<id>` y no hay overlay de error. Lint limpio + CRA compila.
- **Logos del hero desaparecían**: el `DefaultHero` (sin locutor al aire), el Navbar y el RadioPlayer dependían de URLs externas frágiles de `customer-assets.emergentagent.com`. Se **descargaron los 2 logos a `frontend/public/logos/`** (`la-campeona-880am.png`, `la-campeona-fuego-1039fm.png`) y se referencian con rutas locales (`/logos/...`) → se empaquetan en `frontend/build` y se sirven desde el dominio propio, sin depender del CDN de Emergent. Build de prod recompilado (verificado: logos presentes en `build/logos/` y referenciados en el bundle).


### Bracket completo descargable + compartible como imagen (Jun 8 2026)
- Nuevo componente `frontend/src/components/BracketExportCard.jsx`: tarjeta de ancho fijo (1260px, estilos inline) que dibuja el árbol completo **Octavos → Cuartos → Semis → Final** (16→1) en dos lados convergiendo al campeón, con marca de La Campeona (logo local, 880 AM·103.9 FM, campeón en dorado, ganadores en verde, 3er lugar, footer con dominio).
- En `QuinielaBracket.jsx` (StepReview): se agregó `html-to-image` para generar un PNG del bracket. Botones **"Descargar imagen"** (`bracket-download-img`) y **"Compartir imagen"** (`bracket-share-img`). Compartir usa `navigator.share({files})` en móvil (menú nativo con la imagen) y cae a descarga en escritorio. La tarjeta exportable se renderiza fuera de pantalla (`bracket-export-wrapper`). Se pasan `r32/r16/qf/sf/finalPicks` a StepReview.
- Verificado en preview: la tarjeta renderiza el árbol completo correctamente y la descarga dispara el PNG con toast de éxito.

### OG share: fix imagen no aparecía en Facebook (Jun 8 2026)
- El crawler de Facebook seguía la redirección de `/api/bracket/og/{id}` hacia `/quiniela/ver/{id}` (SPA) y leía los tags genéricos del `index.html`. Fix en `server.py` (`bracket_og`): detección de user-agent de crawlers (facebookexternalhit, whatsapp, twitterbot, etc.) → se les sirve SOLO los tags OG del bracket SIN redirección; los humanos sí se redirigen. `og:url` ahora apunta al propio endpoint OG (self) en vez del view. Verificado con curl (UA Facebook trae og:title del bracket + og:image, sin script de redirect).
- También: botón "Hacer otro bracket" (`bracket-start-new`) que limpia localStorage y reinicia el wizard; botón "Compartir mi bracket" nativo con fallback a copiar; `.htaccess` con cache-control no-cache para `index.html` (arregla "funciona en incógnito pero no en Chrome normal"); `deploy/restart-backend.sh` + `deploy.sh` reforzado para garantizar reinicio del backend.

### Mundial: calendario rolling + Quiniela movida al Mundial + WhatsApp sin prefill (Jun 15 2026)
- **WhatsApp número**: `station_whatsapp` cambiado a `19712279207` en prod vía API admin (en vivo, sin deploy) y en `DEFAULT_SETTINGS` (server.py). Todos los botones de la estación lo usan.
- **WhatsApp sin mensaje pre-escrito**: se quitó el prefill de los botones de contacto al locutor/estación (`HostHero.jsx` "Mándale WhatsApp" y `Home.jsx` stationWa) → ahora abren chat en blanco. Se conservó el prefill en botones de anunciantes (ROI) y patrocinios Mundial.
- **Mundial calendario**: nueva `filterUpcoming(matches, 4)` en `Mundial.jsx` → muestra solo hoy + próximos 3 días (ancla a `max(today, primerPartido)` para no quedar vacío antes del torneo). Estado vacío manejado. Encabezado: "Próximos partidos / Hoy y los próximos días".
- **Quiniela fuera del menú**: removidos `nav-quiniela-link` y `nav-mobile-quiniela` de `Navbar.jsx`. Agregada sección Quiniela dentro de `Mundial.jsx` con CTAs `mundial-quiniela-cta` (→/quiniela/bracket) y `mundial-leaderboard-cta` (→/quiniela/leaderboard). La ruta /quiniela sigue activa.

### Mundial: calendario completo (104) + Añadir a calendario .ics (Jun 15 2026)
- Nuevo `frontend/src/data/worldCupMatches.js` (auto-generado por `/app/scripts/gen_wc_matches.py`): los **104 partidos** del Mundial 2026 (72 grupos con equipos/sedes reales + 32 eliminatorias con marcadores "1°A vs 2°B"/"Por definir"). Kickoff guardado en ET (-04:00); se muestra en hora de Oregon. `staticContent.js` ahora re-exporta WORLD_CUP_MATCHES desde ahí.
- `Mundial.jsx`: `fmtDate/fmtTime` fuerzan `timeZone America/Los_Angeles` (PDT). Toggle `toggle-all-matches` (Próximos ↔ Calendario completo 104). Botón `add-calendar-{id}` por partido → genera `.ics` (iOS/Android) con recordatorio **30 min** antes (VALARM TRIGGER -PT30M), sede, y link de vuelta a la webapp (window.location.origin) para escuchar. Estado vacío manejado.
- Verificado en preview: 16 botones en vista próximos, 104 al ver todos, descarga .ics disparada.

### Mundial: "Añadir TODOS los partidos de tu selección" (Jun 15 2026)
- En `Mundial.jsx`: tarjeta verde con `<select>` (`team-select`, 48 selecciones de fase de grupos) + botón `add-team-matches-btn`. Genera UN `.ics` con todos los partidos de la selección elegida (recordatorio 30 min + link a la app). Helpers refactorizados: `matchVevent()` + `downloadIcs()` reutilizables; `addTeamMatchesToCalendar(team)`; constante `SELECTION_TEAMS`. Horarios ya en formato 12h AM/PM. Verificado: descarga `<slug>-mundial2026.ics` + toast con conteo.

### Weekly Ads auto-scraper para anunciantes (Jun 16 2026)
- **Objetivo**: mostrar las ofertas semanales de clientes (ej. Mega Foods) automáticamente, sin subirlas a mano.
- **Modelo**: `AdvertiserIn.weekly_ad_url` (URL externa de ofertas). Cache en `advertiser.weekly_ad_cache` = {ok, date_range, images[], pdf_url, source_url, fetched_at}.
- **Scraper** `_scrape_weekly_ad(url)` (requests + BeautifulSoup): extrae rango de fechas (regex), primer link `.pdf`, e imágenes grandes del folleto (excluye `bgImage`, fondos `BG_*`, logos/iconos; dedupe de transforms Wix). Genérico (funciona con páginas tipo Wix).
- **Endpoints**: `GET /api/advertisers/{slug}/weekly-ad` (público, lazy-refresh con TTL 6h; no sobreescribe cache buena con un fallo); `POST /api/admin/advertisers/{aid}/weekly-ad/refresh` (admin, force). Cache se invalida al cambiar la URL en el update.
- **Frontend**: `AdminAdvertiserForm` → campo "URL del Weekly Ad" + botón "Actualizar ahora" (modo edición). `AdvertiserDetail` → sección "🛒 Especiales de la semana" con rango de fechas + imágenes del folleto **apiladas (una arriba/otra abajo, full width)** + "Descargar PDF" + "Ver en su sitio". Fetch separado para no bloquear la página.
- **Deps**: `beautifulsoup4` agregado a `backend/requirements.txt` y `deploy/requirements.prod.txt`.
- Verificado con Mega Foods (real): detectó "6/10/2026 - 6/16/2026", 2 imágenes + PDF; ficha renderiza correctamente (imágenes 910px apiladas). Build prod recompilado.


### DJ Self-Service: Hero + Programas por día (Jun 16 2026)
- **Nueva pestaña "Mi Perfil"** en el DJ Studio (`/dj/perfil`, `DjProfilePage.jsx`). Cada DJ ve/edita SOLO su propio locutor (resuelto por `host_slug`). El **nombre del locutor y la asignación siguen siendo admin-only**.
- **Campos editables por el DJ**: foto (subida vía nuevo `POST /api/dj/upload`), nombre del programa general (`show_name`), eslogan, bio, teléfono, WhatsApp, Facebook, Instagram, color.
- **Programas por franja**: se agregó el campo `program` a `HostScheduleSlot`. Cada franja (día + hora) tiene su propio nombre de programa (ej. Lunes "Top 40 con la Jarochita", Martes "Cuenta tu Chisme"). El DJ agrega/edita/borra franjas en `/dj/perfil`.
- **Hero dinámico**: `resolve_live_host` inyecta `current_program` (programa de la franja que cubre la hora actual, tz de la estación). `HostHero.jsx` muestra `current_program || show_name`, así el hero cambia solo según día/hora. En vivo: StationContext hace polling de `/live-host` cada 30s + `loadLiveHost()` al guardar.
- **Endpoints nuevos**: `GET /api/dj/host`, `PUT /api/dj/host` (payload restringido `DjHostUpdate`, sin name/slug), `POST /api/dj/upload`. Refactor: `_save_upload()` compartido admin+DJ.
- **Paridad admin**: `AdminHostForm` también edita `program` por franja; `WeeklyScheduleGrid` muestra el programa de cada franja.
- Verificado: GET/PUT host por curl; hero en vivo muestra "Top 40 con la Jarochita" (Lun 18:00–20:00); flujo editar+guardar+persistir por screenshot. Build de prod recompilado.

### Fix deploy prod: feedparser faltaba (Jun 16 2026)
- `feedparser` estaba solo en `backend/requirements.txt`, pero prod instala desde `deploy/requirements.prod.txt` → `ModuleNotFoundError` en el servidor. Agregado `feedparser` a `deploy/requirements.prod.txt` (el cambio de hash hace que `fix.sh` reinstale deps).


### Fase de grupos con puntos/goles + 8 mejores terceros automáticos (Jun 22 2026)
- **Pedido**: que el admin pueda capturar puntos y goles reales en la fase de grupos para que el sistema ordene los grupos y calcule solo a los 8 mejores terceros (criterios FIFA).
- **Backend**: nuevo campo `group_stats: dict` en `BracketOfficialResults` ({ gid: { team: {pts, gf, ga} } }) + expuesto en `GET /api/bracket/official`.
- **Frontend** (`AdminResultsBracket.jsx` reescrito): la pestaña "Fase de grupos" ahora tiene inputs PTS/GF/GC por equipo. El componente DERIVA en vivo: (1) standings de cada grupo ordenados 1º→4º por puntos→diferencia de goles→goles a favor; (2) ranking de los 12 terceros y selección automática de los 8 mejores (`bestThirds`); (3) `r32Matchups` vía `buildR32Matchups`. La pestaña "Mejores 3os" muestra el ranking de terceros con badge "Clasifica/Eliminado". Las eliminatorias siguen marcándose a mano. Un `useEffect` re-sanea los picks de eliminatorias cuando cambian las posiciones. Al guardar, envía group_stats + group_positions (derivado) + best_thirds (derivado), así el scoring no cambia. Testids: `group-stats-{gid}`, `stat-{gid}-{team}-{pts|gf|ga}`, `third-rank-{i}`.
- Verificado end-to-end: capturar stats reordena el grupo (Chequia 9pts → 1º), calcula los 8 mejores terceros, guarda y persiste en `/bracket/official`. Build prod `main.e9114381.js`.

### Banderas reales + leyenda de terceros en el bracket en vivo (Jun 22 2026)
- Reemplazados los emojis de bandera por imágenes reales (flagcdn) con bandera→nombre (se ven igual en Windows). Mapa `ISO` nombre→código en `LiveBracket.jsx`.
- Etiquetas de siembra más legibles: `1º E`, `2º C`, `3º · A·B·C·D·F`. Leyenda explicativa "¿Cómo entran los 8 mejores terceros?" (criterios FIFA).
- Layout del bracket apilado (Lado izquierdo arriba, Lado derecho abajo, Final al final) y ancho alineado a `max-w-6xl` para que el anuncio flotante no tape los partidos. Sin auto-refresh (carga al entrar) por petición del usuario.

### Bracket EN VIVO público en la página del Mundial (Jun 22 2026)
- **Pedido del usuario**: un bracket visual (estilo Mediotiempo, tema oscuro con banderas) en la sección del Mundial que muestre EN VIVO lo que el admin va marcando, para que los oyentes lo vean actualizado.
- **Backend**: nuevo endpoint público `GET /api/bracket/official` → `{groups, results}` con los resultados oficiales (group_positions, best_thirds, r32/r16/qf/sf_winners, champion, runner_up, semi_finalists, third_place_winner, top_scorer, marcador). Solo lectura, sin auth.
- **Frontend**: nuevo `components/LiveBracket.jsx` — bracket de SOLO LECTURA. Tema oscuro, 12 tarjetas de grupos con banderas (mapa nombre→bandera derivado de `WORLD_CUP_MATCHES`), árbol de dos lados convergiendo a la Final (desktop) / rondas apiladas (móvil), códigos de posición (1E, 2A, 3 ABCDF…) en slots sin resolver y equipos con bandera + resaltado del ganador (verde) y Final en dorado. Banner de campeón. **Auto-refresh cada 60s** (`setInterval`) para que sea "al momento". Insertado en `Mundial.jsx` como sección `mundial-live-bracket-section` antes de la sección de la Quiniela.
- **Reutilización**: `QuinielaBracket.jsx` ahora también exporta `R32_SLOTS` y `useIsDesktop`. El bracket en vivo usa `buildR32Matchups` + `R32_SLOTS` para resolver enfrentamientos y etiquetas de siembra.
- Verificado por screenshot (desktop + móvil): renderiza grupos con banderas, árbol con códigos y ganadores resaltados. Se llena conforme el admin guarda resultados en `/admin/bracket`. Build de prod recompilado (`main.e7c807c2.js` → `main.65770353.js`).

### Bracket de Admin visual — resultados ronda por ronda (Jun 21 2026)
- **Problema**: el panel `/admin/bracket` solo dejaba ingresar los resultados FINALES (campeón, subcampeón, semifinalistas, goleador, marcador). Los participantes en modo "pro" predicen el bracket completo (quién avanza en 32avos/octavos/cuartos/semis), pero esos puntos NUNCA se sumaban porque el admin no tenía dónde ingresar los ganadores oficiales por ronda. El backend (`_score_prediction`, modelo `BracketOfficialResults`) YA soportaba todos esos campos.
- **Solución**: nuevo componente `frontend/src/pages/AdminResultsBracket.jsx` — constructor VISUAL de resultados oficiales (reutiliza el árbol del bracket público). Pestañas: Grupos (1º/2º/3º) → Mejores 3os → Eliminatorias (árbol). El admin marca al ganador REAL de cada partido y da "Guardar y recalcular" → `PUT /api/bracket/admin/results` con group_positions/best_thirds/r32/r16/qf/sf_winners/third_place_winner + finales, y `_recalculate_all_scores` reparte los puntos por ronda (32avos +2, octavos +3, cuartos +5, semis +8, grupos, terceros). Guardado parcial permitido (se puede ir actualizando conforme avanza el torneo).
- **Refactor de reutilización**: `QuinielaBracket.jsx` ahora EXPORTA `StepGroups`, `StepThirds`, `StepBracket`, `buildR32Matchups`, `R32_LABELS`, `EMPTY_FINAL`. `AdminBracket.jsx` integra `<AdminResultsBracket>` y elimina el formulario manual viejo (testids `admin-r-*` removidos). Nuevos testids: `admin-results-bracket`, `admin-bracket-step-{groups|thirds|bracket}`, `admin-bracket-save`, `admin-bracket-reset`.
- Verificado por testing agent (iteration_8): 11/11 tests backend; prueba completa pro-mode → bracket perfecto gana ≥200 pts y aparece en leaderboard; frontend renderiza, guarda y recalcula la tabla de participantes. Build de prod recompilado (`main.5989bb90.js` → `main.e7c807c2.js`).

### Fix: quiniela mostraba grupos viejos por localStorage (Jun 21 2026)
- **Síntoma**: tras corregir el `WORLD_CUP_2026_GROUPS` (backend) y redesplegar, el usuario seguía viendo los grupos viejos en la quiniela. Verificado que producción ya servía los 12 grupos oficiales en `/api/bracket/meta` (backend ✅) y que el build ya los incluía (frontend ✅). El usuario notó que su `git pull` no mostraba cambios de frontend en los últimos deploys — porque los cambios eran solo de backend (los grupos viven en la API).
- **Causa raíz**: `QuinielaBracket.jsx` lazy-inicializa el wizard desde `localStorage` (`lc_bracket_progress`). El efecto que carga `/api/bracket/meta` solo sembraba los grupos oficiales `if (!saved.groupPositions)`. Quien ya había empezado una quiniela con grupos viejos los tenía en `localStorage` y la app NUNCA los actualizaba aunque el sorteo cambiara.
- **Fix**: el efecto ahora compara la firma de membresía por grupo (sets de equipos, order-agnostic) entre lo guardado y lo oficial. Si difieren (el sorteo cambió), resetea `groupPositions` a lo oficial y limpia picks downstream (`bestThirds/r32/r16/qf/sf/finalPicks`). Reordenar equipos dentro de un grupo NO dispara reset (es la predicción del usuario). Auto-cura a TODOS los oyentes con quiniela vieja guardada.
- Verificado por screenshot en preview: localStorage sembrado con Grupo A = Italia/Ghana/Polonia/Egipto → tras recargar se reseteó a México/Sudáfrica/Corea del Sur/Chequia. Build de prod recompilado (`main.1f762279.js` → `main.5989bb90.js`).
- **Predicciones viejas (`bracket_predictions`)**: el usuario decidió DEJARLAS (se guardan por email; quien reenvíe con el mismo correo sobreescribe la suya). No se borró nada.

### Compartir nativo + Plantilla "Noticia" con búsqueda real (Jun 16 2026)
- **Fix OG de Blog Posts (P0)**: en `Post.jsx` los botones WhatsApp/Facebook usaban `publicUrl` (URL SPA genérica) en vez de `ogShareUrl`. Ahora apuntan a `/api/posts/og/{slug}` → Facebook/WhatsApp muestran título, extracto e imagen del post. Verificado por curl (UA facebookexternalhit) + screenshot.
- **Botón "Compartir" nativo (`navigator.share`)**: nuevo helper `frontend/src/lib/share.js` (`sharePost`) que comparte la URL OG con fallback a copiar al portapapeles. Añadido a: tarjetas del Blog (`blog-share-{slug}`), nueva sección "Lo último del blog" en Home (`home-blog-teaser` + `home-blog-share-{slug}`), y botón `post-share-native` en la página del post. En móvil abre el menú nativo (WhatsApp/IG Stories), en escritorio copia el link.
- **Nueva sección Home `BlogTeaser`**: trae `/posts/recent?limit=3` y muestra tarjetas compartibles (impulsa tráfico social → web). Categoría "Noticias" agregada al filtro del Blog.
- **Plantilla DJ "Noticia" (`news_repost`)**: 18ª plantilla en `CONTENT_TEMPLATES`. Campos: titular (req), fuente, ángulo. Instrucción refuerza línea editorial (sin política, inmigración ni temas religiosos polémicos).
- **Búsqueda de noticias reales**: nuevo `POST /api/dj/news-search` (auth DJ) → Google News RSS (`hl=es-419&gl=US`, `when:7d`), parseado con `feedparser` en thread (`asyncio.to_thread`). Filtra contra `NEWS_BLOCKLIST` (política/inmigración/violencia) y limpia el sufijo "- Fuente" del título. Categorías preset: farándula, música, deportes, local (Oregon), internacional, entretenimiento. Sin API keys.
- **UI Composer**: cuando la plantilla es `news_repost`, el editor muestra el panel `dj-news-panel` (chips de categoría + búsqueda libre + resultados clickeables que generan el post al instante con `pickNews`) en lugar del panel de "10 ideas" de Claude. `feedparser==6.0.12` agregado a requirements.
- Verificado: templates=18 incluye news_repost; búsquedas devuelven titulares limpios; generación con Claude respeta tono editorial; flujo UI completo por screenshot. Build de prod recompilado.
