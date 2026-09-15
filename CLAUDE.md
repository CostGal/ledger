# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ledger — a habit tracker built around **floors** (do at least N per period) and **ceilings** (do at most N per period). It's a single-file static web app (`index.html`) with no build step, no package.json, and no dependencies — vanilla JS/CSS/HTML, talking directly to Supabase's REST and Auth APIs over `fetch`. There is no dev server or test suite in this repo; editing is done directly on `index.html` and verified by opening the file (or its deployed URL) in a browser.

## Domain model

Every tracked thing is an **entry type** with a `kind` and a `period`:

- `kind`: `floor` (at least N — counter chips), `ceiling` (at most N — budget chips), `binary` (yes/no once per day — toggles)
- `period`: `day`, `week`, `month`

Logs are stored as raw daily counts, never as scored results, so changing a target or period re-scores history retroactively. The four views are **Day** (logging; can navigate to any past date), **Week**, **Month**, and **Entries** (CRUD over entry types). Week additionally carries a reflection: a 1–5 presence score plus a free-text note, keyed by week start.

## Deployment & environments

Deployed as static files from `main` at the repo root via GitHub Pages → `costgal.github.io/ledger/`. A second host serves the same files for the beta. The app picks its Supabase backend at runtime by hostname, at the top of the `<script>` block:

- `costgal.github.io/ledger/` → **sandbox** project (Kostas's personal data)
- any other host (beta domain, localhost) → **beta** project (friends)

Because the same files are served both under a `/ledger/` path prefix and at a host root, **any asset the page references must use a relative URL** (`manifest.json`, not `/manifest.json`) so it resolves under both deploy shapes.

Both Supabase keys embedded in the file are publishable. The real access control is server-side: every table is RLS-scoped to `user_id`, and beta signup is gated by an `allowed_emails` table plus a trigger on `auth.users`. That trigger is what produces the `not_invited` / `Database error saving new user` responses which `renderAuth` rewrites into "That email is not on the beta list." Sessions are stored in `localStorage` under a key namespaced per environment (`ledger_session_sandbox` / `ledger_session_beta`) so signing into one doesn't clobber the other.

Both projects carry the identical schema: `entry_types`, `logs`, `reflections`.

## Design invariants — do not redesign

The visual design is settled and deliberate. Keep it:

- Black background; `#D97757` as the only accent
- `#E5484D` (red) is reserved **strictly** for a ceiling that has been exceeded — never for generic errors, warnings, or emphasis
- Futura stack throughout (`--fut`)
- iOS-first; minimum 44pt tap targets; `env(safe-area-inset-*)` respected on all four edges

The palette lives in the `:root` custom properties at the top of the `<style>` block. Reuse those variables rather than introducing new color literals.

## Architecture

Everything lives in `index.html`: inline `<style>`, then a single `<script>` implementing a small hand-rolled SPA (no framework). Key pieces, in the order they appear:

- **`el(tag, props, ...kids)`** — the only DOM helper; every view is built by calling this directly (no templating, no JSX).
- **Auth (`authReq`, `sess`/`setSess`, `refreshSession`, `api`)** — thin wrappers around Supabase's `/auth/v1` and `/rest/v1` endpoints. `api()` auto-retries once on a 401 by refreshing the access token, then signs the user out and drops back to the auth screen if that also fails.
- **Global state `S`** — a single mutable object. There is no state library; mutating `S` and calling `render()` is the entire update model.
  - `S.loaded` caches `logs` a whole month at a time, keyed `YYYY-MM`, so navigation within a month costs no network.
  - `S.renderToken` is a counter that discards stale in-flight renders when the user navigates away mid-load.
  - `S.firstRun` is set by `seedIfEmpty`, which plants six placeholder entry types on a fresh account; it's what routes a brand-new user to the Entries tab with an explanatory banner instead of an empty Day view.
- **Data access** — `loadTypes` / `ensureRange` / `setLog` / `getRefl` / `setRefl` are the only functions that touch the network for data (as opposed to auth). Writes are upserts done the long way: `PATCH` with `return=representation`, and `POST` only if the patch matched no rows.
  - `setLog`/`setRefl` update `S` **synchronously** and return a promise for the background write. Don't `await` them in a tap handler — that reintroduces the dead-tap latency. Do `await` them where ordering matters (`runImport`).
  - Both go through `pushWrite`, which keeps one write in flight per key and always sends the newest value. That serialisation is load-bearing: without it, two fast taps each `PATCH` (matching no row yet) and then `POST`, inserting the same `(entry_type_id, date)` twice. Reflections are keyed per **week**, not per field, for the same reason.
- **Views** — `renderDayView`, `renderWeekView`, `renderMonthView`, `renderManageView`, `renderAuth`, dispatched by `draw()` based on `S.view`.
- **Rendering has two levels, and picking the right one matters:**
  - `live(build)` rebuilds **one subtree** in place. Use it for anything whose effect is local — a chip, a toggle, the score row. The rest of the DOM, the scroll position and focus survive. A tap that goes through `render()` instead will throw the user back to the top of the page.
  - `render()` redraws the whole screen. It draws **synchronously** when `dataReady()` says the needed months (and, for Week, the reflection) are already cached; otherwise it leaves the current screen up, shows the `#load` bar via `busy()`, and draws when the fetch lands. It never blanks the screen and never draws with missing data.
  - Before wrapping something in `live()`, check that nothing *outside* that subtree reads the state you're changing — otherwise the rest of the screen goes stale.
- **Manage view** also contains a bespoke JSON importer (`runImport`) for migrating from an older tracker's export format (`{weeks: {...}, targets: {...}}`).

## Icons

The four root-level PNGs (`icon-180`, `icon-192`, `icon-512`, `icon-512-maskable`) are **generated, not hand-drawn**. Edit `tools/make-icons.mjs` and re-run it rather than editing the PNGs:

```
node tools/make-icons.mjs
```

Node built-ins only; it never runs at build or serve time. Geometry is expressed on a 512-unit design grid at the top of the script, and one `contentScale` parameter per target shrinks the mark for the Android maskable safe circle. `icon-180.png` is the one iOS actually uses for Add to Home Screen — it and the others are deliberately opaque (PNG colour type 2, no alpha) and not pre-rounded, since both platforms apply their own corner mask.

## Working in this file

- No bundler, no module system — new code goes into the existing single `<script>` block, in the same style (plain functions, `el()`-built DOM, no external libraries).
- `kind` and `period` are the two axes driving almost all conditional logic across the Day/Week/Month views (`periodRange`, `periodTot`, `isCeil`, `weekTarget`/`weekTot`, `mTarget`). When adding a feature that touches entry types, check all three views, not just one.
- Network failures from `setLog`/`setRefl` are surfaced via the `toast()` helper rather than thrown, since these are fire-and-forget saves from UI interactions.
