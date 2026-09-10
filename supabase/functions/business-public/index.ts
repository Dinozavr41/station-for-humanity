import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const S=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(S,K,{auth:{persistSession:false}});
const ORIGINS=new Set(["https://stationforhumanity.com","https://www.stationforhumanity.com","http://localhost:3000","http://127.0.0.1:3000"]);
function cors(o:string|null){const x=o&&ORIGINS.has(o)?o:"https://stationforhumanity.com";return{"Access-Control-Allow-Origin":x,"Access-Control-Allow-Headers":"content-type, apikey, x-client-info","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Vary":"Origin"}}
function out(s:number,b:any,o:string|null){return new Response(JSON.stringify(b),{status:s,headers:{...cors(o),"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=30"}})}
Deno.serve(async req=>{
 const origin=req.headers.get("origin");if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});if(origin&&!ORIGINS.has(origin))return out(403,{ok:false,error:"origin_not_allowed"},origin);if(!["GET","POST"].includes(req.method))return out(405,{ok:false,error:"method_not_allowed"},origin);
 const [{data:regs,error:re},{data:profiles,error:pe},{data:plans,error:ple},{data:addons,error:ae}]=await Promise.all([
  db.from("business_workspace_registry").select("id,vertical_code,name,legal_name,city,status,slug,route_path").neq("status","archived"),
  db.from("business_network_profiles").select("workspace_id,discoverable,display_name,headline,about,offers,needs,updated_at").eq("discoverable",true).order("updated_at",{ascending:false}).limit(80),
  db.from("business_subscription_plans").select("code,vertical_code,name_ru,billing_months,monthly_price,total_price,discount_pct,currency,features,sort_order").eq("active",true).order("sort_order"),
  db.from("business_addons").select("code,vertical_code,name_ru,description_ru,pricing_kind,price_from,currency,sort_order").eq("active",true).order("sort_order")
 ]);
 if(re||pe||ple||ae)return out(500,{ok:false,error:"public_snapshot_failed"},origin);
 const regMap=new Map((regs||[]).map((r:any)=>[r.id,r]));const counts:any={};for(const r of regs||[])counts[r.vertical_code]=(counts[r.vertical_code]||0)+1;
 const directory=(profiles||[]).map((p:any)=>{const r=regMap.get(p.workspace_id);if(!r)return null;return{workspace_id:p.workspace_id,vertical_code:r.vertical_code,company_name:p.display_name||r.name,city:r.city,headline:p.headline,about:p.about,offers:p.offers||[],needs:p.needs||[],entry_path:r.route_path||null,workspace_slug:r.slug||null}}).filter(Boolean);
 return out(200,{ok:true,company_count:(regs||[]).length,company_counts_by_vertical:counts,directory,plans:plans||[],addons:addons||[],payment_live:false},origin);
});