import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const service=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false}});
function eq(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
function csv(v:any){const s=String(v??'').replace(/"/g,'""');return /[",\n\r]/.test(s)?`"${s}"`:s}
function fmtDate(v:any){try{return new Date(v).toLocaleString('ru-RU',{timeZone:'Asia/Novosibirsk'})}catch{return String(v??'')}}
Deno.serve(async req=>{
  if(req.method!=='GET')return new Response('method_not_allowed',{status:405});
  const u=new URL(req.url),slug=(u.searchParams.get('i')||'').trim(),key=(u.searchParams.get('k')||'').trim();
  if(!slug||!key)return new Response('unauthorized',{status:401});
  const {data:inst}=await service.from('leadbot_instances').select('id,public_slug,business_name').eq('public_slug',slug).maybeSingle();
  if(!inst)return new Response('not_found',{status:404});
  const {data:s,error:se}=await service.rpc('leadbot_get_secrets',{p_instance_id:inst.id});
  if(se||!s?.google_sheets_token||!eq(String(s.google_sheets_token),key))return new Response('unauthorized',{status:401});
  const {data:rows,error}=await service.from('leadbot_leads').select('lead_no,flow_code,contact,answers,estimate,status,created_at').eq('instance_id',inst.id).order('lead_no',{ascending:true}).limit(5000);
  if(error)return new Response('read_failed',{status:500});
  const header=['Lead ID','Дата','Сценарий','Город','Тип объекта','Площадь, м²','Точек света','Материалы','Срок','Контакт','Предварительная цена','Статус'];
  const out=[header.map(csv).join(',')];
  for(const r of rows||[]){const a:any=r.answers||{},est:any=r.estimate||{};const price=est.available&&est.amount!=null?`${est.amount} ${est.currency==='RUB'?'₽':est.currency||''}`:(est.reason==='rates_not_configured'?'Не рассчитана':'');out.push([`LB-${String(r.lead_no).padStart(6,'0')}`,fmtDate(r.created_at),r.flow_code,a.city||a.address||'',a.object_type||a.object_kind||'',a.area_m2??'',a.light_points??'',a.materials||'',a.timing||a.deadline||a.preferred_time||'',r.contact||'',price,r.status].map(csv).join(','))}
  return new Response('\ufeff'+out.join('\n'),{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}})
});
