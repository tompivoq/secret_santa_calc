# TODO / ideas

Not scheduled — just notes to come back to.

## Leftovers from the matching/draw feature

The draw itself is done — drafted, re-rollable, locked in, stored, shown
to each person, and avoiding last year's pairings. What's left is small:

- **Manual last-year values go stale silently.** They're only consulted for
  people the previous locked draw has no answer for, so after the first
  draw in this app they stop mattering for anyone who took part — correct,
  but nothing in the UI says so. Worth a note next to the dropdown if it
  ever causes confusion.
- **Nobody can see a past draw.** Locked draws accumulate as history (which
  is what repeat-avoidance reads), but there's no way to look at last
  year's. Only worth building if you ever actually want it.
- **Re-drawing after locking changes matches silently.** The admin has to
  confirm, but anyone who already saw their match isn't told it changed.
  The notification email below is the natural place to handle that.

## Match-notification email

In progress. Decided on **option B (magic link)**, below.

**Built so far:**

- `mail/mailer.ts` — a `send({to, subject, html, text})` seam with Resend
  behind it, falling back to logging when `RESEND_API_KEY`/`MAIL_FROM`
  aren't set.
- `auth/magic.ts` + `GET /api/auth/magic/:token` — single-use login links.

**Still to do:** `notifiedAt`, the actual email content, the endpoint and
button that send it, and the frontend handling of
`/login?error=link-expired`.

**Blocked on a decision:** where an emailed link should point. The app is
LAN-only at `192.168.1.26:8090`, so a link to it only works for someone on
the home network. Either that's fine (everyone's there at Christmas), or
the app needs to be reachable from outside before the email is worth
sending. Whichever, the sending code needs an `APP_BASE_URL` to build
links from — it shouldn't hardcode the LAN address.

**1. What triggers the send**

- Natural hook: right after the admin locks in the draw (`POST
  /api/matcher/lock`), either as part of that same action or a separate
  "notify everyone" button.
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
  recipient list before it goes out to the whole family — the same
  draft-then-commit shape the draw itself already has.
- Skip (or nudge first) anyone still sitting on their initial,
  never-confirmed password when the draw runs — get them logged in and
  their password set _before_ the draw, not after.

**6. Two things the magic-link work turned up**

- **Link prefetching can spend a link before the human clicks it.** Some
  mail providers and corporate scanners follow links to check them, and
  these are single-use. Family webmail mostly doesn't, so this is a risk
  rather than a certainty — but if it bites, the fix is a landing page with
  a button that POSTs, instead of consuming on GET.
- **No way back to password login once a link retires someone's initial
  password.** Following a link replaces a never-chosen initial password
  with an unusable one, so from then on that person is magic-link-only.
  Fine on purpose — this is a once-a-year login — but there's no
  self-service reset and no admin "resend password" either, so the only
  route back in is another link.
