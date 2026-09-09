import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_API = "https://platform-api2.max.ru";
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
function safe(v: unknown, n = 2000) { return String(v ?? "").trim().slice(0, n); }
function html(v: unknown, n = 2000) {
  return safe(v, n).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function ctEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
function norm(v: unknown) { return safe(v, 500).toLocaleLowerCase("ru-RU"); }

async function maxApi(token: string, path: string, method = "GET", body?: unknown) {
  const r = await fetch(`${MAX_API}${path}`, {
    method,
    headers: {
      Authorization: token,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 1000) }; }
  if (!r.ok || data?.success === false) {
    throw new Error(`max_${method}_${path}:${data?.message || data?.error || r.status}`);
  }
  return data;
}

function messageKeyboard(labels: string[]) {
  if (!labels.length) return undefined;
  return [{
    type: "inline_keyboard",
    payload: {
      buttons: labels.slice(0, 30).map((label) => [{ type: "message", text: safe(label, 120) }]),
    },
  }];
}

async function sendToUser(token: string, userId: string, text: string, labels: string[] = []) {
  const q = new URLSearchParams({ user_id: userId });
  return maxApi(token, `/messages?${q.toString()}`, "POST", {
    text: safe(text, 4000),
    format: "html",
    ...(labels.length ? { attachments: messageKeyboard(labels) } : {}),
  });
}

async function sendToChat(token: string, chatId: string, text: string, labels: string[] = []) {
  const q = new URLSearchParams({ chat_id: chatId });
  return maxApi(token, `/messages?${q.toString()}`, "POST", {
    text: safe(text, 4000),
    format: "html",
    ...(labels.length ? { attachments: messageKeyboard(labels) } : {}),
  });
}

function flow(cfg: any, code: string) { return cfg?.flows?.[code] || null; }
function menuItems(cfg: any) { return Array.isArray(cfg?.menu) ? cfg.menu : []; }
function menuCodeByLabel(cfg: any, text: string) {
  const n = norm(text);
  return menuItems(cfg).find((x: any) => norm(x?.label) === n)?.code || null;
}

async function showMenu(token: string, userId: string, inst: any) {
  const labels = menuItems(inst.config).map((x: any) => safe(x?.label, 120)).filter(Boolean);
  await sendToUser(
    token,
    userId,
    html(inst.config?.welcome || "Здравствуйте! Выберите действие:"),
    labels,
  );
}

async function ask(token: string, userId: string, inst: any, session: any) {
  const f = flow(inst.config, session.flow_code);
  const q = f?.questions?.[session.step_index];
  if (!q) return showMenu(token, userId, inst);
  const title = session.step_index === 0 ? `<b>${html(f.title, 120)}</b>\n\n` : "";
  const labels = q.type === "choice" && Array.isArray(q.options)
    ? q.options.map((o: any) => safe(o, 120)).filter(Boolean)
    : [];
  await sendToUser(token, userId, title + html(q.text, 700), labels);
}

function calcEstimate(cfg: any, answers: any) {
  const c = cfg?.calculator || {};
  if (!c.enabled || !c.configured) return { available: false, reason: "rates_not_configured" };
  const r = c.rates || {};
  let amount = Number(r.base || 0)
    + Number(answers.light_points || 0) * Number(r.per_point || 0)
    + Number(answers.area_m2 || 0) * Number(r.per_m2 || 0);
  const m = Number(r.object_multipliers?.[answers.object_type] || 1);
  amount = Math.round(amount * m);
  return {
    available: true,
    kind: "preliminary",
    amount,
    currency: c.currency || "RUB",
    breakdown: {
      base: Number(r.base || 0),
      light_points: Number(answers.light_points || 0),
      per_point: Number(r.per_point || 0),
      area_m2: Number(answers.area_m2 || 0),
      per_m2: Number(r.per_m2 || 0),
      multiplier: m,
    },
  };
}

async function postSink(url: string, payload: any, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  const text = await r.text();
  if (!r.ok) throw new Error(`http_${r.status}:${text.slice(0, 300)}`);
  return { text: text.slice(0, 1000), status: r.status };
}

async function syncOutbox(inst: any, lead: any, secrets: any) {
  const payload = {
    schema: "sfh/leadbot-lead/v1",
    instance: inst.public_slug,
    business: inst.business_name,
    source_channel: "max",
    lead: {
      number: lead.lead_no,
      flow_code: lead.flow_code,
      contact: lead.contact,
      answers: lead.answers,
      estimate: lead.estimate,
      source_user_id: lead.source_user_id,
      source_username: lead.source_username,
      created_at: lead.created_at,
    },
  };
  const sinks: any[] = [];
  if (inst.features?.google_sheets) sinks.push(["google_sheets", secrets.google_sheets_url, null]);
  if (inst.features?.crm_basic) sinks.push(["crm", secrets.crm_url, secrets.crm_token]);
  if (inst.features?.webhook_api) sinks.push(["webhook", secrets.webhook_url, secrets.webhook_token]);
  for (const [sink, url, token] of sinks) {
    const { data: ob } = await service.from("leadbot_outbox")
      .upsert({
        instance_id: inst.id,
        lead_id: lead.id,
        sink,
        payload,
        status: url ? "processing" : "failed",
        attempts: 1,
        last_error: url ? null : "credentials_missing",
      }, { onConflict: "lead_id,sink" })
      .select("id").single();
    if (!url || !ob?.id) continue;
    try {
      const response = await postSink(url, payload, token);
      await service.from("leadbot_outbox").update({ status: "succeeded", response, last_error: null }).eq("id", ob.id);
    } catch (e) {
      await service.from("leadbot_outbox").update({
        status: "failed",
        last_error: safe((e as any)?.message || e, 1000),
        next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      }).eq("id", ob.id);
    }
  }
}

function fmtAnswers(a: any) {
  return Object.entries(a || {}).map(([k, v]) => `• <b>${html(k, 80)}</b>: ${html(v, 300)}`).join("\n");
}

async function finalize(
  token: string,
  userId: string,
  inst: any,
  secrets: any,
  session: any,
  eventKey: string,
  user: any,
) {
  const estimate = calcEstimate(inst.config, session.answers || {});
  const fallback = user?.username ? `@${user.username}` : "";
  const contact = safe(session.answers?.contact || fallback, 180) || null;
  const { data: lead, error } = await service.from("leadbot_leads").insert({
    instance_id: inst.id,
    source_channel: "max",
    source_event_key: eventKey,
    source_chat_id: userId,
    source_user_id: userId,
    source_username: user?.username || null,
    flow_code: session.flow_code,
    contact,
    answers: session.answers || {},
    estimate,
  }).select("*").single();
  if (error) throw new Error(`lead_insert:${error.message}`);

  await service.from("leadbot_channel_sessions").delete()
    .eq("instance_id", inst.id).eq("channel", "max").eq("chat_id", userId);
  await service.from("leadbot_events").insert({
    instance_id: inst.id,
    lead_id: lead.id,
    event_type: "lead.created",
    payload: { lead_no: lead.lead_no, flow_code: lead.flow_code, source_channel: "max" },
  });
  await syncOutbox(inst, lead, secrets);

  let userText = `Спасибо! Заявка <b>LB-${String(lead.lead_no).padStart(6, "0")}</b> принята.`;
  if (estimate.available) {
    userText += `\nПредварительная стоимость: <b>${Number(estimate.amount).toLocaleString("ru-RU")} ${estimate.currency === "RUB" ? "₽" : html(estimate.currency, 10)}</b>.\nФинальная цена подтверждается менеджером.`;
  } else {
    userText += "\nМенеджер уточнит детали и свяжется с вами.";
  }
  await sendToUser(token, userId, userText);

  const title = flow(inst.config, lead.flow_code)?.title || lead.flow_code;
  const managerText = `🆕 <b>Новая заявка LB-${String(lead.lead_no).padStart(6, "0")}</b>\n<b>${html(inst.business_name, 120)}</b> · ${html(title, 120)}\nКанал: <b>MAX</b>\n\n${fmtAnswers(lead.answers)}${estimate.available ? `\n\nПредварительно: <b>${Number(estimate.amount).toLocaleString("ru-RU")} ${estimate.currency === "RUB" ? "₽" : html(estimate.currency, 10)}</b>` : ""}`;
  if (secrets.max_manager_user_id) {
    await sendToUser(token, String(secrets.max_manager_user_id), managerText);
  } else if (secrets.max_manager_chat_id) {
    await sendToChat(token, String(secrets.max_manager_chat_id), managerText);
  }
  await showMenu(token, userId, inst);
}

function validate(q: any, v: unknown) {
  const s = safe(v, 1000);
  if (!s) return { ok: false, error: "Ответ не должен быть пустым." };
  if (q.type === "number") {
    const n = Number(s.replace(",", "."));
    if (!Number.isFinite(n)) return { ok: false, error: "Введите число." };
    if (q.min != null && n < Number(q.min)) return { ok: false, error: `Минимум ${q.min}.` };
    if (q.max != null && n > Number(q.max)) return { ok: false, error: `Максимум ${q.max}.` };
    return { ok: true, value: n };
  }
  return { ok: true, value: s };
}

async function handleAnswer(
  token: string,
  userId: string,
  inst: any,
  secrets: any,
  session: any,
  raw: unknown,
  eventKey: string,
  user: any,
) {
  const f = flow(inst.config, session.flow_code);
  const q = f?.questions?.[session.step_index];
  if (!q) {
    await service.from("leadbot_channel_sessions").delete()
      .eq("instance_id", inst.id).eq("channel", "max").eq("chat_id", userId);
    return showMenu(token, userId, inst);
  }
  const v = validate(q, raw);
  if (!v.ok) {
    await sendToUser(token, userId, html(v.error));
    return ask(token, userId, inst, session);
  }
  const answers = { ...(session.answers || {}), [q.key]: v.value };
  const next = session.step_index + 1;
  if (next >= f.questions.length) {
    return finalize(token, userId, inst, secrets, { ...session, answers }, eventKey, user);
  }
  const updated = { ...session, answers, step_index: next };
  await service.from("leadbot_channel_sessions").update({ answers, step_index: next })
    .eq("instance_id", inst.id).eq("channel", "max").eq("chat_id", userId);
  return ask(token, userId, inst, updated);
}

function words(s: string) {
  return new Set(s.toLowerCase().replace(/[^a-zа-яё0-9 ]/gi, " ").split(/\s+/).filter((x) => x.length > 2));
}
function staticFaq(cfg: any, q: string) {
  const qw = words(q);
  let best: any = null;
  let score = 0;
  for (const x of cfg?.faq || []) {
    const w = words(`${x.q} ${x.a}`);
    let s = 0;
    for (const t of qw) if (w.has(t)) s++;
    if (s > score) { score = s; best = x; }
  }
  return score > 0 ? best?.a : null;
}

function extractUpdate(update: any) {
  const type = safe(update?.update_type, 50);
  if (type === "bot_started") {
    const user = update?.user || {};
    const userId = safe(user?.user_id, 100);
    return {
      type,
      user,
      userId,
      text: "/start",
      eventKey: `bot_started:${safe(update?.timestamp, 40)}:${userId}`,
    };
  }
  if (type === "message_created") {
    const msg = update?.message || {};
    const user = msg?.sender || {};
    const userId = safe(user?.user_id, 100);
    const text = safe(msg?.body?.text, 2000);
    const mid = safe(msg?.body?.mid, 300);
    return {
      type,
      user,
      userId,
      text,
      eventKey: mid ? `message:${mid}` : `message:${safe(update?.timestamp, 40)}:${userId}:${text.slice(0, 80)}`,
    };
  }
  return { type, user: null, userId: "", text: "", eventKey: "" };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  const url = new URL(req.url);
  const slug = safe(url.searchParams.get("i"), 100);
  if (!slug) return json(404, { ok: false, error: "instance_missing" });

  const { data: inst } = await service.from("leadbot_instances").select("*").eq("public_slug", slug).maybeSingle();
  if (!inst) return json(404, { ok: false, error: "instance_not_found" });
  if (!["active", "qa"].includes(inst.status)) return json(503, { ok: false, error: "instance_inactive" });

  const { data: secrets, error: secretError } = await service.rpc("leadbot_get_secrets", { p_instance_id: inst.id });
  if (secretError || !secrets?.max_bot_token || !secrets?.max_webhook_secret) {
    return json(503, { ok: false, error: "max_instance_not_ready" });
  }

  const suppliedSecret = req.headers.get("x-max-bot-api-secret") || "";
  if (!ctEqual(suppliedSecret, String(secrets.max_webhook_secret))) {
    return json(401, { ok: false, error: "invalid_webhook_secret" });
  }

  let update: any;
  try { update = await req.json(); } catch { return json(400, { ok: false, error: "invalid_json" }); }
  const parsed = extractUpdate(update);
  if (!["bot_started", "message_created"].includes(parsed.type)) return json(200, { ok: true, ignored: true });
  if (!parsed.userId || parsed.user?.is_bot) return json(200, { ok: true, ignored: true });

  if (parsed.eventKey) {
    const { error: receiptError } = await service.from("leadbot_channel_receipts").insert({
      instance_id: inst.id,
      channel: "max",
      event_key: parsed.eventKey,
    });
    if (receiptError?.code === "23505") return json(200, { ok: true, duplicate: true });
    if (receiptError) return json(500, { ok: false, error: "receipt_failed" });
  }

  try {
    const token = String(secrets.max_bot_token);
    const userId = parsed.userId;
    const text = parsed.text;

    if (parsed.type === "bot_started" || ["/start", "/menu", "меню"].includes(norm(text))) {
      await service.from("leadbot_channel_sessions").delete()
        .eq("instance_id", inst.id).eq("channel", "max").eq("chat_id", userId);
      await showMenu(token, userId, inst);
      return json(200, { ok: true });
    }

    const { data: session } = await service.from("leadbot_channel_sessions").select("*")
      .eq("instance_id", inst.id).eq("channel", "max").eq("chat_id", userId).maybeSingle();

    if (session?.mode === "faq") {
      const answer = staticFaq(inst.config, text)
        || "По этому вопросу лучше уточнит менеджер. Выберите нужный раздел и оставьте заявку.";
      await sendToUser(token, userId, html(answer, 1800));
      await service.from("leadbot_channel_sessions").delete()
        .eq("instance_id", inst.id).eq("channel", "max").eq("chat_id", userId);
      await showMenu(token, userId, inst);
      return json(200, { ok: true });
    }

    if (!session) {
      const code = menuCodeByLabel(inst.config, text);
      if (!code) {
        await showMenu(token, userId, inst);
        return json(200, { ok: true, menu: true });
      }
      if (code === "faq") {
        await service.from("leadbot_channel_sessions").upsert({
          instance_id: inst.id,
          channel: "max",
          chat_id: userId,
          user_id: userId,
          username: parsed.user?.username || null,
          flow_code: "faq",
          mode: "faq",
          step_index: 0,
          answers: {},
        }, { onConflict: "instance_id,channel,chat_id" });
        await sendToUser(token, userId, "Напишите вопрос об услугах — отвечу по нашей базе знаний.");
        return json(200, { ok: true });
      }
      if (!flow(inst.config, code)) {
        await showMenu(token, userId, inst);
        return json(200, { ok: true });
      }
      const s = {
        instance_id: inst.id,
        channel: "max",
        chat_id: userId,
        user_id: userId,
        username: parsed.user?.username || null,
        flow_code: code,
        mode: "flow",
        step_index: 0,
        answers: {},
      };
      await service.from("leadbot_channel_sessions").upsert(s, { onConflict: "instance_id,channel,chat_id" });
      await ask(token, userId, inst, s);
      return json(200, { ok: true });
    }

    if (session.mode === "flow") {
      const q = flow(inst.config, session.flow_code)?.questions?.[session.step_index];
      let value: any = text;
      if (q?.type === "choice" && Array.isArray(q.options)) {
        const match = q.options.find((o: any) => norm(o) === norm(text));
        if (match == null) {
          await sendToUser(token, userId, "Выберите один из вариантов ниже.");
          await ask(token, userId, inst, session);
          return json(200, { ok: true, invalid_choice: true });
        }
        value = match;
      }
      await handleAnswer(token, userId, inst, secrets, session, value, parsed.eventKey, parsed.user);
      return json(200, { ok: true });
    }

    await showMenu(token, userId, inst);
    return json(200, { ok: true });
  } catch (e) {
    const detail = safe((e as any)?.message || e, 1000);
    await service.from("leadbot_events").insert({
      instance_id: inst.id,
      event_type: "runtime.error",
      payload: { source_channel: "max", detail },
    }).catch(() => {});
    return json(500, { ok: false, error: "runtime_error", detail });
  }
});
