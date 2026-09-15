# TODO / ideas

Not scheduled — just notes to come back to.

## Matching/draw feature

Partly built. What exists today:

- `doMatching` (`server/src/matcher/matching_logic.ts`) — backtracking
  search that gives everyone a recipient, excluding themselves and their
  partner, or returns null if no valid assignment exists for the group at
  all.
- `POST /api/matcher` (admin-only) — takes a list of `personId`s, fetches
  those people, runs the matching and returns the assignment. 422 when the
  group has no valid matching (e.g. a couple on their own).
- Admin page — select everyone or a subset, then "Preview match" to see
  what comes back.

**Still missing:**

- **Persistence.** The endpoint computes an assignment, returns it, and
  forgets it — which is why every run is inherently a dry run and the admin
  UI can only ever preview. Needs an `assignments` table (`giverId` /
  `recipientId` / maybe `year`) before "who am I matched with" or the email
  below mean anything.
- **Locking in.** Once assignments are stored: re-runnable until the admin
  locks the draw in, frozen afterwards. This is what turns the current
  preview-only button into "preview" _vs_ "commit".
- **Last year's recipient.** Still not excluded. `last_year_recipient`
  exists as a vestigial field on the frontend `Person` model but isn't a
  real DB column and isn't wired to anything. Once it is, it's one more
  clause in `canGiveTo` — there's a comment marking the exact spot.
- **Showing people their match.** AccountPage unconditionally says "You
  haven't been matched yet" — it has nothing to read yet, per the
  persistence point above.

## Match-notification email

Nothing built yet. Once assignments are actually stored (see above), send
each person an email letting them know their match is ready to view.

**1. What triggers the send**

- Natural hook: right after the admin locks in the draw, either as part of
  that same action or a separate "notify everyone" button.
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

- Preview the emails without sending, to sanity-check wording and the
  recipient list before it goes out to the whole family. The match itself
  already previews this way; the email side doesn't exist yet.
- Skip (or nudge first) anyone still sitting on their initial,
  never-confirmed password when the draw runs — get them logged in and
  their password set _before_ the draw, not after.
