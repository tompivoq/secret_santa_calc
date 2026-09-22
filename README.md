# Secret Santa Calculator

A web app ("Julenissen") for running a family Secret Santa: an admin keeps
the list of people, draws who gives to whom, and everyone logs in to see
their own match, ask anonymous questions and keep private notes. The
interface is in Danish.

The frontend talks to a small backend API ([server/](server)) that stores
everything in a SQLite database.

## What it does

**People and accounts.** The admin adds people (name, email, phone),
links partners (who are never drawn for each other), and can record who
someone gave to last year if that happened outside the app. Creating a
person generates an initial password, shown once. They must replace it on
their first login, including when they arrive through an emailed link.
Everyone can edit their own name, email, phone and password, but not the
partner or last-year fields, since those shape the draw.

**Invitations.** Before any draw, the admin can email people a login link
so they can get in and choose a password while nothing is at stake. The
people list shows who has been invited and who has logged in.

**The draw** (`/`, admin only). Pick who takes part, run it, re-roll until
happy, then lock it in. A test run shows the pairings. A real draw is
blind: the server withholds the pairings from the admin too, so the admin
can take part without spoiling their own match. The draw avoids last
year's pairings, falling back to allowing them only if the group can't be
matched otherwise. A locked draw is kept as history, which is also how the
next one knows what "last year" was.

**Match emails.** Once locked, the admin emails everyone that their match
is ready, and can see who has been told. The email never names the match.
People who haven't chosen a password yet get a single-use magic link;
everyone else gets a plain link to their account page.

**Anonymous questions** (`/account`). Once the draw is locked, anyone in it
can ask anyone else a short question, for example to plan around dates
before buying tickets. The list marks the asker's match and the match's
partner. Each question can be answered once. The recipient never learns
who asked, nor how the asker relates to them; the server builds their view
without that information. Both sides get a notice email, never the text.

**Private notes** (`/account`). A notepad only its owner can see, with
bold, italic, headings, lists, checklists and links, saved automatically as
you type. Notes are kept across draws. Links are limited to `http(s)` in the
editor and again on the server, and if the same note is edited on two
devices, the app asks which version to keep instead of overwriting.

There is no admin view of anyone's questions, answers or notes.

## Stack

**Frontend**

- React + TypeScript
- [Vite+](https://viteplus.dev) — unified toolchain (Vite, Vitest, oxlint,
  oxfmt)
- [React Router](https://reactrouter.com) — the admin page (`/`), login
  (`/login`), the forced password change (`/change-password`), a person's
  own page (`/account`) and the style guide (`/styleguide`, admin only)
- Redux Toolkit Query — one API slice per backend area in
  [src/store/](src/store). RTK Query's cache is the only client-side state;
  `localStorage` holds nothing but the light/dark theme choice.
- [Tiptap](https://tiptap.dev) — the notes editor, loaded on demand in its
  own chunk so it isn't part of the main bundle
- Tailwind CSS v4, themed through the tokens in
  [src/index.css](src/index.css); `/styleguide` shows every token in both
  themes

**Backend** ([server/](server), a separate npm project)

- [Hono](https://hono.dev) on
  [@hono/node-server](https://github.com/honojs/node-server)
- [Drizzle ORM](https://orm.drizzle.team) + `better-sqlite3`. Tables:
  `people`, `credentials` (one login per person), `draws`/`assignments`
  (each run of the draw and who gives to whom in it), `messages` and
  `notes`. Migrations live in `server/src/db/migrations` and apply
  automatically on startup.
- [Zod](https://zod.dev) — request validation, including the full shape of
  a stored note
- Sessions are JWTs (`hono/jwt`) in an httpOnly cookie; passwords are
  hashed with Node's built-in `scrypt`. The signing secret comes from the
  `AUTH_SECRET` env var, or is generated once and kept next to the database.
- Email goes through [Resend](https://resend.com)'s HTTP API, behind a small
  `Mailer` interface that tests replace with a fake.

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

To run them separately instead, `npm run dev` in each project does what
`dev:all` runs under the hood:

```bash
# Terminal 1 — backend API on http://localhost:3001
cd server
npm run dev

# Terminal 2 — frontend dev server; proxies /api to the backend above
npm run dev
```

The database file is created at `server/data/db.sqlite` on first run.
Dev builds also seed a fixed-password admin account (`admin@dev.local` /
`devpassword`, logged to the console on startup) so there's always
something to log in as locally. This never runs in production: it's gated
on `NODE_ENV`, which the deployed systemd service sets.

Without `RESEND_API_KEY` and `MAIL_FROM` (see below), emails are written to
the backend's log instead of sent, including their login links, which is
how to follow them locally.

## Build

```bash
npm run build     # frontend, into dist/
npm run preview
```

For the backend:

```bash
cd server
npm run build   # compiles to server/dist, migrations included
npm start       # runs the compiled server (see the env vars below)
```

## Server environment variables

All optional in development: the server runs without any of them, and
says what it's falling back to.

| Variable         | Purpose                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `PORT`           | Port to listen on. Defaults to 3001.                                      |
| `DATABASE_PATH`  | SQLite file. Defaults to `./data/db.sqlite`.                              |
| `AUTH_SECRET`    | JWT signing secret. Generated and persisted beside the database if unset. |
| `APP_BASE_URL`   | How the app is reached from outside — what emailed links point at.        |
| `RESEND_API_KEY` | Resend API key, for sending all emails.                                   |
| `MAIL_FROM`      | Sender address on those emails, e.g. `Julenissen <santa@example.com>`.    |

`APP_BASE_URL` has no sensible default for a deployed service, so set it
to wherever the app actually answers, including any path prefix. It's used
both to build the links in emails and to redirect back into the app after
a magic link is followed. Get it wrong and the links lead somewhere that
isn't the app.

With `RESEND_API_KEY` or `MAIL_FROM` missing, emails are logged instead of
sent, and every send says so. That keeps local development working without
credentials, but it means a misconfigured production service quietly sends
nothing, so check the startup log after changing either.

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
repo reads that file (the service inherits the variables from systemd), so
there's no path by which the key reaches git.

## Admin and database tools

Run from `server/`:

```bash
npm run set-admin -- <email>          # make someone an admin
npm run set-admin -- <email> false    # take it away again
npm run db:studio                     # browse and edit the database (Drizzle Studio)
npm run db:backup -- [destination]    # consistent snapshot of the database
npm run db:generate                   # new migration after changing schema.ts
```

The admin role can only be granted this way; there is deliberately no way
to become an admin through the app.

Back up with `db:backup` (or `VACUUM INTO`), never by copying `db.sqlite`.
The database runs in WAL mode, so recent data can sit in `db.sqlite-wal`
and a plain copy of the main file can come out empty.

## Checks

```bash
npm run check   # format + lint + type-check (vp check)
npm test        # frontend tests (vitest, jsdom)
cd server && npm test   # backend tests
```

Formatter and linter settings live in [.oxfmtrc.json](.oxfmtrc.json) and
[.oxlintrc.json](.oxlintrc.json) at the repo root, so `vp`, the standalone
`oxfmt`/`oxlint` and editor extensions all agree, `server/` included.

The frontend tests render the whole app against a stubbed `fetch`. The
backend tests run the actual Hono app against an in-memory SQLite database,
covering the auth flow, the draw, emails (through a fake mailer), the
anonymity of questions, and the validation of notes.
