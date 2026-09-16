# Tasks

Newest at top. Tags: `[kostas]` (needs Kostas), `[claude]` (Claude can do it).

## In progress

_(nothing right now)_

## Queued

- [ ] [claude] `CLAUDE.md` documents `tools/make-icons.mjs` as the way to regenerate the four icon PNGs, but that script isn't present in this repo (or `ledger-beta`) — either recreate it from the documented spec (512-unit grid, per-target `contentScale`, opaque PNGs) or fix the doc if it's meant to live elsewhere.
- [ ] [claude] `ledger-beta/index.html` has CRLF line endings while `ledger/index.html` has LF (from an earlier "Add files via upload"). Harmless for the browser but makes cross-repo diffing noisy — normalize one to match the other.
- [ ] [kostas] Confirm the Resend/`notify.socialhue.gr` SMTP config is set the same way in both the sandbox and beta Supabase projects (dashboard-only, not tracked in either repo — see `CLAUDE.md`).

## Done

- [x] [claude] Reviewed and corrected `CLAUDE.md` — documented that beta lives in a separate repo (`ledger-beta`) kept in sync by hand, and added the Resend/`notify.socialhue.gr` auth-email SMTP setup.
- [x] [claude] Seeded this `TASKS.md`.
- [x] [kostas]/[claude] Added password reset flow and retry-when-back-online for failed writes.
