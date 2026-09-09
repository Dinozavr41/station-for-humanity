import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let timer=null;

async function invoke(action,payload={}){
  const {data,error}=await sb.functions.invoke('leadbot-whatsapp-admin',{body:{action,order_no:4,...payload}});
  if(error){let detail=error.message;try{if(error.context){const j=await error.context.json();detail=j.error+(j.detail?`: ${j.detail}`:'')+(j.note?` · ${j.note}`:'')}}catch{}throw new Error(detail)}
  if(!data?.ok)throw new Error(data?.error||'leadbot_whatsapp_admin_failed');
  return data;
}
function state(label,ok,note=''){return `<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span>${esc(label)}${note?`<small class="muted" style="display:block">${esc(note)}</small>`:''}</span><strong class="${ok?'on':'off'}">${ok?'READY':'WAITING'}</strong></div>`}
function ensurePanel(){
  if($('#focusWhatsappPanel'))return;
  const anchor=$('#focusMaxPanel')||$('#leadbotPanel')||$('#factoryRequests')?.closest('.panel')||$('#financeHealthPanel');
  if(!anchor)return;
  const section=document.createElement('section');
  section.id='focusWhatsappPanel';section.className='panel';section.style.marginTop='16px';
  section.innerHTML=`<div class="toolbar"><div><p class="eyebrow">PILOT · MULTICHANNEL</p><h2 style="margin:.25rem 0">ORD-000004 · ООО «Фокус» · WhatsApp</h2></div><button id="focusWhatsappReload" class="ghost">Обновить</button></div><p class="muted">Официальный WhatsApp Cloud API. Access token и App Secret отправляются только в защищённую admin Edge Function и сохраняются в Supabase Vault.</p><div id="focusWhatsappBody">Загрузка…</div>`;
  anchor.insertAdjacentElement('afterend',section);$('#focusWhatsappReload').onclick=load;
}
function render(d){
  const r=d.readiness||{},phone=d.phone||{},sub=d.subscription||{};
  const subscribed=Array.isArray(sub.data)?sub.data.length>0:!!sub.success;
  $('#focusWhatsappBody').innerHTML=`
    <div class="hero-grid" style="margin-top:14px">
      <article class="panel metric"><small>WHATSAPP</small><strong class="${r.whatsapp_ready?'on':'off'}">${r.whatsapp_ready?'READY':'WAITING'}</strong><span>${esc(phone.display_phone_number||'Cloud API credentials required')}</span></article>
      <article class="panel metric"><small>WABA</small><strong class="${r.whatsapp_waba_id?'on':'off'}">${r.whatsapp_waba_id?'READY':'WAITING'}</strong><span>${esc(phone.verified_name||'ООО «Фокус»')}</span></article>
      <article class="panel metric"><small>WEBHOOK</small><strong class="${subscribed?'on':'off'}">${subscribed?'ACTIVE':'WAITING'}</strong><span>messages → Station</span></article>
      <article class="panel metric"><small>MANAGER</small><strong class="${r.whatsapp_manager?'on':'off'}">${r.whatsapp_manager?'READY':'WAITING'}</strong><span>уведомления / MiniCRM</span></article>
    </div>
    <div style="display:grid;grid-template-columns:minmax(280px,.9fr) minmax(380px,1.4fr);gap:18px;margin-top:16px">
      <div>
        <h3>Готовность</h3>
        ${state('Access token',!!r.whatsapp_access_token,'WhatsApp Business Platform')}
        ${state('App Secret',!!r.whatsapp_app_secret,'проверка X-Hub-Signature-256')}
        ${state('Phone Number ID',!!r.whatsapp_phone_number_id)}
        ${state('WABA ID',!!r.whatsapp_waba_id)}
        ${state('Graph API version',!!r.whatsapp_graph_version)}
        ${state('Webhook verify token',!!r.whatsapp_verify_token,'Station создаёт сама')}
        ${state('Manager phone',!!r.whatsapp_manager)}
        <p class="muted" style="margin-top:12px">Quality: ${esc(phone.quality_rating||'—')}. Свободные исходящие сообщения WhatsApp подчиняются customer-service window; для постоянных проактивных уведомлений менеджеру позже используем approved template.</p>
      </div>
      <div>
        <h3>1. WhatsApp Cloud API credentials</h3>
        <label>Access token<input id="waAccessToken" type="password" autocomplete="off" placeholder="System User / access token"></label>
        <label>App Secret<input id="waAppSecret" type="password" autocomplete="off" placeholder="Meta App Secret"></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>Phone Number ID<input id="waPhoneId" inputmode="numeric" placeholder="123456789..."></label><label>WABA ID<input id="waWabaId" inputmode="numeric" placeholder="123456789..."></label></div>
        <label>Graph API version<input id="waGraphVersion" placeholder="Например: vXX.X"></label>
        <button id="waSaveCredentials" class="primary" style="margin-top:8px">Проверить и сохранить в Vault</button>
        <h3 style="margin-top:22px">2. Менеджер</h3>
        <label>WhatsApp номер менеджера<input id="waManagerPhone" inputmode="tel" placeholder="79991234567"></label>
        <div class="row" style="margin-top:8px"><button id="waSaveManager" class="ghost">Сохранить</button><button id="waTestManager" class="ghost">Тест</button></div>
        <h3 style="margin-top:22px">3. Webhook</h3>
        <button id="waActivate" class="primary">Подписать WABA на Station</button>
        <p class="muted">Station сама создаёт verify token и регистрирует callback для `focus-biysk-pilot`; секреты в интерфейсе повторно не показываются.</p>
      </div>
    </div>`;
  $('#waSaveCredentials').onclick=async()=>{
    const access_token=$('#waAccessToken')?.value?.trim(),app_secret=$('#waAppSecret')?.value?.trim(),phone_number_id=$('#waPhoneId')?.value?.trim(),waba_id=$('#waWabaId')?.value?.trim(),graph_version=$('#waGraphVersion')?.value?.trim();
    if(!access_token||!app_secret||!phone_number_id||!waba_id||!graph_version)return alert('Заполните все пять полей WhatsApp Cloud API.');
    try{const x=await invoke('set_credentials',{access_token,app_secret,phone_number_id,waba_id,graph_version});$('#waAccessToken').value='';$('#waAppSecret').value='';alert(`WhatsApp credentials приняты${x.phone?.display_phone_number?`. Номер: ${x.phone.display_phone_number}`:''}`);await load()}catch(e){alert(e.message)}
  };
  $('#waSaveManager').onclick=async()=>{const phone=$('#waManagerPhone')?.value?.trim();if(!phone)return alert('Введите номер менеджера.');try{await invoke('set_manager',{phone});alert('WhatsApp manager сохранён.');await load()}catch(e){alert(e.message)}};
  $('#waActivate').onclick=async()=>{try{await invoke('activate');alert('WhatsApp WABA подписан на Station webhook.');await load()}catch(e){alert(e.message)}};
  $('#waTestManager').onclick=async()=>{try{await invoke('test_manager');alert('Тестовое WhatsApp-сообщение отправлено.')}catch(e){alert(e.message)}};
}
async function load(){ensurePanel();const {data:{session}}=await sb.auth.getSession();if(!session||$('#consolePanel')?.hidden)return;try{render(await invoke('snapshot'))}catch(e){if($('#focusWhatsappBody'))$('#focusWhatsappBody').innerHTML=`<div class="off">WAITING · ${esc(e.message)}</div>`}}
ensurePanel();sb.auth.onAuthStateChange(()=>setTimeout(load,350));document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});setTimeout(load,1300);timer=setInterval(load,30000);
