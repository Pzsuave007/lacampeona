# KWIP La Campeona — PRD

## Original Problem Statement
Modern, mobile-first web app for KWIP La Campeona (880 AM / 103.9 FM) — Spanish radio station from Dallas, Oregon. Focus on engagement and monetization with sticky live radio player, dynamic advertiser system (with scheduling and Smart CTA popups), host/DJ scheduling with dynamic hero, WhatsApp integration, World Cup 2026 schedule page, advertiser sales landing page, and an Events system.

## User Language
**Spanish (es)** — all UI copy and agent communication must be in Spanish.

## Core Architecture
- **Frontend**: React + Tailwind + Shadcn UI (mobile-first)
- **Backend**: FastAPI on `/api/*`
- **DB**: MongoDB (users, hosts, advertisers, events, settings)
- **Storage**: Emergent Object Storage (banners/images/flyers)
- **Auth**: JWT (admin only)

## Implemented Features (as of Feb 2026)

### Live Radio
- Sticky radio player streaming KWIP La Campeona (mobile no rounded corners, attached to SmartCTA)
- Player height stable (eq-bars rendered always with opacity toggle, error message moved to absolute)

### Hosts / DJs
- Dynamic HostHero — auto-updates by DJ schedule + station timezone (`America/Los_Angeles`)
- WeeklyScheduleGrid for Hosts in Admin
- Default Hero (when no live host)

### Advertisers (Anunciantes)
- Advanced advertiser scheduling (radio-style: spots/hour, duration_sec, priority 1–10)
- **WEIGHTED ROUND-ROBIN ROTATION** — each advertiser appears `spots_per_hour` times in cycle, sorted by priority desc, time-sliced by `spot_duration_sec`. Cycle length = sum(duration × spots_per_hour). Rotation index = `epoch_seconds % cycle_duration`.
- SmartCTA floating popup — mobile-friendly (collapsed by default, attached to player, full-width edge-to-edge)
- "Anúnciate aquí" CTA in Anunciantes destacados section
- AdminDashboard tab "Anunciantes" with full CRUD

### Events (NEW Feb 2026)
- Event model: title, date, start/end time, location, description, image, ticket_url, category (concierto/promocion/comunidad)
- Public `/eventos` page with cards
- Home teaser section (next 3 upcoming events)
- Auto-hide past events (date < today)
- **Promote as SmartCTA** — events with `promoted_as_cta=true` join the rotation alongside advertisers, with their own priority/spots/duration; promotion window = `promote_from_date` to `event_date`+`end_time` (default: 7 days before event)
- Admin tab "Eventos" with full CRUD (AdminEventForm.jsx)
- Navbar link both desktop + mobile

### Pages
- `/` — Home (HostHero/DefaultHero + Mundial teaser + Events teaser + Advertisers + Community CTA)
- `/eventos` — Events listing
- `/mundial` — World Cup 2026 schedule (static)
- `/anuncia` — Advertising sales pitch (static)
- `/advertisers` — Advertisers list
- `/a/:slug` — Advertiser detail
- `/admin` — Admin dashboard (4 tabs)
- `/login` — Admin auth

## Backlog / Roadmap
### P1
- Click analytics on SmartCTA actions (calls, WhatsApp, maps) for ROI reporting
- Visual Weekly Schedule Grid for Advertisers in Admin

### P2
- Stripe-powered advertiser self-serve portal
- Refactor polling → WebSocket/SSE for real-time updates at scale
- Split server.py into routers (auth, admin, events, advertisers, hosts)
- Replace native date/time pickers with shadcn Calendar in AdminEventForm

## Key Files
- `/app/backend/server.py` — all API
- `/app/backend/tests/test_events_rotation.py` — pytest 22/22 (rotation + events)
- `/app/frontend/src/components/SmartCTA.jsx` — floating advertiser/event popup
- `/app/frontend/src/components/HostHero.jsx`, `WeeklyScheduleGrid.jsx`
- `/app/frontend/src/pages/Home.jsx`, `AdminDashboard.jsx`, `Eventos.jsx`, `AdminEventForm.jsx`
- `/app/frontend/src/contexts/StationContext.jsx` — polling + active state
- `/app/frontend/src/hooks/useEvents.js`, `useAdvertisers.js`, `useHosts.js`
- `/app/frontend/src/data/staticContent.js` — Mundial matches + Anuncia pricing (static)

## Test Credentials
See `/app/memory/test_credentials.md` (admin@radiolatina.fm / admin123).
