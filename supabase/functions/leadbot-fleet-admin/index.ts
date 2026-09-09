import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";

const S=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(S,K,{auth:{persistSession:false}});
const ORIGINS=new Set(["https://stationforhumanity.com","https://www.stationforhumanity.com"]);
const READ_ROLES=new Set(["operator","finance","risk","admin"]);
const safe=(v:any,n=500)=>String(v??"").trim().slice(0,n);
function cors(o:string|null){const x=o&&ORIGINS.has(o)?o:"https://stationforhumanity.com";return{"Access-Control-Allow-Origin":x,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}}
function out(s:number,b:any,o:string|null){return new Response(JSON.stringify(b),{status:s,headers:{...cors(o),"content-type":"application/json; charset=utf-8"}})}
async function resolveInstance(b:any){
  if(b.instance_id){const {data}=await db.from("leadbot_instances").select("*").eq("id",safe(b.instance_id,100)).maybeSingle();return data}
  if(b.order_no){const {data:o}=await db.from("orders").select("id").eq("order_no",Number(b.order_no)).maybeSingle();if(!o)return null;const {data}=await db.from("leadbot_instances").select("*").eq("order_id",o.id).maybeSingle();return data}
  return null;
}

Deno.serve(async req=>{
  const origin=req.headers.get("origin");
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
  if(req.method!=="POST")return out(405,{ok:false,error:"method_not_allowed"},origin);
  if(origin&&!ORIGINS.has(origin))return out(403,{ok:false,error:"origin_not_allowed"},origin);

  const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  const {data:u,error:ue}=await db.auth.getUser(jwt);
  if(ue||!u?.user)return out(401,{ok:false,error:"invalid_session"},origin);
  const {data:p}=await db.from("profiles").select("role,status").eq("id",u.user.id).maybeSingle();
  if(!p||p.status!=="active"||!READ_ROLES.has(p.role))return out(403,{ok:false,error:"operator_access_required"},origin);

  let b:any={};try{b=await req.json()}catch{return out(400,{ok:false,error:"invalid_json"},origin)}
  const action=safe(b.action||"list",50);

  if(action==="list"){
    const {data,error}=await db.from("leadbot_instances")
      .select("id,instance_no,order_id,factory_request_id,product_code,public_slug,status,business_name,business_type,features,readiness,created_at,updated_at,activated_at,delivered_at,orders(order_no,status,quoted_amount,currency),factory_requests(request_no,status,amount,currency,selected_options)")
      .order("created_at",{ascending:false}).limit(100);
    if(error)return out(500,{ok:false,error:"fleet_read_failed",detail:error.message},origin);
    return out(200,{ok:true,role:p.role,instances:data||[]},origin);
  }

  if(action==="snapshot"){
    const i=await resolveInstance(b);
    if(!i)return out(404,{ok:false,error:"leadbot_instance_not_found"},origin);
    const {data:r}=await db.rpc("leadbot_refresh_readiness",{p_instance_id:i.id});
    const {data:o}=await db.from("orders").select("order_no,status,quoted_amount,currency,test_mode").eq("id",i.order_id).maybeSingle();
    const {data:f}=await db.from("factory_requests").select("request_no,status,amount,currency,selected_options").eq("id",i.factory_request_id).maybeSingle();
    const {data:leads,error:le}=await db.from("leadbot_leads")
      .select("id,lead_no,source_channel,source_user_id,source_username,flow_code,contact,answers,estimate,status,sync_state,created_at,updated_at")
      .eq("instance_id",i.id).order("created_at",{ascending:false}).limit(100);
    if(le)return out(500,{ok:false,error:"lead_read_failed",detail:le.message},origin);
    const {data:outbox}=await db.from("leadbot_outbox").select("id,lead_id,sink,status,attempts,last_error,next_attempt_at,created_at,updated_at").eq("instance_id",i.id).order("created_at",{ascending:false}).limit(100);
    return out(200,{ok:true,role:p.role,instance:{...i,readiness:r||i.readiness},order:o,factory:f,leads:leads||[],outbox:outbox||[]},origin);
  }

  if(action==="refresh"){
    const id=safe(b.instance_id,100);
    if(!id)return out(400,{ok:false,error:"instance_id_required"},origin);
    const {data:i}=await db.from("leadbot_instances").select("id").eq("id",id).maybeSingle();
    if(!i)return out(404,{ok:false,error:"leadbot_instance_not_found"},origin);
    const {data:r,error}=await db.rpc("leadbot_refresh_readiness",{p_instance_id:id});
    if(error)return out(500,{ok:false,error:"readiness_refresh_failed",detail:error.message},origin);
    return out(200,{ok:true,readiness:r},origin);
  }

  if(action==="provision_request"){
    if(p.role!=="admin")return out(403,{ok:false,error:"admin_required"},origin);
    const requestId=safe(b.request_id,100);
    if(!requestId)return out(400,{ok:false,error:"request_id_required"},origin);
    const {data:r}=await db.from("factory_requests").select("id,status,product_code,request_no").eq("id",requestId).maybeSingle();
    if(!r)return out(404,{ok:false,error:"factory_request_not_found"},origin);
    if(r.status!=="accepted")return out(409,{ok:false,error:"request_not_accepted",status:r.status},origin);
    const {data:id,error}=await db.rpc("provision_leadbot_instance",{p_factory_request_id:requestId});
    if(error)return out(500,{ok:false,error:"provision_failed",detail:error.message},origin);
    await db.from("audit_log").insert({actor_user_id:u.user.id,action:"leadbot.manual_provision_requested",entity_type:"factory_request",entity_id:requestId,reason:"Admin requested idempotent LeadBot provisioning from fleet control plane.",metadata:{request_no:r.request_no,instance_id:id}});
    return out(200,{ok:true,instance_id:id},origin);
  }

  return out(400,{ok:false,error:"unknown_action"},origin);
});
