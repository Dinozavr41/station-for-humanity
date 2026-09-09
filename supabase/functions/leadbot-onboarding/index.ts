import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";

const S=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(S,K,{auth:{persistSession:false}});
const ORIGINS=new Set(["https://stationforhumanity.com","https://www.stationforhumanity.com"]);
const MAX_API="https://platform-api2.max.ru";
const safe=(v:any,n=500)=>String(v??"").trim().slice(0,n);
function cors(o:string|null){const x=o&&ORIGINS.has(o)?o:"https://stationforhumanity.com";return{"Access-Control-Allow-Origin":x,"Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin","Cache-Control":"no-store"}}
function out(s:number,b:any,o:string|null){return new Response(JSON.stringify(b),{status:s,headers:{...cors(o),"content-type":"application/json; charset=utf-8"}})}
async function sha256(v:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("")}
function randomSecret(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return Array.from(a).map(x=>x.toString(16).padStart(2,"0")).join("")}
function claimCode(){const a=new Uint32Array(1);crypto.getRandomValues(a);return String(100000+(a[0]%900000))}
async function tg(token:string,method:string,body:any={}){const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false)throw Error(j?.description||`telegram_${r.status}`);return j.result}
async function maxApi(token:string,path:string,method="GET",body?:any){const r=await fetch(`${MAX_API}${path}`,{method,headers:{Authorization:token,...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json().catch(()=>({}));if(!r.ok||j?.success===false)throw Error(j?.message||j?.error||`max_${r.status}`);return j}
function graph(version:string,path:string){return `https://graph.facebook.com/${version.replace(/^\/+|\/+$/g,"")}/${path.replace(/^\//,"")}`}
async function meta(token:string,version:string,path:string,method="GET",body?:any){const r=await fetch(graph(version,path),{method,headers:{Authorization:`Bearer ${token}`,...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json().catch(()=>({}));if(!r.ok||j?.error)throw Error(j?.error?.message||`meta_${r.status}`);return j}
async function store(instanceId:string,kind:string,value:string){const {error}=await db.rpc("leadbot_store_secret",{p_instance_id:instanceId,p_kind:kind,p_value:value});if(error)throw Error(`${kind}:${error.message}`)}

async function authLink(raw:string){
  if(raw.length<32||raw.length>200)return null;
  const hash=await sha256(raw);
  const {data:l}=await db.from("leadbot_onboarding_links").select("*").eq("token_hash",hash).eq("status","active").maybeSingle();
  if(!l||new Date(l.expires_at).getTime()<=Date.now()||Number(l.attempts||0)>=30)return null;
  const {data:i}=await db.from("leadbot_instances").select("*").eq("id",l.instance_id).maybeSingle();
  if(!i||["delivered","retired"].includes(i.status))return null;
  await db.from("leadbot_onboarding_links").update({last_used_at:new Date().toISOString()}).eq("id",l.id);
  return {link:l,instance:i};
}
async function failAttempt(linkId:string){await db.rpc("increment_onboarding_attempt",{p_link_id:linkId}).catch(()=>{});}
async function refresh(instance:any,linkId:string){
  const {data:r}=await db.rpc("leadbot_refresh_readiness",{p_instance_id:instance.id});
  if(r?.channels_ready){await db.from("leadbot_onboarding_links").update({status:"completed",completed_at:new Date().toISOString()}).eq("id",linkId).eq("status","active")}
  return r||instance.readiness||{};
}
function publicState(i:any,r:any,l:any){
  const features=i.features||{};
  return {
    business_name:i.business_name,
    business_type:i.business_type,
    public_slug:i.public_slug,
    expires_at:l.expires_at,
    requested:{telegram:features.telegram!==false,max:!!features.max,whatsapp:!!features.whatsapp},
    ready:{telegram:!!r.telegram_ready,max:!!r.max_ready,whatsapp:!!r.whatsapp_ready,channels:!!r.channels_ready},
    manager_connected:!!(r.manager_chat_id||r.max_manager||r.whatsapp_manager),
    note_whatsapp:"WhatsApp Business is connected only where the platform is available to the customer."
  };
}

Deno.serve(async req=>{
  const origin=req.headers.get("origin");
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
  if(req.method!=="POST")return out(405,{ok:false,error:"method_not_allowed"},origin);
  if(origin&&!ORIGINS.has(origin))return out(403,{ok:false,error:"origin_not_allowed"},origin);
  let b:any={};try{b=await req.json()}catch{return out(400,{ok:false,error:"invalid_json"},origin)}
  const raw=safe(b.token,220),action=safe(b.action||"inspect",50);
  const ctx=await authLink(raw);
  if(!ctx)return out(401,{ok:false,error:"onboarding_link_invalid_or_expired"},origin);
  const {link,instance:i}=ctx;
  const requested={telegram:i.features?.telegram!==false,max:!!i.features?.max,whatsapp:!!i.features?.whatsapp};

  if(action==="inspect"){
    const r=await refresh(i,link.id);
    return out(200,{ok:true,state:publicState(i,r,link)},origin);
  }

  if(action==="telegram_connect"){
    if(!requested.telegram)return out(409,{ok:false,error:"telegram_not_requested"},origin);
    const token=safe(b.bot_token,10000);
    if(token.length<20){await failAttempt(link.id);return out(400,{ok:false,error:"telegram_token_required"},origin)}
    let me:any;try{me=await tg(token,"getMe")}catch(e){await failAttempt(link.id);return out(400,{ok:false,error:"telegram_token_invalid",detail:safe((e as any)?.message||e)},origin)}
    try{
      await store(i.id,"bot_token",token);
      let {data:s}=await db.rpc("leadbot_get_secrets",{p_instance_id:i.id});
      if(!s?.webhook_secret){await store(i.id,"webhook_secret",randomSecret());({data:s}=await db.rpc("leadbot_get_secrets",{p_instance_id:i.id}))}
      const webhook=`${S}/functions/v1/leadbot-telegram?i=${encodeURIComponent(i.public_slug)}`;
      await tg(token,"setWebhook",{url:webhook,secret_token:s.webhook_secret,allowed_updates:["message","callback_query"],drop_pending_updates:true});
      const code=claimCode();await store(i.id,"manager_claim_code",code);
      const r0=await refresh(i,link.id),expires=new Date(Date.now()+30*60_000).toISOString();
      await db.from("leadbot_instances").update({status:"active",activated_at:i.activated_at||new Date().toISOString(),readiness:{...r0,claim_expires_at:expires}}).eq("id",i.id);
      await db.from("audit_log").insert({action:"leadbot.customer_telegram_connected",entity_type:"leadbot_instance",entity_id:i.id,reason:"Customer connected Telegram through scoped onboarding link.",metadata:{link_id:link.id,bot_username:me?.username||null,webhook}});
      return out(200,{ok:true,channel:"telegram",bot:{username:me?.username,first_name:me?.first_name},manager_claim:{command:`/claim ${code}`,expires_at:expires},state:publicState(i,r0,link)},origin);
    }catch(e){await failAttempt(link.id);return out(502,{ok:false,error:"telegram_connect_failed",detail:safe((e as any)?.message||e)},origin)}
  }

  if(action==="max_connect"){
    if(!requested.max)return out(409,{ok:false,error:"max_not_requested"},origin);
    const token=safe(b.bot_token,10000),manager=safe(b.manager_user_id,100);
    if(token.length<20){await failAttempt(link.id);return out(400,{ok:false,error:"max_token_required"},origin)}
    let me:any;try{me=await maxApi(token,"/me")}catch(e){await failAttempt(link.id);return out(400,{ok:false,error:"max_token_invalid",detail:safe((e as any)?.message||e)},origin)}
    try{
      await store(i.id,"max_bot_token",token);
      if(manager){if(!/^-?\d+$/.test(manager))throw Error("invalid_manager_user_id");await store(i.id,"max_manager_user_id",manager)}
      let {data:s}=await db.rpc("leadbot_get_secrets",{p_instance_id:i.id});
      if(!s?.max_webhook_secret){await store(i.id,"max_webhook_secret",randomSecret());({data:s}=await db.rpc("leadbot_get_secrets",{p_instance_id:i.id}))}
      const webhook=`${S}/functions/v1/leadbot-max?i=${encodeURIComponent(i.public_slug)}`;
      await maxApi(token,"/subscriptions","POST",{url:webhook,update_types:["message_created","bot_started"],secret:s.max_webhook_secret});
      await db.from("leadbot_instances").update({status:"active",activated_at:i.activated_at||new Date().toISOString()}).eq("id",i.id);
      const r=await refresh(i,link.id);
      await db.from("audit_log").insert({action:"leadbot.customer_max_connected",entity_type:"leadbot_instance",entity_id:i.id,reason:"Customer connected MAX through scoped onboarding link.",metadata:{link_id:link.id,bot_username:me?.username||null,webhook}});
      return out(200,{ok:true,channel:"max",bot:{username:me?.username,first_name:me?.first_name},state:publicState(i,r,link)},origin);
    }catch(e){await failAttempt(link.id);return out(502,{ok:false,error:"max_connect_failed",detail:safe((e as any)?.message||e)},origin)}
  }

  if(action==="whatsapp_connect"){
    if(!requested.whatsapp)return out(409,{ok:false,error:"whatsapp_not_requested"},origin);
    const token=safe(b.access_token,10000),appSecret=safe(b.app_secret,10000),phoneId=safe(b.phone_number_id,100),wabaId=safe(b.waba_id,100),version=safe(b.graph_version,20),manager=safe(b.manager_phone,100).replace(/[^0-9]/g,"");
    if(token.length<20||appSecret.length<8||!/^[0-9]+$/.test(phoneId)||!/^[0-9]+$/.test(wabaId)||!/^v\d+\.\d+$/.test(version)){await failAttempt(link.id);return out(400,{ok:false,error:"invalid_whatsapp_credentials"},origin)}
    let phone:any;try{phone=await meta(token,version,`${phoneId}?fields=display_phone_number,verified_name,quality_rating`)}catch(e){await failAttempt(link.id);return out(400,{ok:false,error:"whatsapp_credentials_invalid",detail:safe((e as any)?.message||e)},origin)}
    try{
      await store(i.id,"whatsapp_access_token",token);await store(i.id,"whatsapp_app_secret",appSecret);await store(i.id,"whatsapp_phone_number_id",phoneId);await store(i.id,"whatsapp_waba_id",wabaId);await store(i.id,"whatsapp_graph_version",version);await store(i.id,"whatsapp_verify_token",randomSecret());
      if(manager){if(manager.length<7||manager.length>20)throw Error("invalid_manager_phone");await store(i.id,"whatsapp_manager_phone",manager)}
      const {data:s}=await db.rpc("leadbot_get_secrets",{p_instance_id:i.id});
      const webhook=`${S}/functions/v1/leadbot-whatsapp?i=${encodeURIComponent(i.public_slug)}`;
      await meta(token,version,`${wabaId}/subscribed_apps`,"POST",{override_callback_uri:webhook,verify_token:s.whatsapp_verify_token});
      await db.from("leadbot_instances").update({status:"active",activated_at:i.activated_at||new Date().toISOString()}).eq("id",i.id);
      const r=await refresh(i,link.id);
      await db.from("audit_log").insert({action:"leadbot.customer_whatsapp_connected",entity_type:"leadbot_instance",entity_id:i.id,reason:"Customer connected WhatsApp Cloud API through scoped onboarding link.",metadata:{link_id:link.id,phone_number_id:phoneId,waba_id:wabaId,display_phone_number:phone?.display_phone_number||null,webhook}});
      return out(200,{ok:true,channel:"whatsapp",phone:{display_phone_number:phone?.display_phone_number,verified_name:phone?.verified_name,quality_rating:phone?.quality_rating},state:publicState(i,r,link)},origin);
    }catch(e){await failAttempt(link.id);return out(502,{ok:false,error:"whatsapp_connect_failed",detail:safe((e as any)?.message||e)},origin)}
  }

  return out(400,{ok:false,error:"unknown_action"},origin);
});
