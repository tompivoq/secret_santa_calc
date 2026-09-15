# Secret Santa Calculator

A single-page app that takes a list of people and randomly assigns each one
a secret santa (someone else on the list) to give a gift to.

The frontend talks to a small backend API ([server/](server)) which persists
people and their pairings in a SQLite database — so the list survives a
refresh, a browser restart, or a different device hitting the same server.

Each person gets a login (`/login`, `/account`) where they see the one
person they're giving to — and nobody else's. Creating a person generates
an initial password, shown once to whoever added them; they're required to
replace it the first time they log in, unless they arrive by emailed login
link instead, which retires it for them.

The admin runs the draw from `/`: pick who's taking part, run it, re-roll
until happy, then lock it in. A locked draw is immutable history, which is
also how the next one knows not to repeat last year's pairings. By default
the pairings are withheld from the admin too, so they can take part
without spoiling their own match, and the server enforces that rather than
the page merely not rendering them. Locking in unlocks the last step:
emailing everyone a single-use link straight to their own match.

## Stack

**Frontend**

- React + TypeScript
- [Vite+](https://viteplus.dev) — unified toolchain (Vite, Vitest, oxlint, oxfmt)
- [React Router](https://reactrouter.com) — routes between managing people
  (`/`), person login (`/login`), and a signed-in person's account (`/account`)
- Redux Toolkit Query — talks to the backend API
  ([src/store/peopleApi.ts](src/store/peopleApi.ts),
  [src/store/authApi.ts](src/store/authApi.ts)); RTK Query's own cache is
  the only client-side state, no `localStorage` involved

**Backend** ([server/](server) — a separate npm project)

- [Hono](https://hono.dev) — lightweight HTTP framework, running on
  [@hono/node-server](https://github.com/honojs/node-server)
- [Drizzle ORM](https://orm.drizzle.team) + `better-sqlite3` — `people`,
  `credentials` (one login per person), and `draws`/`assignments` (one row
  per run of the draw, and who gives to whom within it); migrations live
  in `server/src/db/migrations`
- [Zod](https://zod.dev) — request body validation
- Sessions are JWTs (`hono/jwt`) in an httpOnly cookie; passwords are
  hashed with Node's built-in `scrypt` — no extra auth dependency needed
  for either. The signing secret comes from the `AUTH_SECRET` env var, or
  is generated once and persisted next to the database if unset.

## Development

Install dependencies in both projects once:

```bash
npm install
cd server && npm install && cd ..
```

Then start both with a single command:

```bash
npm run dev:all
```

This runs the frontend (`http://localhost:5173`, proxying `/api` to the
backend) and the backend (`http://localhost:3001`) together, with each
line prefixed `[frontend]`/`[backend]`; `Ctrl-C` stops both.

To run them separately instead — useful if you want each one's output in
its own terminal — `npm run dev` in each project does the same thing
`dev:all` runs under the hood:

```bash
# Terminal 1 — backend API on http://localhost:3001
cd server
npm run dev

# Terminal 2 — frontend dev server; proxies /api to the backend above
npm run dev
```

The database file is created at `server/data/db.sqlite` on first run
(migrations apply automatically on startup). Dev builds also seed a
fixed-password admin account (`admin@dev.local` / `devpassword`, logged
to the console on startup) so there's always something to log in as
locally — this never runs in production (gated on `NODE_ENV`, the same
variable the deployed systemd service sets).

## Build

```bash
npm run build
npm run preview
```

For the backend:

```bash
cd server
npm run build   # compiles to server/dist
npm start       # runs the compiled server (see the env vars below)
```

## Server environment variables

All optional in development — the server runs without any of them, and
says what it's falling back to.

| Variable         | Purpose                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `PORT`           | Port to listen on. Defaults to 3001.                                      |
| `DATABASE_PATH`  | SQLite file. Defaults to `./data/db.sqlite`.                              |
| `AUTH_SECRET`    | JWT signing secret. Generated and persisted beside the database if unset. |
| `APP_BASE_URL`   | How the app is reached from outside — what emailed login links point at.  |
| `RESEND_API_KEY` | Resend API key, for sending match emails.                                 |
| `MAIL_FROM`      | Sender address on those emails, e.g. `Julenissen <santa@example.com>`.    |

`APP_BASE_URL` has no sensible default for a deployed service, so set it
to wherever the app actually answers, including any path prefix. It's used
both to build magic-link URLs and to redirect back into the app after one
is followed — get it wrong and the links go somewhere that isn't the app.

With `RESEND_API_KEY` or `MAIL_FROM` missing, emails are written to the
log instead of being sent, and every send says so. That keeps local
development working without credentials, but it means a misconfigured
production service quietly sends nothing — so check the startup log after
changing either.

**`RESEND_API_KEY` is a secret and must not be committed.** On the home
server it lives in an environment file outside the repo, readable only by
the account the service runs as, and is loaded by the systemd unit:

```bash
# On the server, as the account running the service:
install -m 600 /dev/null ~/secret_santa_api.env
$EDITOR ~/secret_santa_api.env        # RESEND_API_KEY=..., MAIL_FROM=..., APP_BASE_URL=...

# Then, in the [Service] section of the unit:
#   EnvironmentFile=%h/secret_santa_api.env
systemctl --user daemon-reload && systemctl --user restart secret-santa-api
```

`install -m 600` creates the file already locked down, rather than
creating it world-readable and narrowing it afterwards. Nothing in this
repo reads that file — the service inherits the variables from systemd —
so there's no path by which the key reaches git.

## Checks

```bash
npm run lint   # oxlint
npm test       # vitest
npx vp check   # format + lint + type-check together
```

The backend has its own test suite (`cd server && npm test`), run separately
from the frontend's — it exercises the reciprocal-partner-linking logic and
the auth flow (login, session, forced password change) against a real
(in-memory) SQLite database and the actual Hono app.
