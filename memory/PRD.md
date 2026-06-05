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
- **Fix equipo duplicado en bracket (Jun 2026)**: Usuario reportó "Estados Unidos" apareciendo dos veces (como 1B ganador y como 3°). Causa: al reordenar un grupo después de elegir los mejores terceros, un pick quedaba obsoleto (un equipo que era 3° pasaba a 1°/2° pero seguía guardado como tercero). Fix: (1) `buildR32Matchups` ahora solo usa terceros que SON 3° de su grupo actualmente (`validThirds`); (2) un `useEffect` reconcilia `bestThirds` cuando cambian los grupos, descartando picks inválidos y manteniendo el conteo 8/8 real. Verificado con unit test (`/tmp/unit_bracket.js`): escenario contaminado → 0 duplicados; escenario legítimo (3° real) y normal → 32/32 sin duplicados. Build de prod recompilado. Replaced the naive sequential R32 pairing with the REAL FIFA/Fox Sports Round-of-32 slot layout. The 16 slots are defined by group position (1A–1L winners, 2A–2L runners-up, and 8 best thirds restricted to FIFA's allowed-group sets per slot, e.g. `1A vs 3(CEFHI)`, `1F vs 2C`, `2A vs 2B`). Best-thirds are assigned to their valid slots via a Kuhn bipartite-matching algorithm (`buildR32Matchups` / `matchThirdsToSlots`). Each R32 match now shows the official seed code badge (1A / 2C / 3°). Verified: all 16 matchups resolve to the correct teams, thirds respect allowed groups, full advance → champion + submit works (backend scoring is set-based, unaffected). Source: foxsports.com FIFA 2026 bracket.

