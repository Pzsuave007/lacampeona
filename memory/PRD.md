# Radio Latina FM — PRD

## Original Problem Statement
Modern, mobile-first web app for a Spanish radio station focused on engagement and monetization. Sticky live-radio player + dynamic advertiser system that lets staff activate one advertiser at a time so the website (banner, CTA, phone, WhatsApp, directions, landing page) updates instantly across all listeners.

## User Personas
- **Listener (mobile-first)**: tunes in, sees who is currently sponsoring, taps to call / WhatsApp / get directions.
- **Advertiser**: gets a dedicated landing page, contact actions, and time-windowed exposure.
- **Station staff (admin)**: one-click activates an advertiser, schedules slots, edits station settings.

## Core Requirements (static)
1. Sticky live audio player + Now Playing.
2. Dynamic advertiser system — only one active at a time.
3. Per-advertiser landing pages (call, WhatsApp, directions, offer).
4. Smart floating CTA with phone/WhatsApp/maps/landing.
5. WhatsApp deep links with pre-filled "I heard your ad on the radio".
6. Optional schedule (day_of_week + start/end time per advertiser).
7. Default state when no advertiser active.
8. Bilingual ES/EN, mobile-first, vibrant Latino-focused design.

## Architecture
- **Backend**: FastAPI on `:8001` behind ingress at `/api`. MongoDB via MONGO_URL.
- **Frontend**: React 19 + CRA + Tailwind + shadcn-style components, axios with `withCredentials`.
- **Auth**: JWT (HS256) issued as httpOnly cookie + Bearer fallback. Admin seed via env.
- **Storage**: Emergent Object Storage (`integrations.emergentagent.com/objstore`) for banner uploads.

## What's been implemented (2026-04-28)
- JWT auth (login / me / logout) with admin seed (admin@radiolatina.fm / admin123).
- Settings doc (station name, tagline, station whatsapp, stream URL, now playing, default CTA).
- Advertisers CRUD (admin) with embedded schedule slots and unique slug.
- `/api/active` resolver: explicit pin > AUTO+schedule > none.
- Banner upload endpoint + public proxy `/api/files/{path}`.
- Demo seed: 2 advertisers (Café Aroma, El Sabor Latino).
- Frontend: Home (hero, advertiser grid), Advertisers list, Advertiser detail, Login, Admin Dashboard (one-click activate, settings, advertiser CRUD with schedule + upload), bilingual ES/EN toggle, sticky RadioPlayer with vinyl spin + LIVE pulse, floating SmartCTA hidden on /login & /admin.
- Tests: 24/24 backend + 100% frontend critical flows (Playwright via testing agent).

## Backlog
### P0 (next)
- (none — MVP complete)

### P1
- Audience analytics (clicks per CTA per advertiser, day/hour heatmap).
- Multi-admin / role management; brute-force lockout on login.
- iCal-style overlapping schedule conflicts UI in admin.
- Push notifications when an advertiser becomes active (web push).

### P2
- Advertiser self-serve portal (pay-to-play, Stripe).
- Show schedule grid + DJ profiles.
- Listener accounts / favourite advertisers.
- Offline PWA mode with background audio.

## Test Credentials
See `/app/memory/test_credentials.md`.
