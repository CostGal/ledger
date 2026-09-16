# Tasks

**Beta build:** `ledger-beta` main is currently on the same commit content as `ledger` main (both tip "Add password reset flow and retry failed writes when back online" — `129d160` here, `4b19a11` there; verified by diffing both `index.html` files). If friends report an old build, it's a GitHub Pages deploy/cache lag, not a stale repo — check that before re-promoting code.

Newest at top. Tags: `[kostas]` (needs Kostas), `[claude]` (Claude can do it).

## In progress

- [ ] [kostas] Set Site URL + Redirect URLs in Supabase Auth → URL Configuration on **both** projects — reset links can't work without this.
- [ ] [kostas] Test the full reset loop on a real iPhone: request → email arrives from `notify.socialhue.gr` → link opens set-password screen → new password works.

## Queued

- [ ] [claude] Password-reset edge case: `recoveryFromHash()` only reads `location.hash` (Supabase's default implicit-flow shape, `#type=recovery&access_token=...`). If either Supabase project's Auth flow type is set to PKCE instead, the recovery link comes back as a `?code=...` query param and the set-password screen would never trigger. Worth confirming which flow type is configured before calling this fully closed — if it's implicit on both, nothing to do here.
- [ ] [claude] Auth screen: remember the last-used email across visits, and stop `boot()` from resetting `S.view`/`S.date` back to Day/today on every re-auth (including the forced one after a refresh-token failure) so a signed-out-and-back-in user doesn't lose their place. Note: the autocomplete attributes themselves (`username` / `current-password` / `new-password`) are already correct on all three fields — that part doesn't need work.
- [ ] [claude] Failed-write visibility: `pushWrite` already toasts `"Not saved — …"` on failure and auto-retries once `online` fires again, so it isn't fully silent today. What's missing is a *persistent* per-item indicator — right now once the 4s toast fades, a chip that failed to save looks identical to one that succeeded. `W[key].failed` is already tracked and could drive that.
- [ ] [kostas] Run the Resend→Supabase integration on `ledger-beta`; confirm SMTP settings are populated in that project's dashboard the same way as sandbox's.
- [ ] [kostas] Save the weekly CSV export query in both Supabase projects.
- [ ] [kostas] Supabase webhook on new signup → Make → notification.
- [ ] [claude] Per-entry notes on a log.
- [ ] [claude] Undo for mis-taps.
- [ ] [claude] Per-user data export from within the app.
- [ ] [claude] Week review screen: ceilings crossed vs. floors missed, patterns across weeks. Present as observations, never as causal claims. (The current Week view is single-week status only — `renderWeekView` has no cross-week comparison yet.)
- [ ] [claude] Yearly heatmap view.
- [ ] [claude] Day-of-week breakdown per entry.
- [ ] [claude] `CLAUDE.md` documents `tools/make-icons.mjs` as the way to regenerate the four icon PNGs, but that script isn't present in this repo (or `ledger-beta`) — either recreate it from the documented spec (512-unit grid, per-target `contentScale`, opaque PNGs) or fix the doc if it's meant to live elsewhere.
- [ ] [claude] `ledger-beta/index.html` has CRLF line endings while `ledger/index.html` has LF (from an earlier "Add files via upload"). Harmless for the browser but makes cross-repo diffing noisy — normalize one to match the other.
- [ ] [kostas] Confirm the Resend/`notify.socialhue.gr` SMTP config is set the same way in both the sandbox and beta Supabase projects (dashboard-only, not tracked in either repo — see `CLAUDE.md`).

## Done

- [x] [claude] Verified this list against the actual code before seeding it (see corrections below) and reviewed/corrected `CLAUDE.md` — documented that beta lives in a separate repo (`ledger-beta`) kept in sync by hand, and added the Resend/`notify.socialhue.gr` auth-email SMTP setup.
- [x] [claude] Password reset, receiving side — **this was listed as "in progress" but is already fully built**: `recoveryFromHash()` detects a Supabase recovery token in the URL hash, `boot()` routes to `renderResetPassword()` instead of normal login when one's present, and the new password is submitted via `authPut('user', …)` using that recovery token. `sendReset()` already builds its `redirect_to` from `location.origin + location.pathname`, so it's per-environment automatically — never hardcoded. Only the query-string edge case above is genuinely open.
- [x] [claude]/[kostas] "Promote current sandbox code to `ledger-beta`" — **this was listed as queued, but it's already done**: both repos' `index.html` are byte-identical content (aside from CRLF/LF) and both are on the same latest commit. See the beta-build note at the top.
- [x] [claude] Added retry-when-back-online for failed writes (the `online` listener in `pushWrite` replays anything that failed) and the password reset flow's UI half above.
- [x] [claude] App icon + web manifest.
- [x] [claude] `live()`/`render()` split — no more scroll jump on tap.
- [x] [claude] `pushWrite` serialisation for concurrent taps.
- [x] [claude] Sandbox/beta environment split with per-env session keys.
- [x] [kostas] Invite allowlist on both Supabase projects — the client-side handling of `not_invited` / "Database error saving new user" in `renderAuth` matches this being live; the Supabase-side trigger/table itself isn't something I can verify from the repo.
- [x] [kostas] `notify.socialhue.gr` verified in Resend — infra-only, no trace in the code either way; taking your word for it.
- [x] [kostas] Local git connected to the `ledger` repo.
