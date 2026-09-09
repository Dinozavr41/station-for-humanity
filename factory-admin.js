import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=(n,c='RUB')=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:c,maximumFractionDigits:0}).format(Number(n||0));

async function invoke(body){
  const {data,error}=await sb.functions.invoke('factory-admin',{body});
  if(error){
    let detail=error.message;
    try{if(error.context){const j=await error.context.json();detail=j.error||detail}}catch{}
    throw new Error(detail);
  }
  if(!data?.ok)throw new Error(data?.error||'factory_admin_failed');
  return data;
}

function button(text,cls,fn){
  const b=document.createElement('button');
  b.className=cls;b.textContent=text;
  b.onclick=async()=>{b.disabled=true;try{await fn()}finally{b.disabled=false}};
  return b;
}

async function copyText(value){
  try{
    await navigator.clipboard.writeText(value);
    return true;
  }catch{
    try{
      const t=document.createElement('textarea');t.value=value;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();
      const ok=document.execCommand('copy');t.remove();return ok;
    }catch{return false}
  }
}

async function presentOnboarding(onboarding){
  if(!onboarding?.url)return;
  const copied=await copyText(onboarding.url);
  const expires=onboarding.expires_at?new Date(onboarding.expires_at).toLocaleString('ru-RU'):'через 72 часа';
  if(copied){
    alert(`LeadBot создан автоматически.\n\nСсылка подключения скопирована в буфер.\nДействует до: ${expires}\n\nОтправьте её клиенту. Секреты он введёт сам.`);
  }else{
    prompt(`LeadBot создан. Скопируйте защищённую ссылку подключения (до ${expires}):`,onboarding.url);
  }
}

async function transition(id,status,ask=false){
  let reason='';
  if(ask){
    reason=prompt(status==='rejected'?'Причина отказа:':'Причина отмены:')||'';
    if(!reason)return;
  }
  try{
    const d=await invoke({action:'transition',request_id:id,status,reason});
    if(status==='accepted'&&d.onboarding)await presentOnboarding(d.onboarding);
    await loadFactory();
  }catch(e){alert(e.message)}
}

function render(items){
  const box=$('#factoryRequests');if(!box)return;box.innerHTML='';
  if(!items.length){box.innerHTML='<article class="card muted">Коммерческих заявок пока нет.</article>';return}
  for(const r of items){
    const o=Array.isArray(r.orders)?(r.orders[0]||{}):(r.orders||{});
    const card=document.createElement('article');card.className='card';
    card.innerHTML=`<div class="card-head"><div><h3>DF-${String(r.request_no).padStart(6,'0')} · ${esc(r.customer_name)}</h3><div class="meta">${esc(r.product_code)} · ${new Date(r.created_at).toLocaleString()} · ${o.order_no?`ORD-${String(o.order_no).padStart(6,'0')}`:'без ORD'}</div></div><span class="badge">${esc(r.status)}</span></div><p class="statement">${esc(r.desired_result)}</p><div class="kv"><b>Контакт</b><span>${esc(r.contact)}</span><b>Бизнес</b><span>${esc(r.business_type||'—')}</span><b>Смета</b><span>${money(r.amount,r.currency)}</span><b>Order</b><span>${esc(o.status||'—')}</span></div><div class="actions"></div>`;
    const a=card.querySelector('.actions');
    if(['quoted','submitted'].includes(r.status))a.append(button('В review','ghost',()=>transition(r.id,'review')));
    if(['quoted','submitted','review'].includes(r.status))a.append(button('Принять → запустить автоматически','primary',()=>transition(r.id,'accepted')));
    if(['quoted','submitted','review'].includes(r.status))a.append(button('Отклонить','danger',()=>transition(r.id,'rejected',true)));
    if(['quoted','submitted','review'].includes(r.status))a.append(button('Отменить','ghost',()=>transition(r.id,'canceled',true)));
    box.append(card);
  }
}

async function loadFactory(){
  const status=$('#factoryQueueStatus');
  try{
    const d=await invoke({action:'list'});render(d.requests||[]);
    if(status)status.textContent=`QUEUE LIVE · ${(d.requests||[]).length} total · ${new Date().toLocaleTimeString()}`;
  }catch(e){if(status)status.textContent=`WAITING · ${e.message}`}
}

$('#reloadFactory')?.addEventListener('click',loadFactory);
let tries=0;
const boot=setInterval(async()=>{
  tries++;const panel=$('#consolePanel');
  if(panel&&!panel.hidden){clearInterval(boot);await loadFactory();setInterval(loadFactory,60000)}
  else if(tries>120)clearInterval(boot);
},1000);
