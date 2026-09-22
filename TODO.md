# TODO / ideas

Not scheduled — just notes to come back to.

## Where things stand

Live at https://julenissen.example.com (nginx + Cloudflare in
front, backend as a systemd user service on the home server). Built and
deployed:

- **People and accounts** — the admin adds, edits and removes people, with
  partners and a manually set "last year's recipient". Everyone gets a login
  and can edit their own name, email, phone and password, but not the
  partner or last-year fields, which shape the draw.
- **Invitations** — the admin emails login links before any draw, to
  everyone not yet in or to individuals, and can see who has logged in.
- **The draw** — select participants, test-run with visible pairings, then
  a real blind draw the admin can't see either; re-roll until happy, lock
  in. Avoids last year's pairings, falling back to allowing them if the
  group can't be matched otherwise. Locked draws are kept as history.
- **Match emails** — the admin notifies everyone once the draw is locked,
  tracking who has been told. People without a password get a magic link;
  people with one get a plain link to their account page.
- **Anonymous questions** — once locked, anyone in the draw can ask anyone
  else (match and match's partner marked first), and get one answer back.
  The recipient never learns who asked or how they relate to them. Emails
  are notices only, never the text.
- **Private notes** — a Tiptap notepad on the account page, saved
  automatically, kept across draws, http(s)-only links checked in the
  editor and on the server, and conflicts between devices put to the user.
- **Theming** — light/dark themes on shared tokens, and a style guide at
  `/styleguide` (admin-only) that flags any token that doesn't resolve.
- **Security headers** — nginx serves a strict Content-Security-Policy
  (only the app's own scripts, styles and API; nothing inline, no framing),
  plus `nosniff`, a referrer policy and `X-Frame-Options`, from a snippet
  included in both server blocks. **Anything new from another origin** (web
  fonts, images, analytics) **or inline** (`<script>`/`<style>` tags, style
  attributes set as HTML) will be blocked until the policy allows it — which
  is why the theme script lives in `public/theme.js` and the notes editor
  runs with `injectCSS: false`.

## Open follow-ups

Things that came up along the way. None are urgent.

### Security and operations

- **No scheduled backups.** Backups are only taken by hand before deploys,
  with `VACUUM INTO` into `/claude/backups/` (never `cp`, which copies an
  empty file while SQLite is in WAL mode). A daily cron job under
  `claude_ssh` needs no root.
- **No rate limiting on `/api/auth/login`.** Easiest as a Cloudflare rate
  limiting rule rather than in the app.
- **Server dependencies are a step behind the lockfile.** The server still
  runs `hono` 4.13.5 and `zod` 4.5.4; the lockfile has 4.13.8 and 4.6.5.
  Deploys only copy `dist/`, so catching up means `npm ci --omit=dev` on
  the server, which also rebuilds `better-sqlite3`'s native module.
- **Notes and messages are plaintext in the database.** Enforced private in
  the app (no admin view, no route to anyone else's), but readable through
  the database tool. Encrypting them was considered and judged not worth it.

### Login and email

- **Link prefetching can spend a link before the human clicks it.** Some
  mail providers and scanners follow links to check them, and magic links
  are single-use. If it bites, the fix is a landing page with a button that
  POSTs, instead of consuming the link on GET.
- **Each new magic link replaces the previous one.** There's one slot per
  person, so for someone who hasn't set a password yet, an invitation,
  match or message email cancels the link in any earlier email.
- **No self-service password reset.** In practice a fresh invitation from
  the admin gets someone back in. Only worth building if that stops being
  enough.
- **Emails with non-ASCII characters are rejected** (e.g. `bjørn@…`), by the
  API's validation and the forms alike.
- **The two message emails are draft wording** (`mail/messageEmails.ts`),
  unlike the invitation and match emails, which have been rewritten.

### The draw

- **Manual last-year values go stale silently.** They're only consulted for
  people the previous locked draw has no answer for, so after the first
  draw in this app they stop mattering for anyone who took part. Correct,
  but nothing in the UI says so.
- **Nobody can see a past draw.** Locked draws accumulate as history, but
  there's no way to look at last year's. Only worth building if wanted.
- **Re-drawing after locking changes matches without saying so.** Everyone
  shows as not yet notified again, so the admin can re-send, but the email
  doesn't say the match changed. Questions asked under the old draw also
  disappear without notice.

### Messages

- **The ask form's help text predates asking anyone.** It still reads as if
  it's aimed at your match.

### Code and tests

- **Intermittent test failure.** "shows a received question anonymously,
  and answers it once" in `Messages.integration.test.tsx` has failed twice
  in full runs and never on its own or when rerun. Cause not found yet.
- **Windows Application Control sometimes blocks `vp`'s native binding**,
  which stops the frontend tests, lint and formatter until it clears. The
  server tests use plain vitest and aren't affected.
