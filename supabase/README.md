# Supabase-side pieces

Nothing here runs at build or serve time: the app is still just `index.html`. This folder is the source of record for the server-side parts that live in the Supabase projects.

## Reminders (sandbox project only, for now)

| Piece | Where it lives |
|---|---|
| `migrations/20260927_reminders.sql` | Tables `reminders` and `push_subscriptions` (RLS on `user_id`), plus `claim_due_reminders()` and `reminder_secrets()` (both callable by the service role only). |
| `functions/send-reminders/index.ts` | Edge function, deployed with `verify_jwt = false` because it authenticates both of its callers itself. |
| Vault secrets | `ledger_vapid_public`, `ledger_vapid_private`, `ledger_cron_secret`. These are **not** in the repo. The public VAPID key is also hard-coded as `VAPID_PUBLIC` in `index.html`, and the two must match. |
| pg_cron job `ledger-reminders` | Every 5 minutes: `net.http_post` to the function with header `x-cron-secret`. |

How a reminder fires: every 5 minutes, `claim_due_reminders()` picks each enabled reminder whose time falls within the last 30 minutes in its own time zone (`tz`) and that hasn't been handled today. In the same statement it marks that reminder as handled for today, so overlapping runs can't double-send. The function then skips entries that are already done:
- floor: period total ≥ target
- binary: logged today
- ceiling: never skipped

Everything else is pushed to every device the owner turned notifications on for. A device the push service reports as gone (404/410) is deleted from `push_subscriptions`.

The sandbox check lives in `index.html` (`REMINDERS`). Rolling this out to beta means doing four things on the beta project:
- apply the same migration
- deploy the same function
- create new Vault secrets
- schedule the same cron job

Then drop the check.
