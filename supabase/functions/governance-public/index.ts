import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const allowedOrigins = new Set([
  "https://stationforhumanity.com",
  "https://www.stationforhumanity.com",
  "http://localhost:3000",
  "http://localhost:5173"
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://stationforhumanity.com",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin"
  };
}

function response(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=30, s-maxage=60"
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "GET") return response(req, 405, { ok: false, error: "method_not_allowed" });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "overview";

  if (action === "overview") {
    const [{ data: settings, error: se }, { data: proposals, error: pe }] = await Promise.all([
      db.from("governance_settings")
        .select("shadow_mode,binding_votes_enabled,constitution_ratified,ratified_version,notes,updated_at")
        .eq("id", 1)
        .maybeSingle(),
      db.from("governance_proposals")
        .select("proposal_no,title,summary,decision_class,protection_level,status,source_path,source_commit_sha,review_opens_at,review_closes_at,updated_at")
        .eq("is_public", true)
        .in("status", ["public_review", "accepted_as_draft", "ratified"])
        .order("proposal_no", { ascending: true })
    ]);
    if (se || pe) return response(req, 500, { ok: false, error: "governance_read_failed" });
    return response(req, 200, {
      ok: true,
      mode: settings?.shadow_mode ? "shadow" : "active",
      binding_votes_enabled: settings?.binding_votes_enabled === true,
      constitution_ratified: settings?.constitution_ratified === true,
      ratified_version: settings?.ratified_version ?? null,
      note: settings?.notes ?? null,
      proposals: proposals ?? []
    });
  }

  if (action === "proposal") {
    const n = Number(url.searchParams.get("no"));
    if (!Number.isInteger(n) || n < 1) return response(req, 400, { ok: false, error: "invalid_proposal_no" });
    const { data: proposal, error } = await db.from("governance_proposals")
      .select("id,proposal_no,title,summary,body_markdown,decision_class,protection_level,status,source_path,source_commit_sha,review_opens_at,review_closes_at,updated_at")
      .eq("proposal_no", n).eq("is_public", true)
      .in("status", ["public_review", "accepted_as_draft", "ratified"]).maybeSingle();
    if (error) return response(req, 500, { ok: false, error: "proposal_read_failed" });
    if (!proposal) return response(req, 404, { ok: false, error: "proposal_not_found" });

    const [{ data: reviews }, { data: versions }] = await Promise.all([
      db.from("governance_reviews")
        .select("reviewer_role,stance,rationale,created_at")
        .eq("proposal_id", proposal.id).eq("is_public", true).order("created_at", { ascending: true }),
      db.from("governance_proposal_versions")
        .select("version_no,title,summary,change_summary,source_path,source_commit_sha,created_at")
        .eq("proposal_id", proposal.id).order("version_no", { ascending: false })
    ]);

    const { id: _id, ...publicProposal } = proposal;
    return response(req, 200, { ok: true, proposal: publicProposal, versions: versions ?? [], reviews: reviews ?? [] });
  }

  return response(req, 404, { ok: false, error: "unknown_action" });
});
