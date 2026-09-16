# Tasks

**Beta build:** both repos' `main` are in sync as of the last merge — per-entry notes, undo for mis-taps, data export, plus the earlier password reset / icon / emoji-icon / unsaved-write-badge baseline. Both live once GitHub Pages redeploys (usually a minute or two after a merge).

**GitHub issues:** every In progress / Queued item below is mirrored as an issue in this repo (`CostGal/ledger`), tagged `[kostas]` or `[claude]` in its title to match. Issue number is noted in parens after each item. When ticking an item here, close the matching issue in the same pass (and vice versa) — this list and the issue tracker are meant to stay in sync, not duplicate independently.

Newest at top. Tags: `[kostas]` (needs Kostas), `[claude]` (Claude can do it).

## In progress

- [ ] [kostas] Set Site URL + Redirect URLs in Supabase Auth → URL Configuration on **both** projects — reset links can't work without this. (#3)
- [ ] [kostas] Test the full reset loop on a real iPhone: request → email arrives from `notify.socialhue.gr` → link opens set-password screen → new password works. (#4)

## Queued

- [ ] [kostas] Run the Resend→Supabase integration on `ledger-beta`; confirm SMTP settings are populated in that project's dashboard the same way as sandbox's. (#8)
- [ ] [kostas] Save the weekly CSV export query in both Supabase projects. (#9)
- [ ] [kostas] Supabase webhook on new signup → Make → notification. (#10)
- [ ] [claude] Week review screen: ceilings crossed vs. floors missed, patterns across weeks. Present as observations, never as causal claims. (The current Week view is single-week status only — `renderWeekView` has no cross-week comparison yet.) (#14)
- [ ] [claude] Yearly heatmap view. (#15)
- [ ] [claude] Day-of-week breakdown per entry. (#16)
- [ ] [claude] `CLAUDE.md` documents `tools/make-icons.mjs` as the way to regenerate the four icon PNGs, but that script isn't present in this repo (or `ledger-beta`) — either recreate it from the documented spec (512-unit grid, per-target `contentScale`, opaque PNGs) or fix the doc if it's meant to live elsewhere. (#17)
- [ ] [kostas] Confirm the Resend/`notify.socialhue.gr` SMTP config is set the same way in both the sandbox and beta Supabase projects (dashboard-only, not tracked in either repo — see `CLAUDE.md`). (#18)

## Done

- [x] [claude] Per-user data export: a "Download my data" button in Manage view exports everything the account owns (entry types, logs with notes, reflections) as one JSON file, mirroring the existing importer's slug-based shape. Read-only, no schema change. Verified with a mocked Playwright preview, including inspecting the actual downloaded file contents. Merged via PR #23. (#13, closed)
- [x] [claude] Undo for mis-taps: a tap on a counter chip (+1 or minus) or a binary toggle shows a neutral undo toast (a new `#undo` element, deliberately not the red-styled `#toast` used for errors) with an Undo button that reverts just that tap. Only the most recent tap is undoable. Previewed with a mocked screenshot before pushing (confirmed both counter and toggle revert correctly). Merged via PR #21. (#12, closed)
- [x] [claude] Per-entry notes on a log: a pencil button on each chip/toggle opens a free-text note for that entry on the viewed date, in a section below the chips (not inline in the flex-wrap row). Pencil turns accent-colored once a note exists. New `S.logNotes` cache alongside `S.logs` — `cnt()`/`sumRange()`/`periodTot()` untouched. New nullable `note` column on `logs` in both Supabase projects. Previewed with a mocked screenshot before pushing. Merged via PR #20. (#11, closed)
- [x] [claude] Documented the task workflow (plain-language rundowns, discuss-first for bigger calls, structural problems get options + a recommendation) in `CLAUDE.md`. Merged via PR #22.
- [x] [claude] Per-entry emoji icon: optional icon field on entry types, shown to the right of the name everywhere (Day chips/toggles, Week/Month rows, Manage list and edit form) — never inside the name field itself. Presets on the six seeded placeholders (💪 Exercise, 🏃 Run, 📖 Read, 😴 Slept 7h+, 🥡 Takeout, 🌙 Late night). Picking is a plain text input using the OS emoji keyboard, no custom widget. New nullable `icon` column added to `entry_types` on both Supabase projects — confirmed no existing rows affected (25 beta / 12 sandbox entries, all intact). Previewed with a mocked screenshot before pushing, which caught a real crash bug in the #7 change below (fixed in the same commit). (#19, closed)
- [x] [claude] Failed-write visibility: chips/toggles now show a persistent off-white badge with a red dot while their last write is still failed, clearing once it retries successfully (on the next tap, or after an `online` reconnect). Deliberate, narrow exception to "red = exceeded ceiling only" — Kostas's explicit choice, documented in `CLAUDE.md`. (#7, closed)
- [x] [claude] Auth screen: remembers the last-used email per environment now (prefilled + saved on input), and `boot()` no longer resets `S.view`/`S.date` to Day/today on every call — a forced re-auth or manual sign-out/back-in keeps the user's place. (#6, closed)
- [x] [claude] Password-reset PKCE edge case — checked (#5, closed not-planned) and confirmed it isn't real: Supabase's default recovery email uses `{{ .ConfirmationURL }}`, which resolves server-side and redirects back with the session in the hash fragment (what `recoveryFromHash()` already handles). PKCE requires the *client* to generate a code_challenge at request time; this app's `recover()` call never does that, so PKCE can't be in play here regardless of any dashboard setting. No code change needed.
- [x] [claude] Mirrored every In progress / Queued item above as a GitHub issue in this repo (#3–#18) and noted the sync convention at the top of this file.
- [x] [claude] `ledger-beta/index.html` had CRLF line endings while this file has LF (from an earlier "Add files via upload") — resolved when `ledger`'s `index.html` was promoted into `ledger-beta`, which carried the LF endings over.
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
