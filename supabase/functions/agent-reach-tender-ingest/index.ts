import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const TOKEN=Deno.env.get('AGENT_REACH_INGEST_TOKEN')||'';
const hosts=['zakupki.gov.ru','zakupki.mos.ru','roseltorg.ru','rts-tender.ru','sberbank-ast.ru','lot-online.ru','etpgpb.ru','fabrikant.ru','b2b-center.ru','tektorg.ru'];
const host=u=>{try{return new URL(String(u)).hostname.toLowerCase().replace(/^www\./,'')}catch{return''}};
const allowed=h=>hosts.some(x=>h===x||h.endsWith('.'+x));
const text=(v,n)=>String(v??'').replace(/\u0000/g,'').trim().slice(0,n);
const num=v=>{const n=Number(String(v??'').replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)&&n>=0?n:null};
const sha=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const reply=(s,b)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return reply(405,{ok:false,error:'method_not_allowed'});
 if(!TOKEN||req.headers.get('x-agent-reach-token')!==TOKEN)return reply(401,{ok:false,error:'invalid_token'});
 let body;try{body=await req.json()}catch{return reply(400,{ok:false,error:'invalid_json'})}
 const items=Array.isArray(body?.items)?body.items.slice(0,100):[];if(!items.length)return reply(400,{ok:false,error:'items_required'});
 const {data:source,error:se}=await db.from('business_opportunity_sources').upsert({code:'agent_reach_tender_discovery',name:'Agent Reach · тендерный радар',vertical_code:'rpk',adapter_kind:'agent_reach',base_url:'https://github.com/Panniantong/Agent-Reach',active:true,polling_interval_minutes:60,config:{mode:'discovery_only',auto_submit:false,requires_human_review:true},last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'code'}).select('id').single();
 if(se||!source?.id)return reply(500,{ok:false,error:'source_upsert_failed',detail:se?.message});
 let accepted=0;const errors=[];
 for(const raw of items){const title=text(raw?.title,800),url=text(raw?.source_url,2000),h=host(url);if(title.length<4||!allowed(h)){errors.push({title,url,error:'unsupported_host_or_title'});continue}
  const p=text(raw?.purchase_number,500)||null,law=['44-FZ','223-FZ'].includes(text(raw?.law,20))?text(raw?.law,20):null,official=h==='zakupki.gov.ru'||h.endsWith('.zakupki.gov.ru');
  const fp=await sha('agent_reach|'+(p||url.replace(/[?#].*$/,'')));const now=new Date().toISOString();
  const row={source_id:source.id,source_item_id:p||fp,fingerprint:fp,vertical_code:'rpk',title,description:text(raw?.description,12000)||null,source_url:url,budget_max:num(raw?.budget_max),currency:'RUB',detected_services:[text(raw?.category,40)||'banner'],normalized:{discovery_channel:'agent-reach',discovery_score:num(raw?.discovery_score)||0,source_host:h,law,official_source:official,combat_44fz_eligible:official&&law==='44-FZ',requires_human_review:true,auto_submit:false},raw_payload:{agent_reach:raw},parse_confidence:official?.78:.55,status:'open',source_label:official?'Agent Reach · ЕИС':`Agent Reach · ${h}`,updated_at:now};
  const {data:opp,error}=await db.from('business_opportunities').upsert(row,{onConflict:'fingerprint'}).select('id').single();if(error||!opp?.id){errors.push({title,url,error:error?.message||'upsert_failed'});continue}
  await db.from('business_opportunity_events').insert({opportunity_id:opp.id,stage:'DISCOVER',event_type:'agent_reach_discovered',payload:{category:raw?.category,law,official_eis:official,discovery_score:raw?.discovery_score||0}});accepted++;
 }
 await db.from('business_opportunity_sources').update({last_checked_at:new Date().toISOString(),last_success_at:accepted?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',source.id);
 return reply(200,{ok:true,accepted,rejected:errors.length,errors:errors.slice(0,20)});
});
