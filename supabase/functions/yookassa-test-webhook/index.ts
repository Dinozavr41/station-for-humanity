import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHOP_ID=Deno.env.get("YOOKASSA_TEST_SHOP_ID")||"";
const SECRET=Deno.env.get("YOOKASSA_TEST_SECRET_KEY")||"";
const service=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false}});
function authHeader(){return `Basic ${btoa(`${SHOP_ID}:${SECRET}`)}`}
function safeProvider(p:any){return{id:p?.id||null,status:p?.status||null,paid:!!p?.paid,test:p?.test===true,amount:p?.amount||null,confirmation:p?.confirmation?{type:p.confirmation.type}:null,created_at:p?.created_at||null,refundable:!!p?.refundable,metadata:p?.metadata||{}}}
function canonical(status:string){if(status==='succeeded')return'succeeded';if(status==='canceled')return'canceled';if(status==='waiting_for_capture')return'waiting_for_capture';return'pending'}
async function providerGet(id:string){const r=await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(id)}`,{headers:{Authorization:authHeader(),Accept:'application/json'}});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`yookassa_${r.status}:${body?.description||body?.type||'api_error'}`);return body;}
async function audit(action:string,type:string,id:string|null,reason:string|null,metadata:any={}){await service.from('audit_log').insert({actor_user_id:null,action,entity_type:type,entity_id:id,reason,metadata});}

Deno.serve(async(req)=>{
 if(req.method!=='POST')return new Response('method_not_allowed',{status:405});
 if(!SHOP_ID||!SECRET)return new Response('credentials_missing',{status:503});
 let body:any={};try{body=await req.json()}catch{return new Response('bad_json',{status:400})}
 const event=String(body?.event||'');const objectId=String(body?.object?.id||'');if(!event.startsWith('payment.')||!objectId)return new Response('ignored',{status:200});
 const {data:local}=await service.from('payments').select('*').eq('provider','yookassa_test').eq('external_payment_id',objectId).eq('test_mode',true).maybeSingle();if(!local)return new Response('ignored',{status:200});
 let remote:any;try{remote=await providerGet(objectId)}catch{return new Response('provider_verify_failed',{status:500})}
 const remoteAmount=Number(remote?.amount?.value);if(remote?.id!==objectId||remote?.test!==true||remote?.amount?.currency!==local.currency||Math.abs(remoteAmount-Number(local.amount))>0.0001)return new Response('verification_mismatch',{status:400});
 const safe=safeProvider(remote);const fingerprint=`yktest:webhook:${event}:${objectId}:${remote.status}`;const ev=await service.from('payment_events').upsert({payment_id:local.id,provider:'yookassa_test',event_type:event,event_fingerprint:fingerprint,external_object_id:objectId,verified:true,raw_payload:safe,received_at:new Date().toISOString(),processed_at:new Date().toISOString()},{onConflict:'event_fingerprint'}).select('id').maybeSingle();
 await service.from('payments').update({provider_status:remote.status,provider_payload:safe,canonical_status:canonical(remote.status),updated_at:new Date().toISOString()}).eq('id',local.id);
 if(remote.status==='succeeded'){
   const {error}=await service.rpc('process_verified_yookassa_test_payment',{p_payment_id:local.id,p_external_payment_id:remote.id,p_provider_status:remote.status,p_provider_payload:safe,p_actor_user_id:null});if(error)return new Response('ledger_apply_failed',{status:500});
   await audit('webhook.yookassa_test_succeeded','payment',local.id,'Verified YooKassa TEST webhook against provider API',{event,external_payment_id:objectId,order_id:local.order_id,test_mode:true,event_row_id:ev.data?.id||null});
 }else if(remote.status==='canceled'){
   const {data:o}=await service.from('orders').select('id,order_no,status').eq('id',local.order_id).maybeSingle();if(o?.status==='awaiting_payment'){await service.from('orders').update({status:'manual_review',updated_at:new Date().toISOString()}).eq('id',o.id);await service.from('order_events').insert({order_id:o.id,event_type:'payment.canceled',from_status:'awaiting_payment',to_status:'manual_review',actor_user_id:null,reason:'Verified YooKassa TEST cancellation webhook',payload:{payment_id:local.id,external_payment_id:objectId,test_mode:true}});}await audit('webhook.yookassa_test_canceled','payment',local.id,'Verified YooKassa TEST webhook against provider API',{event,external_payment_id:objectId,order_id:local.order_id,test_mode:true,event_row_id:ev.data?.id||null});
 }else{
   await audit('webhook.yookassa_test_event','payment',local.id,'Verified YooKassa TEST webhook against provider API',{event,external_payment_id:objectId,provider_status:remote.status,order_id:local.order_id,test_mode:true,event_row_id:ev.data?.id||null});
 }
 return new Response('ok',{status:200});
});
