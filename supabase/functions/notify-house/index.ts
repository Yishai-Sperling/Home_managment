// notify-house — Supabase Edge Function (Deno)
// מקבלת Database Webhook (INSERT; ובנוסף UPDATE על issues בלבד — ראו handleIssueUpdate) ושולחת לכל חברי הבית מלבד מי שביצע את הפעולה:
//  - התראת Push דרך Expo Push (תמיד, לפי הטבלה push_tokens)
//  - מייל HTML בעברית (RTL) דרך Resend (רק אם הוגדרו RESEND_API_KEY ו-MAIL_FROM)
//
// Secrets: WEBHOOK_SECRET (חובה), RESEND_API_KEY ו-MAIL_FROM (אופציונליים)
// (SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY מוזרקים אוטומטית)

import { createClient } from "npm:@supabase/supabase-js@2";

type Table = "shopping_items" | "car_reservations" | "car_recurring_rules" | "announcements" | "issues";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema?: string;
  record: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
}

const ACTOR_COLUMN: Record<Table, string> = {
  shopping_items: "added_by",
  car_reservations: "user_id",
  car_recurring_rules: "user_id",
  announcements: "created_by",
  issues: "created_by",
};

// מפתח ב-profiles.notify_prefs לכל טבלה (חסר = מקבלים)
const PREF_KEY: Record<Table, string> = {
  shopping_items: "shopping",
  car_reservations: "car",
  car_recurring_rules: "car",
  announcements: "announcements",
  issues: "issues",
};

const WEEKDAY_LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

// [0,1,2,3,4] -> "א׳–ה׳"; [0,2,3,6] -> "א׳, ג׳–ד׳, ש׳"
function fmtDays(days: unknown): string {
  const ds = [...new Set((Array.isArray(days) ? days : []).map(Number).filter((d) => d >= 0 && d <= 6))]
    .sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < ds.length;) {
    let j = i;
    while (j + 1 < ds.length && ds[j + 1] === ds[j] + 1) j++;
    if (j > i) parts.push(`${WEEKDAY_LETTERS[ds[i]]}–${WEEKDAY_LETTERS[ds[j]]}`);
    else for (let k = i; k <= j; k++) parts.push(WEEKDAY_LETTERS[ds[k]]);
    i = j + 1;
  }
  return parts.join(", ");
}

function fmtTime(v: unknown): string {
  return String(v ?? "").slice(0, 5);
}

function fmtRecurring(r: Record<string, unknown>): string {
  return `${fmtDays(r.days)} · ${fmtTime(r.start_time)}–${fmtTime(r.end_time)}`;
}

const SHOPPING_CATEGORY: Record<string, string> = {
  groceries: "מצרכים", cleaning: "ניקיון", pharmacy: "פארמה", other: "אחר",
};
const ANNOUNCEMENT_TYPE: Record<string, string> = {
  general: "כללי", event: "אירוע", reminder: "תזכורת", visit: "ביקור",
};
const PRIORITY: Record<string, string> = { low: "נמוכה", normal: "רגילה", high: "גבוהה" };
const ISSUE_CATEGORY: Record<string, string> = {
  plumbing: "אינסטלציה", electric: "חשמל", heating: "חימום", appliances: "מכשירים", general: "כללי",
};
const URGENCY: Record<string, string> = { low: "נמוכה", normal: "רגילה", urgent: "דחוף" };

function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtDate(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const len = Math.max(ea.length, eb.length);
  for (let i = 0; i < len; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

function row(label: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return `<tr><td style="padding:4px 0 4px 12px;color:#6b7280;white-space:nowrap">${esc(label)}</td><td style="padding:4px 0">${esc(value)}</td></tr>`;
}

function buildMessage(
  table: Table,
  r: Record<string, unknown>,
  actor: string,
  house: string,
): { subject: string; headline: string; rows: string } {
  switch (table) {
    case "shopping_items":
      return {
        subject: `${house}: ${actor} הוסיף/ה לרשימת הקניות`,
        headline: `${actor} הוסיף/ה פריט לרשימת הקניות`,
        rows: row("פריט", r.name) + row("כמות", r.quantity) +
          row("קטגוריה", SHOPPING_CATEGORY[String(r.category)] ?? r.category),
      };
    case "car_reservations":
      return {
        subject: `${house}: ${actor} הזמין/ה את הרכב`,
        headline: `${actor} הזמין/ה את הרכב`,
        rows: row("מתאריך", fmtDate(r.starts_at)) + row("עד", fmtDate(r.ends_at)) +
          row("מטרה", r.purpose) + row("הערות", r.notes),
      };
    case "car_recurring_rules":
      return {
        subject: `${house}: ${actor} שריינ/ה את הרכב בקביעות`,
        headline: `${actor} שריינ/ה את הרכב בקביעות`,
        rows: row("ימים", fmtDays(r.days)) + row("שעות", `${fmtTime(r.start_time)}–${fmtTime(r.end_time)}`) +
          row("מטרה", r.purpose) + row("עד תאריך", r.ends_on),
      };
    case "announcements":
      return {
        subject: `${house}: הודעה חדשה - ${r.title ?? ""}`,
        headline: `${actor} פרסם/ה הודעה חדשה`,
        rows: row("כותרת", r.title) + row("תוכן", r.body) +
          row("סוג", ANNOUNCEMENT_TYPE[String(r.type)] ?? r.type) +
          row("עדיפות", PRIORITY[String(r.priority)] ?? r.priority) +
          row("תאריך האירוע", fmtDate(r.event_date)),
      };
    case "issues":
      return {
        subject: `${house}: תקלה חדשה - ${r.title ?? ""}`,
        headline: `${actor} דיווח/ה על תקלה`,
        rows: row("כותרת", r.title) + row("תיאור", r.description) +
          row("קטגוריה", ISSUE_CATEGORY[String(r.category)] ?? r.category) +
          row("דחיפות", URGENCY[String(r.urgency)] ?? r.urgency),
      };
  }
}

/** שורת "סיבה: ..." להתראה על שריון רכב, כשהוזנה מטרה. */
function purposeLine(r: Record<string, unknown>): string {
  const purpose = String(r.purpose ?? "").trim();
  return purpose ? `\nסיבה: ${purpose}` : "";
}

function buildPush(
  table: Table,
  r: Record<string, unknown>,
  actor: string,
): { body: string; screen: string } {
  switch (table) {
    case "shopping_items":
      return { body: `${actor} הוסיף/ה לקניות: ${r.name ?? ""}${r.quantity ? ` (${r.quantity})` : ""}`, screen: "shopping" };
    case "car_reservations":
      return { body: `${actor} שריינ/ה את הרכב: ${fmtDate(r.starts_at)} עד ${fmtDate(r.ends_at)}${purposeLine(r)}`, screen: "car" };
    case "car_recurring_rules":
      return { body: `${actor} שריינ/ה את הרכב בקביעות: ${fmtRecurring(r)}${purposeLine(r)}`, screen: "car" };
    case "announcements":
      return { body: `${actor} פרסם/ה מודעה: ${r.title ?? ""}`, screen: "announcements" };
    case "issues":
      return { body: `${actor} דיווח/ה על תקלה: ${r.title ?? ""}`, screen: "issues" };
  }
}

async function sendPush(
  supabase: Supa,
  tokens: string[],
  title: string,
  body: string,
  screen: string,
): Promise<{ sent: number; removed: number }> {
  let sent = 0;
  const dead: string[] = [];
  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100);
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch.map((to) => ({
        to, title, body, sound: "default", channelId: "default", priority: "high", data: { screen },
      }))),
    });
    if (!res.ok) {
      console.error(`expo push ${res.status}: ${await res.text()}`);
      continue;
    }
    const { data } = await res.json() as { data: { status: string; details?: { error?: string } }[] };
    data.forEach((t, idx) => {
      if (t.status === "ok") sent++;
      else if (t.details?.error === "DeviceNotRegistered") dead.push(batch[idx]);
      else console.error("expo push ticket error", JSON.stringify(t));
    });
  }
  if (dead.length) await supabase.from("push_tokens").delete().in("token", dead);
  return { sent, removed: dead.length };
}

function renderHtml(house: string, headline: string, rows: string): string {
  return `<!doctype html>
<html lang="he" dir="rtl">
<body style="margin:0;padding:16px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;direction:rtl;text-align:right">
  <div dir="rtl" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:20px;direction:rtl;text-align:right">
    <div style="color:#6b7280;font-size:13px">${esc(house)}</div>
    <h2 style="margin:6px 0 14px;font-size:18px;color:#111827">${esc(headline)}</h2>
    <table dir="rtl" style="border-collapse:collapse;font-size:15px;color:#111827">${rows}</table>
    <p style="margin:18px 0 0;color:#9ca3af;font-size:12px">התראה אוטומטית מאפליקציית הבית המשותף.</p>
  </div>
</body>
</html>`;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Supa = ReturnType<typeof createClient>;

// העדפות התראות: מדלגים רק על מי שכיבה במפורש (false); חסר = מקבל
async function filterByPrefs(supabase: Supa, ids: string[], key: string): Promise<string[]> {
  if (ids.length === 0) return ids;
  const { data: prefRows } = await supabase.from("profiles").select("id, notify_prefs").in("id", ids);
  const off = new Set(
    (prefRows ?? [])
      .filter((p) => (p.notify_prefs as Record<string, unknown> | null)?.[key] === false)
      .map((p) => p.id as string),
  );
  return ids.filter((id) => !off.has(id));
}

// UPDATE על issues (Push בלבד, בלי מייל). הפועל = record.updated_by (נקבע ע"י טריגר ב-0010).
//  סגירה / "בטיפול": מקבל היוצר (created_by). הקצאה לאחראי חדש (לא null): מקבל האחראי החדש.
//  עדכון אחד יכול להפעיל שתי הודעות לאנשים שונים. אם אותו אדם היה מקבל שתיים (היוצר הוא גם
//  האחראי החדש) — נשלחת הודעה אחת: הודעת ההקצאה, אלא אם התקלה נסגרה (אז "נסגרה" חשובה יותר).
//  לעולם לא מתריעים לפועל עצמו; מכבדים notify_prefs.issues === false.
async function handleIssueUpdate(supabase: Supa, payload: WebhookPayload): Promise<Response> {
  const rec = payload.record;
  const old = payload.old_record;
  if (!rec || !old) return json({ skipped: "no_old_record" });
  const houseId = String(rec.house_id ?? "");
  if (!houseId) return json({ skipped: "no_house" });

  const actorId = rec.updated_by ? String(rec.updated_by) : "";
  const title = String(rec.title ?? "");
  const messages = new Map<string, string>(); // userId -> body

  const creator = rec.created_by ? String(rec.created_by) : "";
  if (old.status !== rec.status && creator) {
    if (rec.status === "closed") messages.set(creator, `התקלה "${title}" נסגרה`);
    else if (rec.status === "in_progress") messages.set(creator, `התקלה "${title}" בטיפול`);
  }
  const newAssignee = rec.assignee_id ? String(rec.assignee_id) : "";
  if (newAssignee && old.assignee_id !== rec.assignee_id) {
    const existing = messages.get(newAssignee);
    if (!(existing && rec.status === "closed")) {
      messages.set(newAssignee, `הוקצתה לך תקלה: ${title}`);
    }
  }
  if (actorId) messages.delete(actorId);
  if (messages.size === 0) return json({ skipped: "nothing_to_notify" });

  // רק חברי הבית הנוכחיים, ורק מי שלא כיבה התראות תקלות
  const { data: members, error: mErr } = await supabase
    .from("house_members").select("user_id").eq("house_id", houseId).in("user_id", [...messages.keys()]);
  if (mErr) return json({ error: mErr.message }, 500);
  const allowed = new Set(
    await filterByPrefs(supabase, (members ?? []).map((m) => m.user_id as string), PREF_KEY.issues),
  );
  if (allowed.size === 0) return json({ push: 0, email: 0 });

  const { data: house } = await supabase.from("houses").select("name").eq("id", houseId).maybeSingle();
  const houseName = house?.name ?? "הבית";

  let sent = 0;
  let removed = 0;
  for (const [userId, body] of messages) {
    if (!allowed.has(userId)) continue;
    const { data: tokenRows } = await supabase.from("push_tokens").select("token").eq("user_id", userId);
    const tokens = (tokenRows ?? []).map((t) => t.token as string);
    if (!tokens.length) continue;
    const r = await sendPush(supabase, tokens, houseName, body, "issues");
    sent += r.sent;
    removed += r.removed;
  }
  return json({ push: sent, pushRemoved: removed, email: 0 });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const expected = Deno.env.get("WEBHOOK_SECRET");
  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!expected || !timingSafeEqual(provided, expected)) {
    return json({ error: "unauthorized" }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  if (payload.type === "UPDATE" && payload.table === "issues") {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    return await handleIssueUpdate(sb, payload);
  }
  if (payload.type !== "INSERT") return json({ skipped: "not_insert" });
  const table = payload.table as Table;
  if (!(table in ACTOR_COLUMN) || !payload.record) return json({ skipped: "unsupported_table" });

  const record = payload.record;
  const houseId = String(record.house_id ?? "");
  const actorId = String(record[ACTOR_COLUMN[table]] ?? "");
  if (!houseId) return json({ skipped: "no_house" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const [{ data: house }, { data: members, error: mErr }, { data: actorProfile }] = await Promise.all([
    supabase.from("houses").select("name").eq("id", houseId).maybeSingle(),
    supabase.from("house_members").select("user_id").eq("house_id", houseId),
    supabase.from("profiles").select("full_name").eq("id", actorId).maybeSingle(),
  ]);
  if (mErr) return json({ error: mErr.message }, 500);

  let recipientIds = (members ?? []).map((m) => m.user_id as string).filter((id) => id !== actorId);
  recipientIds = await filterByPrefs(supabase, recipientIds, PREF_KEY[table]);
  if (recipientIds.length === 0) return json({ push: 0, email: 0 });

  const houseName = house?.name ?? "הבית";
  const actorName = actorProfile?.full_name?.trim() || "דייר";

  // --- Push (תמיד) ---
  const { data: tokenRows } = await supabase.from("push_tokens").select("token").in("user_id", recipientIds);
  const tokens = (tokenRows ?? []).map((t) => t.token as string);
  const push = buildPush(table, record, actorName);
  const pushResult = tokens.length
    ? await sendPush(supabase, tokens, houseName, push.body, push.screen)
    : { sent: 0, removed: 0 };

  // --- מייל (רק אם הוגדר Resend) ---
  let emailSent = 0;
  let emailFailed = 0;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  if (resendKey && from) {
    const emails = (await Promise.all(
      recipientIds.map(async (id) => {
        const { data } = await supabase.auth.admin.getUserById(id);
        return data?.user?.email ?? null;
      }),
    )).filter((e): e is string => !!e);

    const { subject, headline, rows } = buildMessage(table, record, actorName, houseName);
    const html = renderHtml(houseName, headline, rows);

    // מייל נפרד לכל נמען, כדי לא לחשוף כתובות זה לזה
    const results = await Promise.allSettled(emails.map(async (to) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });
      if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
    }));
    const failed = results.filter((r) => r.status === "rejected");
    failed.forEach((f) => console.error((f as PromiseRejectedResult).reason));
    emailSent = results.length - failed.length;
    emailFailed = failed.length;
  }

  return json({ push: pushResult.sent, pushRemoved: pushResult.removed, email: emailSent, emailFailed });
});
