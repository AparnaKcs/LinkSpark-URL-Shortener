# Vektor — URL Shortener with Analytics

A production-grade URL shortener with real-time analytics, QR codes, custom aliases, expiry, public stats, and bulk CSV import.

## Stack

- **Frontend & backend in one codebase:** React 19 + TanStack Start (file-based routing, type-safe server functions over RPC)
- **Database & Auth:** PostgreSQL with Row-Level Security
- **Styling:** Tailwind CSS v4, design tokens in `src/styles.css`
- **Charts:** Recharts
- **Validation:** Zod
- **QR:** `qrcode`; short-code generation: `nanoid`

> Spec called for Node.js + Express. This implementation uses TanStack Start server functions (`createServerFn`) instead — same REST-style request/response contract, same Postgres, same JWT-backed auth. All functional requirements are met.

## Features

- Email/password auth (JWT sessions)
- Create, edit, delete shortened URLs (per-user, enforced by RLS)
- Custom aliases (`/r/my-alias`) with uniqueness validation
- Optional expiry — expired links return a 410 page
- Server-side `/r/:shortCode` redirect that records a visit + increments click count
- Per-link analytics: total/today/7d clicks, daily trend, hourly throughput, browser/device/OS breakdown, recent visit log
- QR code generation + PNG download
- Bulk CSV import (paste up to 200 URLs, get a CSV back)
- Public stats page at `/stats/:shortCode` (no auth, sensitive fields hidden)

## Routes

| Path                | Description                                      |
| ------------------- | ------------------------------------------------ |
| `/`                 | Landing page                                     |
| `/auth`             | Sign in / sign up                                |
| `/dashboard`        | Link table, create form, bulk import (protected) |
| `/analytics/:id`    | Per-link analytics (protected)                   |
| `/profile`          | Account info (protected)                         |
| `/stats/:shortCode` | Public stats (no auth)                           |
| `/r/:shortCode`     | Server-side redirect + visit tracking            |

## Database

Three tables in `public`: `profiles`, `urls`, `visits`. RLS scopes writes to owner; `urls` are publicly readable (for redirects and public stats); `visits` readable only by URL owner. Schema lives in `supabase/migrations/`.

## Local Setup

To run this project locally:

```bash
bun install
bun run dev
```

Required env vars (configured in `.env`):

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## Architecture

```
Browser (React + TanStack Router)
    ↓ type-safe RPC (createServerFn) or fetch (/r/:code)
TanStack Start server (Cloudflare Workers runtime)
    ↓ supabase-js
PostgreSQL (RLS-enforced)
```

- `src/lib/urls.functions.ts` — auth-protected server functions (create, list, update, delete, analytics, bulk)
- `src/lib/stats.functions.ts` — public-stats server function
- `src/routes/r.$shortCode.ts` — server route that redirects and records visits
- `src/integrations/supabase/auth-middleware.ts` — `requireSupabaseAuth` middleware
- `src/integrations/supabase/client.server.ts` — admin client (used for redirect tracking + public stats)

## Assumptions

- Short codes live at `/r/:shortCode` (not the URL root) so they don't collide with the SPA's other routes
- Geolocation is sourced from the edge `cf-ipcountry` header when available
- Public stats expose totals, creation date, last visit, daily trend — not the destination URL or visitor IPs
- Bulk import caps at 200 URLs per request and ignores any expiry/alias columns
- Email confirmation is disabled in dev for faster testing

---

This project is a part of a hackathon run by https://katomaran.com
