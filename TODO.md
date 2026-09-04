# TODO / ideas

Not scheduled — just notes to come back to.

## Match-notification email

Once the matching/draw feature exists (assigns each person a recipient —
doesn't exist yet either, see below), send an email letting each person know
their match is ready to view.

**1. What triggers the send**

- Natural hook: right after the admin runs the draw, either as part of that
  same action or a separate "notify everyone" button.
- Track a `notifiedAt` timestamp per person regardless of when this gets
  built, so it's possible to:
  - avoid double-sending if the button is clicked twice
  - show the admin who has/hasn't been notified
  - offer a per-person "resend" button

**2. How the person gets in — the main design choice**

- **A — Plain notification.** Email just says "log in to see your match."
  Relies on them remembering the password they set at first login. Simplest,
  but this app is used once a year — password recall will be bad, and
  there's no self-service reset yet.
- **B — Magic link (recommended).** Email contains a single-use, short-lived
  login link — no password needed. Reuses almost everything already built:
  `session.ts` already mints a JWT and sets it as the session cookie; a
  magic-link token is just a narrower-purpose JWT (short expiry, single use)
  that a new `GET /api/auth/magic/:token` route verifies and turns into the
  same session cookie `createSession` already sets. Smallest incremental
  addition given what's already there, and the right UX for a login used
  once a year.
- **C — Put the match directly in the email, skip login entirely.**
  Simplest of all, but throws away the login/account system already built,
  and leaves the assignment sitting in plaintext in an inbox indefinitely.
  Avoid unless B turns out to be more trouble than it's worth.

**3. Actually sending the email**

- Don't self-host SMTP on the home server — residential ISPs commonly block
  outbound port 25, and a fresh server has no sending reputation, so mail
  gets spam-filtered hard regardless of effort.
- **Transactional email API** (Resend, Postmark, Mailgun, SES) — generous
  free tiers at family scale, API key instead of SMTP creds, much better
  deliverability out of the box. Leaning Resend for its small/clean API.
- **Existing provider's SMTP** (e.g. a Gmail app password) via `nodemailer`
  — works, but borrows a personal inbox's reputation/limits for an app.
- Either way, wrap it behind a small `sendMail(to, subject, html)` function
  so the provider is swappable and tests can stub it instead of sending
  real email — same pattern as injecting `AUTH_SECRET` rather than
  hardcoding it.

**4. Config & secrets**

- Same pattern as `AUTH_SECRET`: an env var on the server (e.g.
  `RESEND_API_KEY`), never committed.
- If sending from your own address/domain rather than the provider's shared
  sending domain, add SPF/DKIM DNS records — not required to start, just
  improves deliverability and how the sender looks.

**5. Nice-to-haves worth designing in from the start**

- Dry-run/preview mode in the admin UI — render the emails without sending,
  to sanity-check wording and the recipient list before it goes out to the
  whole family.
- Skip (or nudge first) anyone still sitting on their initial,
  never-confirmed password when the draw runs — get them logged in and
  their password set _before_ the draw, not after.

## Matching/draw feature

Doesn't exist yet — the app currently only manages people and their partner
(couple) links. Needed before "who am I matched with" or the email above
mean anything:

- Randomly assign each person a recipient, excluding their own partner
  (and presumably not assigning someone to themselves).
- Decide whether to also exclude last year's assignment
  (`last_year_recipient` exists as a vestigial field on the `Person` model
  today but isn't wired up to anything).
- Store the result somewhere (`assignments` table: `giverId` / `recipientId`
  / maybe `year`), admin-triggered ("run the draw"), probably re-runnable
  until "locked in."
