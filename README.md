# GPS Attendance App — Next.js Port

This is your Express-based GPS Attendance app ported to **Next.js 14 (App Router)**.
It's a straight structural port, not a rewrite: every endpoint, status code, error
message, and piece of business logic (Haversine distance check, Present/Late
grace-period rule, single-device lock, audit log, bulk import, Excel/PDF export)
works exactly as it did before. The admin/employee HTML/CSS front-ends are
unchanged — they already called the API through relative paths, so they were
copied in as-is.

## What changed structurally

| Before (Express)                  | After (Next.js)                                  |
|-----------------------------------|---------------------------------------------------|
| `server.js` + `express()`         | Next.js dev/prod server (`next dev` / `next start`) |
| `routes/admin.js`, `routes/employee.js` | Individual Route Handlers under `app/api/admin/**/route.js` and `app/api/employee/**/route.js` (one file per endpoint/method, matching Next's file-based routing) |
| `middleware/auth.js` (Express middleware) | `lib/auth.js` — `requireAuth()` / `requireSuperAdmin()` helper functions called explicitly at the top of each route handler (Next route handlers don't chain middleware the way Express routers do) |
| `db/store.js`                     | `lib/store.js` — identical JSON-file store (`db/data.json`), same shape |
| `utils.js`                        | `lib/utils.js` — unchanged |
| inline helpers in `routes/admin.js` (report grouping/filtering) | `lib/reportHelpers.js` |
| inline helper in `routes/employee.js` (own history rows) | `lib/employeeHistory.js` |
| `public/*.html`, `style.css`      | `public/*.html`, `style.css` — copied unchanged; still call `/api/admin/...` and `/api/employee/...` |
| `seed.js`                         | `scripts/seed.js` (`npm run seed`) |
| `GET /health`                     | `app/health/route.js` |
| `GET /` → served `index.html`     | `app/page.js` redirects to `/index.html` |

## Getting started

```bash
npm install
npm run seed   # creates db/data.json with admin / Admin@123 and a demo office
npm run dev    # http://localhost:3000
```

- Employee punch page: `http://localhost:3000/employee.html`
- Admin panel: `http://localhost:3000/admin.html`

For production: `npm run build && npm run start`.

## Notes / things worth knowing

- **Data store is still a JSON file** (`db/data.json`), same as before — fine for
  a prototype, but on most serverless hosts (e.g. Vercel) the filesystem is
  read-only/ephemeral in production, so this **only works reliably for local
  dev or a persistent Node server** (e.g. a VPS, Docker container, or
  `npm run start` on a machine with a writable disk). Swap `lib/store.js` for a
  real database before deploying anywhere serverless.
- `JWT_SECRET` env var works the same as before (falls back to a default dev
  secret — set a real one in production).
- PDF/Excel export routes now buffer the whole file in memory and return it in
  one response instead of streaming to `res` — functionally identical output,
  just built with `NextResponse` since Route Handlers don't expose a raw
  Node `res` stream.
