import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const service=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ORIGINS=new Set(["https://stationforhumanity.com","https://www.stationforhumanity.com"]);
const ROLES=new Set(["operator","finance","risk","admin"]);

function cors(origin:string|null){const o=origin&&ORIGINS.has(origin)?origin:"https://stationforhumanity.com";return{"Access-Control-Allow-Origin":o,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}}
function json(status:number,body:any,origin:string|null){return new Response(JSON.stringify(body),{status,headers:{...cors(origin),"Content-Type":"application/json; charset=utf-8"}})}
function randomToken(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function sha256(v:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("")}

Deno.serve(async req=>{
  const origin=req.headers.get("origin");
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
  if(req.method!=="POST")return json(405,{ok:false,error:"method_not_allowed"},origin);
  if(origin&&!ORIGINS.has(origin))return json(403,{ok:false,error:"origin_not_allowed"},origin);

  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  const {data:u,error:ue}=await service.auth.getUser(token);
  if(ue||!u?.user)return json(401,{ok:false,error:"invalid_session"},origin);
  const {data:p}=await service.from("profiles").select("role,status").eq("id",u.user.id).maybeSingle();
  if(!p||p.status!=="active"||!ROLES.has(p.role))return json(403,{ok:false,error:"operator_access_required"},origin);

  let body:any={};try{body=await req.json()}catch{return json(400,{ok:false,error:"invalid_json"},origin)}
  const action=String(body?.action||"");

  if(action==="list"){
    const {data,error}=await service.from("factory_requests")
      .select("id,request_no,product_code,customer_name,contact,business_type,desired_result,selected_options,price_breakdown,amount,currency,price_version,status,created_at,updated_at,orders(order_no,status,quoted_amount,currency)")
      .order("created_at",{ascending:false}).limit(100);
    if(error)return json(500,{ok:false,error:"factory_requests_read_failed",detail:error.message},origin);
    return json(200,{ok:true,requests:data||[]},origin);
  }

  if(action==="transition"){
    const id=String(body?.request_id||"");
    const next=String(body?.status||"");
    const reason=String(body?.reason||"").trim().slice(0,500);
    if(!id||!["review","accepted","rejected","canceled"].includes(next))return json(400,{ok:false,error:"invalid_transition_request"},origin);
    if(["rejected","canceled"].includes(next)&&!reason)return json(400,{ok:false,error:"reason_required"},origin);

    const {data:old}=await service.from("factory_requests").select("id,request_no,status,order_id,product_code").eq("id",id).maybeSingle();
    if(!old)return json(404,{ok:false,error:"request_not_found"},origin);
    const allowed:any={quoted:["review","accepted","rejected","canceled"],submitted:["review","accepted","rejected","canceled"],review:["accepted","rejected","canceled"]};
    if(!(allowed[old.status]||[]).includes(next))return json(409,{ok:false,error:"invalid_transition",from:old.status,to:next},origin);

    const {error}=await service.from("factory_requests").update({status:next,updated_at:new Date().toISOString()}).eq("id",id);
    if(error)return json(500,{ok:false,error:"request_update_failed",detail:error.message},origin);

    if(next==="rejected"||next==="canceled"){
      if(old.order_id){
        const {data:o}=await service.from("orders").select("status").eq("id",old.order_id).maybeSingle();
        if(o&&["draft","quoted"].includes(o.status))await service.from("orders").update({status:"canceled",updated_at:new Date().toISOString()}).eq("id",old.order_id);
      }
    }

    let onboarding:any=null;
    if(next==="accepted"&&old.product_code==="TGBOT_LEADS_V1"){
      const {data:i}=await service.from("leadbot_instances").select("id,order_id,public_slug,business_name").eq("factory_request_id",id).maybeSingle();
      if(!i)return json(500,{ok:false,error:"leadbot_auto_provision_missing"},origin);
      const raw=randomToken(32),hash=await sha256(raw),expires=new Date(Date.now()+72*3600_000).toISOString();
      await service.from("leadbot_onboarding_links").update({status:"revoked"}).eq("instance_id",i.id).eq("status","active");
      const {data:l,error:le}=await service.from("leadbot_onboarding_links").insert({instance_id:i.id,token_hash:hash,status:"active",expires_at:expires,created_by:u.user.id,metadata:{created_from:"factory_accept",request_no:old.request_no,public_slug:i.public_slug}}).select("id").single();
      if(le)return json(500,{ok:false,error:"onboarding_link_create_failed",detail:le.message},origin);
      onboarding={url:`https://stationforhumanity.com/factory/onboard/?token=${encodeURIComponent(raw)}`,expires_at:expires,link_id:l.id};
      await service.from("audit_log").insert({actor_user_id:u.user.id,action:"leadbot.onboarding_link_created",entity_type:"leadbot_instance",entity_id:i.id,reason:"Factory acceptance automatically generated customer onboarding handoff.",metadata:{request_no:old.request_no,order_id:i.order_id,link_id:l.id,expires_at:expires}});
    }

    await service.from("audit_log").insert({actor_user_id:u.user.id,action:`factory.request_${next}`,entity_type:"factory_request",entity_id:id,reason:reason||"Operator transition",metadata:{request_no:old.request_no,from:old.status,to:next,order_id:old.order_id,onboarding_created:!!onboarding}});
    return json(200,{ok:true,request:{id,number:`DF-${String(old.request_no).padStart(6,"0")}`,status:next},onboarding},origin);
  }

  return json(400,{ok:false,error:"unknown_action"},origin);
});
