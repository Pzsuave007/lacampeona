# KWIP La Campeona — PRD

## Original Problem Statement
Modern, mobile-first web app for KWIP La Campeona (880 AM / 103.9 FM) — Spanish radio station from Dallas, Oregon. Focus on engagement and monetization with sticky live radio player, dynamic advertiser system (with scheduling and Smart CTA popups), host/DJ scheduling with dynamic hero, WhatsApp integration, World Cup 2026 schedule page, and an advertiser sales landing page.

## User Language
**Spanish (es)** — all UI copy and agent communication must be in Spanish.

## Core Architecture
- **Frontend**: React + Tailwind + Shadcn UI (mobile-first)
- **Backend**: FastAPI on `/api/*`
- **DB**: MongoDB (users, hosts, advertisers, settings)
- **Storage**: Emergent Object Storage (banners/images)
- **Auth**: JWT (admin only)

## Implemented (as of 2026-02)
- Live radio player streaming KWIP La Campeona (sticky, mobile-friendly)
- Dynamic HostHero — auto-updates by DJ schedule + station timezone (`America/Los_Angeles`)
- Default Hero (when no live host)
- Advanced advertiser scheduling (radio-style: spots/hour, duration_sec, priority 1–10)
- `/api/active` endpoint with timezone-aware evaluation
- SmartCTA floating popup — **mobile-friendly, starts collapsed on mobile** (less invasive)
- Admin Dashboard (3 tabs: Settings, Hosts, Advertisers)
- WeeklyScheduleGrid for Hosts
- File upload to object storage
- Static pages: `/mundial` (World Cup 2026 schedule), `/anuncia` (advertising sales pitch)
- Bilingual (ES/EN, default ES)
- "Anúnciate aquí" CTA in Anunciantes destacados section
- Emergent branding fully removed

## Backlog / Roadmap
### P1
- Visual Weekly Schedule Grid for Advertisers in Admin Dashboard
- Click analytics on SmartCTA actions (calls, WhatsApp, maps) — for ROI reporting

### P2
- Stripe-powered advertiser self-serve portal
- Refactor polling → WebSocket/SSE for real-time updates at scale

## Key Files
- `/app/backend/server.py` — all API
- `/app/frontend/src/components/SmartCTA.jsx` — floating advertiser popup
- `/app/frontend/src/components/HostHero.jsx`, `WeeklyScheduleGrid.jsx`
- `/app/frontend/src/pages/Home.jsx`, `AdminDashboard.jsx`, `Mundial.jsx`, `Anuncia.jsx`
- `/app/frontend/src/contexts/StationContext.js` — polling + active state
- `/app/frontend/src/data/staticContent.js` — Mundial matches + Anuncia pricing (static)

## Test Credentials
See `/app/memory/test_credentials.md`.
