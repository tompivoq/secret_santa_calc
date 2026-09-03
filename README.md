# Secret Santa Calculator

A single-page app that takes a list of people and randomly assigns each one
a secret santa (someone else on the list) to give a gift to.

The frontend talks to a small backend API ([server/](server)) which persists
people and their pairings in a SQLite database — so the list survives a
refresh, a browser restart, or a different device hitting the same server.

## Stack

**Frontend**

- React + TypeScript
- [Vite+](https://viteplus.dev) — unified toolchain (Vite, Vitest, oxlint, oxfmt)
- Redux Toolkit Query — talks to the backend API ([src/store/peopleApi.ts](src/store/peopleApi.ts));
  RTK Query's own cache is the only client-side state, no `localStorage`
  involved anymore

**Backend** ([server/](server) — a separate npm project)

- [Hono](https://hono.dev) — lightweight HTTP framework, running on
  [@hono/node-server](https://github.com/honojs/node-server)
- [Drizzle ORM](https://orm.drizzle.team) + `better-sqlite3` — one `people`
  table; migrations live in `server/src/db/migrations`
- [Zod](https://zod.dev) — request body validation

## Development

Run the frontend and backend in two terminals:

```bash
# Terminal 1 — backend API on http://localhost:3001
cd server
npm install
npm run dev

# Terminal 2 — frontend dev server; proxies /api to the backend above
npm install
npm run dev
```

The database file is created at `server/data/db.sqlite` on first run
(migrations apply automatically on startup).

## Build

```bash
npm run build
npm run preview
```

For the backend:

```bash
cd server
npm run build   # compiles to server/dist
npm start       # runs the compiled server (reads PORT / DATABASE_PATH env vars)
```

## Checks

```bash
npm run lint   # oxlint
npm test       # vitest
npx vp check   # format + lint + type-check together
```

The backend has its own test suite (`cd server && npm test`), run separately
from the frontend's — it exercises the reciprocal-partner-linking logic
against a real (in-memory) SQLite database.
