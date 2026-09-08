import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const service=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-api-key, content-type","Access-Control-Allow-Methods":"GET, OPTIONS"};
function json(status:number,body:any){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}})}
function eq(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='GET')return json(405,{ok:false,error:'method_not_allowed'});
  const u=new URL(req.url),slug=(u.searchParams.get('i')||'').trim();
  if(!slug)return json(400,{ok:false,error:'instance_required'});
  const {data:inst}=await service.from('leadbot_instances').select('id,public_slug,business_name,status').eq('public_slug',slug).maybeSingle();
  if(!inst)return json(404,{ok:false,error:'instance_not_found'});
  const {data:s,error:se}=await service.rpc('leadbot_get_secrets',{p_instance_id:inst.id});
  if(se||!s?.webhook_token)return json(503,{ok:false,error:'api_not_configured'});
  const supplied=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')||req.headers.get('x-api-key')||'';
  if(!supplied||!eq(String(s.webhook_token),supplied))return json(401,{ok:false,error:'invalid_api_key'});
  const limit=Math.max(1,Math.min(100,Number(u.searchParams.get('limit')||50))),status=(u.searchParams.get('status')||'').trim();
  let q=service.from('leadbot_leads').select('lead_no,flow_code,contact,answers,estimate,status,created_at,updated_at').eq('instance_id',inst.id).order('created_at',{ascending:false}).limit(limit);
  if(status)q=q.eq('status',status);
  const {data,error}=await q;if(error)return json(500,{ok:false,error:'lead_read_failed'});
  return json(200,{ok:true,schema:'sfh/leadbot-client-api/v1',instance:{slug:inst.public_slug,business_name:inst.business_name},count:(data||[]).length,leads:data||[]});
});
