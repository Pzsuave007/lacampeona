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
- `/dj` — **DJ Content Studio** (NEW)

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
