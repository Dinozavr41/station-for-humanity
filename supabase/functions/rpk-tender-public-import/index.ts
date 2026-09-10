import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const S = Deno.env.get("SUPABASE_URL")!;
const K = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(S, K, { auth: { persistSession: false } });

const MANAGE = new Set(["platform_admin", "owner", "manager"]);
const PLATFORM = new Set(["admin", "operator"]);
const ORIGINS = new Set([
  "https://stationforhumanity.com",
  "https://www.stationforhumanity.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const MIME: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

const ext = (s: string) => s.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "bin";
const clean = (s: string) => s.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._ -]+/g, "_").replace(/\s+/g, "_").slice(-180);
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

function cors(origin: string | null) {
  const allowed = origin && ORIGINS.has(origin) ? origin : "https://stationforhumanity.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function out(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function access(uid: string, slug: string) {
  const { data: p } = await db.from("profiles").select("role,status").eq("id", uid).maybeSingle();
  const { data: w } = await db.from("rpk_workspaces").select("id,slug,name").eq("slug", slug).maybeSingle();
  if (!w) return null;
  if (p?.status === "active" && PLATFORM.has(p.role)) return { w, role: "platform_admin" };
  const { data: m } = await db.from("rpk_members").select("role,status").eq("workspace_id", w.id).eq("user_id", uid).maybeSingle();
  return m?.status === "active" ? { w, role: m.role } : null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return out(405, { ok: false, error: "method_not_allowed" }, origin);
  if (origin && !ORIGINS.has(origin)) return out(403, { ok: false, error: "origin_not_allowed" }, origin);

  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u, error: ue } = await db.auth.getUser(jwt);
  if (ue || !u?.user) return out(401, { ok: false, error: "invalid_session" }, origin);

  let body: any = {};
  try { body = await req.json(); } catch { return out(400, { ok: false, error: "invalid_json" }, origin); }
  const slug = String(body.workspace_slug || "focus-biysk").slice(0, 100);
  const needId = Number(body.need_id);
  if (!Number.isInteger(needId) || needId <= 0) return out(400, { ok: false, error: "valid_need_id_required" }, origin);

  const ctx = await access(u.user.id, slug);
  if (!ctx || !MANAGE.has(ctx.role)) return out(403, { ok: false, error: "manager_role_required" }, origin);

  const needUrl = `https://zakupki.mos.ru/newapi/api/Need/Get?needId=${needId}`;
  let need: any;
  try {
    const r = await fetch(needUrl, {
      signal: AbortSignal.timeout(25000),
      headers: { accept: "application/json, text/plain, */*", "user-agent": "Mozilla/5.0 StationTenderFetcher/1.2" },
    });
    if (!r.ok) return out(502, { ok: false, error: "need_fetch_failed", status: r.status }, origin);
    need = await r.json();
  } catch (e) {
    return out(504, { ok: false, error: "need_fetch_timeout", detail: String(e) }, origin);
  }

  const files = Array.isArray(need?.files) ? need.files : [];
  if (!files.length) return out(404, { ok: false, error: "no_public_files" }, origin);
  const external = String(need?.externalNumber || "");
  const { data: opp } = external
    ? await db.from("business_opportunities").select("id").eq("source_item_id", external).maybeSingle()
    : { data: null };
  const imported: any[] = [];

  for (const f of files) {
    const id = Number(f?.id), name = String(f?.name || "");
    if (!id || !name) continue;
    const url = `https://zakupki.mos.ru/newapi/api/FileStorage/Download?id=${id}`;
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(25000),
        headers: { accept: "*/*", "user-agent": "Mozilla/5.0 StationTenderFetcher/1.2", referer: `https://zakupki.mos.ru/purchase/${needId}` },
      });
      if (!r.ok) { imported.push({ id, name, ok: false, error: `download_${r.status}` }); continue; }
      const bytes = await r.arrayBuffer();
      const ct = r.headers.get("content-type") || MIME[ext(name)] || "application/octet-stream";
      const sha = hex(await crypto.subtle.digest("SHA-256", bytes));
      const path = `${slug}/tenders/${needId}/${id}-${clean(name)}`;
      const { error: se } = await db.storage.from("rpk-documents").upload(path, bytes, { contentType: ct, upsert: true, cacheControl: "3600" });
      if (se) { imported.push({ id, name, ok: false, error: se.message }); continue; }

      const { data: old } = await db.from("rpk_documents").select("id").eq("workspace_id", ctx.w.id).eq("storage_path", path).maybeSingle();
      const row = {
        workspace_id: ctx.w.id,
        document_type: "other",
        title: name,
        status: "archived",
        currency: "RUB",
        storage_path: path,
        payload: { source: "public_tender_import", need_id: needId, external_number: external, external_file_id: id, source_url: url, opportunity_id: opp?.id || null, raw_file_status: "stored" },
        source_kind: "imported",
        original_name: name,
        file_ext: ext(name),
        mime_type: ct,
        byte_size: bytes.byteLength,
        sha256: sha,
        indexing_status: "queued",
        received_at: new Date().toISOString(),
        created_by: u.user.id,
      };
      let doc: any, de: any;
      if (old?.id) ({ data: doc, error: de } = await db.from("rpk_documents").update(row).eq("id", old.id).select("id,original_name,storage_path,byte_size,sha256").single());
      else ({ data: doc, error: de } = await db.from("rpk_documents").insert(row).select("id,original_name,storage_path,byte_size,sha256").single());
      imported.push({ id, name, ok: !de, document: doc || null, error: de?.message || null });
    } catch (e) {
      imported.push({ id, name, ok: false, error: String(e) });
    }
  }

  const success = imported.filter((x) => x.ok).length;
  return out(success === files.length ? 200 : 207, { ok: success === files.length, need_id: needId, external_number: external, success, total: files.length, imported }, origin);
});
