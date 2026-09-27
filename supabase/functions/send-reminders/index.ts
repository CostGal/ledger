// send-reminders — deployed to the SANDBOX Supabase project only.
//
// Two ways in:
//  1. pg_cron, every 5 minutes, with header x-cron-secret. Claims every
//     reminder that is due right now (claim_due_reminders marks them sent for
//     today in the same statement, so overlapping runs can't double-send),
//     skips the ones whose entry is already done, and pushes the rest to every
//     device the owner has turned notifications on for.
//  2. The app's "Send a test" button: a signed-in user's bearer token and
//     {"test": true}. Pushes one test notification to that user's devices.
//
// Deployed with verify_jwt = false because path 1 carries no user JWT; both
// paths authenticate themselves below.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };
type Due = {
  reminder_id: string; user_id: string; entry_name: string; entry_icon: string | null;
  kind: "floor" | "ceiling" | "binary"; period: "day" | "week" | "month";
  target: number; today_count: number; period_count: number;
};

const PERIOD = { day: "today", week: "this week", month: "this month" } as const;

// Already done → no reminder. Ceilings are never "done"; their reminder is
// just a nudge to log, so it always goes out.
function isDone(r: Due) {
  if (r.kind === "binary") return r.today_count > 0;
  if (r.kind === "floor") return r.period_count >= r.target;
  return false;
}
function bodyFor(r: Due) {
  if (r.kind === "binary") return "Not logged yet today.";
  if (r.kind === "floor") return `${r.period_count} of ${r.target} ${PERIOD[r.period]}.`;
  return `${r.period_count} of ${r.target} used ${PERIOD[r.period]}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: sec, error: secErr } = await sb.rpc("reminder_secrets");
  if (secErr || !sec?.ledger_vapid_private) return json({ error: "secrets missing" }, 500);
  webpush.setVapidDetails("https://costgal.github.io/ledger/", sec.ledger_vapid_public, sec.ledger_vapid_private);

  async function pushTo(userId: string, payload: object) {
    const { data: subs } = await sb.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", userId);
    let sent = 0;
    for (const s of (subs ?? []) as Sub[]) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload), { TTL: 3600 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // The phone has forgotten this subscription (app removed, permission
        // revoked) — drop it so we stop trying.
        if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push failed", code, (e as Error).message);
      }
    }
    return sent;
  }

  // Path 1: the scheduler.
  if (req.headers.get("x-cron-secret")) {
    if (req.headers.get("x-cron-secret") !== sec.ledger_cron_secret) return json({ error: "forbidden" }, 403);
    const { data: due, error } = await sb.rpc("claim_due_reminders");
    if (error) return json({ error: error.message }, 500);
    let sent = 0, skipped = 0;
    for (const r of (due ?? []) as Due[]) {
      if (isDone(r)) { skipped++; continue; }
      sent += await pushTo(r.user_id, {
        title: (r.entry_icon ? r.entry_icon + " " : "") + r.entry_name,
        body: bodyFor(r), tag: r.reminder_id,
      });
    }
    return json({ due: (due ?? []).length, skipped, sent });
  }

  // Path 2: "Send a test" from the app.
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = token ? await sb.auth.getUser(token) : { data: { user: null } };
  if (!u?.user) return json({ error: "not signed in" }, 401);
  const sent = await pushTo(u.user.id, { title: "Ledger", body: "Reminders are working on this device.", tag: "test" });
  return json({ sent });
});
