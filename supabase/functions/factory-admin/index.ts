import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const service=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ORIGINS=new Set(["https://stationforhumanity.com","https://www.stationforhumanity.com"]);
const ROLES=new Set(["operator","finance","risk","admin"]);

function cors(origin:string|null){const o=origin&&ORIGINS.has(origin)?origin:"https://stationforhumanity.com";return{"Access-Control-Allow-Origin":o,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}}
function json(status:number,body:any,origin:string|null){return new Response(JSON.stringify(body),{status,headers:{...cors(origin),"Content-Type":"application/json; charset=utf-8"}})}

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

    if(next==="accepted"&&old.product_code==="TGBOT_LEADS_V1"){
      const {data:a,error:ae}=await service.rpc("accept_factory_leadbot_request",{p_request_id:id,p_actor_user_id:u.user.id});
      if(ae)return json(500,{ok:false,error:"atomic_accept_failed",detail:ae.message},origin);
      const onboarding={
        url:`https://stationforhumanity.com/factory/onboard/?token=${encodeURIComponent(a.raw_token)}`,
        expires_at:a.expires_at,
        link_id:a.link_id,
        template_code:a.template_code,
        public_slug:a.public_slug
      };
      return json(200,{ok:true,request:{id,number:`DF-${String(a.request_no).padStart(6,"0")}`,status:"accepted"},onboarding,auto_provisioned:true});
    }

    const {error}=await service.from("factory_requests").update({status:next,updated_at:new Date().toISOString()}).eq("id",id);
    if(error)return json(500,{ok:false,error:"request_update_failed",detail:error.message},origin);

    if(next==="rejected"||next==="canceled"){
      if(old.order_id){
        const {data:o}=await service.from("orders").select("status").eq("id",old.order_id).maybeSingle();
        if(o&&["draft","quoted"].includes(o.status))await service.from("orders").update({status:"canceled",updated_at:new Date().toISOString()}).eq("id",old.order_id);
      }
    }

    await service.from("audit_log").insert({actor_user_id:u.user.id,action:`factory.request_${next}`,entity_type:"factory_request",entity_id:id,reason:reason||"Operator transition",metadata:{request_no:old.request_no,from:old.status,to:next,order_id:old.order_id}});
    return json(200,{ok:true,request:{id,number:`DF-${String(old.request_no).padStart(6,"0")}`,status:next},onboarding:null},origin);
  }

  return json(400,{ok:false,error:"unknown_action"},origin);
});
