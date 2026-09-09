import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const rel=v=>Array.isArray(v)?v[0]:v;
const money=(v,c='RUB')=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:c||'RUB',maximumFractionDigits:0}).format(Number(v||0));
const fmt=v=>v?new Date(v).toLocaleString('ru-RU'):'—';
let fleet=[],selectedOrder=null,role='',timer=null;

async function invoke(fn,action,orderNo=null,payload={}){
  const body={action,...(orderNo?{order_no:Number(orderNo)}:{}),...payload};
  const {data,error}=await sb.functions.invoke(fn,{body});
  if(error){let detail=error.message;try{if(error.context){const j=await error.context.json();detail=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(detail)}
  if(!data?.ok)throw new Error(data?.error||`${fn}_failed`);
  return data;
}
function orderNo(i){return Number(rel(i.orders)?.order_no||0)}
function channelList(i){const f=i.features||{};return ['telegram',f.max?'max':null,f.whatsapp?'whatsapp':null].filter(Boolean)}
function chip(label,on=true){return `<span style="display:inline-flex;padding:5px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.12);margin:2px;font-size:12px" class="${on?'on':'off'}">${esc(label)}</span>`}
function state(label,ok,note=''){return `<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span>${esc(label)}${note?`<small class="muted" style="display:block">${esc(note)}</small>`:''}</span><strong class="${ok?'on':'off'}">${ok?'READY':'WAITING'}</strong></div>`}
function statusOptions(current){return ['new','contacted','qualified','won','lost','spam'].map(x=>`<option value="${x}" ${x===current?'selected':''}>${x}</option>`).join('')}
function secretInput(id,label,placeholder='Вставить значение…'){return `<label style="margin-top:8px"><span>${esc(label)}</span><input id="${esc(id)}" type="password" autocomplete="off" placeholder="${esc(placeholder)}"></label>`}

function ensurePanel(){
  if($('#leadbotPanel'))return;
  const anchor=$('#factoryRequests')?.closest('.panel')||$('#financeHealthPanel');if(!anchor)return;
  const section=document.createElement('section');section.id='leadbotPanel';section.className='panel';section.style.marginTop='16px';
  section.innerHTML=`<div class="toolbar"><div><p class="eyebrow">DIGITAL FACTORY · LEADBOT FLEET</p><h2 style="margin:.25rem 0">Парк клиентских ботов</h2></div><button id="leadbotReload" class="primary">Обновить</button></div><p class="muted">Accepted-заявка автоматически создаёт LeadBot instance. Telegram, MAX и WhatsApp — адаптеры одной бизнес-логики и одной MiniCRM. Секреты хранятся в Supabase Vault.</p><div id="leadbotFleet">Загрузка…</div><div id="leadbotBody" style="margin-top:18px"></div>`;
  anchor.insertAdjacentElement('afterend',section);$('#leadbotReload').onclick=load;
}

function renderFleet(){
  if(!fleet.length){$('#leadbotFleet').innerHTML='<article class="card muted">Экземпляров пока нет.</article>';$('#leadbotBody').innerHTML='';return}
  $('#leadbotFleet').innerHTML=`<section class="cards">${fleet.map(i=>{
    const o=rel(i.orders)||{},r=i.readiness||{},selected=orderNo(i)===selectedOrder;
    const channels=channelList(i).map(c=>chip(c.toUpperCase(),c==='telegram'?!!r.telegram_ready:c==='max'?!!r.max_ready:!!r.whatsapp_ready)).join('');
    return `<article class="card" style="${selected?'outline:1px solid rgba(120,190,255,.7)':''}"><div class="card-head"><div><h3>ORD-${String(orderNo(i)).padStart(6,'0')} · ${esc(i.business_name)}</h3><div class="meta">${esc(i.business_type||'бизнес')} · ${esc(i.status)} · ${money(o.quoted_amount,o.currency)}</div></div><button class="ghost" data-open-order="${orderNo(i)}">Управлять</button></div><div style="margin-top:8px">${channels}</div><div class="meta" style="margin-top:8px">${esc(i.public_slug)}</div></article>`
  }).join('')}</section>`;
  document.querySelectorAll('[data-open-order]').forEach(b=>b.onclick=async()=>{selectedOrder=Number(b.dataset.openOrder);renderFleet();await loadDetail()});
}

async function loadDetail(){
  if(!selectedOrder)return;
  const fleetSnap=await invoke('leadbot-fleet-admin','snapshot',selectedOrder);
  role=fleetSnap.role||role;
  let maxSnap=null,waSnap=null;
  if(role==='admin'&&fleetSnap.instance?.features?.max)try{maxSnap=await invoke('leadbot-max-admin','snapshot',selectedOrder)}catch{}
  if(role==='admin'&&fleetSnap.instance?.features?.whatsapp)try{waSnap=await invoke('leadbot-whatsapp-admin','snapshot',selectedOrder)}catch{}
  renderDetail(fleetSnap,maxSnap,waSnap);
}

function renderDetail(d,maxSnap,waSnap){
  const i=d.instance||{},r=i.readiness||{},f=i.features||{},admin=role==='admin',o=d.order||{},fr=d.factory||{},onboarding=d.onboarding||null;
  const channelSummary=[chip('TELEGRAM',!!r.telegram_ready),f.max?chip('MAX',!!r.max_ready):'',f.whatsapp?chip('WHATSAPP',!!r.whatsapp_ready):''].join('');
  const onboardingActive=onboarding?.status==='active'&&new Date(onboarding.expires_at).getTime()>Date.now();
  const onboardingBlock=admin?`<article class="panel" style="margin-top:16px"><div class="toolbar"><div><p class="eyebrow">CUSTOMER SELF-SERVICE</p><h3 style="margin:.25rem 0">Защищённое подключение каналов</h3></div>${onboardingActive?'<span class="on">LINK ACTIVE</span>':onboarding?.status==='completed'?'<span class="on">COMPLETED</span>':'<span class="off">NO ACTIVE LINK</span>'}</div><p class="muted">Клиент сам вводит токены на отдельной scoped-странице. Station проверяет их у платформ и сохраняет в Vault; сырой ключ самой onboarding-ссылки хранится только у клиента.</p>${onboarding?`<div class="meta">Последняя ссылка: ${esc(onboarding.status)} · истекает ${fmt(onboarding.expires_at)} · ошибок credentials ${Number(onboarding.attempts||0)}</div>`:''}<div class="row" style="margin-top:10px"><button id="fleetOnboardingGenerate" class="primary">${onboardingActive?'Создать новую ссылку':'Создать ссылку подключения'}</button>${onboardingActive?'<button id="fleetOnboardingRevoke" class="ghost">Отозвать текущую</button>':''}</div></article>`:'';

  const telegram=`<article class="panel" style="margin:0"><h3>Telegram ${r.telegram_ready?'<span class="on">READY</span>':'<span class="off">WAITING</span>'}</h3>${state('Bot token',!!r.bot_token)}${state('Webhook secret',!!r.webhook_secret,'генерируется Station автоматически')}${state('Manager chat',!!r.manager_chat_id)}${admin?`${secretInput('fleetTgToken','Bot token','Токен от BotFather')}<div class="row" style="margin-top:8px"><button id="fleetTgSave" class="ghost">Проверить и сохранить</button><button id="fleetTgActivate" class="primary">Активировать webhook</button><button id="fleetTgClaim" class="ghost">Привязать менеджера</button><button id="fleetTgTest" class="ghost">Тест</button></div><pre id="fleetClaim" hidden></pre>`:''}</article>`;

  const maxBlock=!f.max?'':`<article class="panel" style="margin:0"><h3>MAX ${r.max_ready?'<span class="on">READY</span>':'<span class="off">WAITING</span>'}</h3>${state('Bot token',!!r.max_bot_token,maxSnap?.bot?.username?'@'+maxSnap.bot.username:'')}${state('Webhook secret',!!r.max_webhook_secret,'создаётся при активации')}${state('Manager',!!r.max_manager)}${admin?`${secretInput('fleetMaxToken','MAX bot token','Токен после проверки бота')}<label style="margin-top:8px"><span>MAX user_id менеджера</span><input id="fleetMaxManager" inputmode="numeric" placeholder="Числовой user_id"></label><div class="row" style="margin-top:8px"><button id="fleetMaxSave" class="ghost">Сохранить token</button><button id="fleetMaxManagerSave" class="ghost">Сохранить менеджера</button><button id="fleetMaxActivate" class="primary">Активировать MAX</button><button id="fleetMaxTest" class="ghost">Тест</button></div>`:''}</article>`;

  const waBlock=!f.whatsapp?'':`<article class="panel" style="margin:0"><h3>WhatsApp ${r.whatsapp_ready?'<span class="on">READY</span>':'<span class="off">WAITING</span>'}</h3>${state('Access token',!!r.whatsapp_access_token)}${state('App secret',!!r.whatsapp_app_secret)}${state('Phone Number ID',!!r.whatsapp_phone_number_id,waSnap?.phone?.display_phone_number||'')}${state('WABA ID',!!r.whatsapp_waba_id)}${state('Verify token',!!r.whatsapp_verify_token,'создаётся Station')}${state('Manager',!!r.whatsapp_manager)}${admin?`<div style="display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:8px">${secretInput('fleetWaToken','Access token')}${secretInput('fleetWaSecret','Meta App Secret')}<label><span>Phone Number ID</span><input id="fleetWaPhoneId" inputmode="numeric"></label><label><span>WABA ID</span><input id="fleetWaWabaId" inputmode="numeric"></label><label><span>Graph API version</span><input id="fleetWaVersion" placeholder="vXX.X"></label><label><span>Телефон менеджера</span><input id="fleetWaManager" inputmode="tel" placeholder="79991234567"></label></div><div class="row" style="margin-top:8px"><button id="fleetWaSave" class="ghost">Проверить credentials</button><button id="fleetWaManagerSave" class="ghost">Сохранить менеджера</button><button id="fleetWaActivate" class="primary">Активировать WhatsApp</button><button id="fleetWaTest" class="ghost">Тест</button></div>`:''}</article>`;

  const advanced=admin?`<details style="margin-top:16px"><summary>Дополнительные модули</summary><div style="margin-top:12px">${f.google_sheets?secretInput('fleetSheets','Google Sheets URL','https://...'):''}${f.crm_basic?`${secretInput('fleetCrmUrl','CRM URL','https://...')}${secretInput('fleetCrmToken','CRM token')}`:''}${f.webhook_api?`${secretInput('fleetWebhookUrl','Webhook URL','https://...')}<div class="row"><button id="fleetRotateApi" class="ghost">Создать client API token</button></div>`:''}${f.ai_faq?`${secretInput('fleetAiBase','AI API base URL','https://...')}${secretInput('fleetAiModel','AI model')}${secretInput('fleetAiKey','AI API key')}`:''}<button id="fleetRetryOutbox" class="ghost" style="margin-top:10px">Повторить failed outbox</button></div></details>`:'';

  const leads=(d.leads||[]).map(x=>`<article class="card"><div class="card-head"><div><h3>LB-${String(x.lead_no).padStart(6,'0')} · ${esc(x.flow_code)}</h3><div class="meta">${chip(String(x.source_channel||'telegram').toUpperCase())} ${fmt(x.created_at)} · ${esc(x.contact||'без контакта')}</div></div><select data-fleet-lead-status="${esc(x.id)}">${statusOptions(x.status)}</select></div><pre>${esc(JSON.stringify(x.answers,null,2))}</pre></article>`).join('')||'<article class="card muted">Лидов пока нет.</article>';
  const failed=(d.outbox||[]).filter(x=>x.status!=='succeeded').length;

  $('#leadbotBody').innerHTML=`<div class="toolbar"><div><p class="eyebrow">SELECTED INSTANCE</p><h2 style="margin:.25rem 0">ORD-${String(o.order_no||selectedOrder).padStart(6,'0')} · ${esc(i.business_name)}</h2><div>${channelSummary}</div></div><button id="fleetDetailRefresh" class="ghost">Обновить экземпляр</button></div><div class="hero-grid" style="margin-top:14px"><article class="panel metric"><small>INSTANCE</small><strong>${esc(String(i.status||'—').toUpperCase())}</strong><span>${esc(i.public_slug||'')}</span></article><article class="panel metric"><small>CORE</small><strong class="${r.core_ready?'on':'off'}">${r.core_ready?'READY':'WAITING'}</strong><span>хотя бы один канал готов</span></article><article class="panel metric"><small>CHANNELS</small><strong class="${r.channels_ready?'on':'off'}">${r.channels_ready?'READY':'BLOCKED'}</strong><span>все заказанные каналы</span></article><article class="panel metric"><small>DELIVERY</small><strong class="${r.delivery_ready?'on':'off'}">${r.delivery_ready?'READY':'BLOCKED'}</strong><span>каналы + модули + менеджер</span></article></div>${onboardingBlock}<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-top:16px">${telegram}${maxBlock}${waBlock}</div>${advanced}<div class="toolbar" style="margin-top:22px"><h3>MiniCRM · все каналы</h3><span class="muted">outbox problems: ${failed}</span></div><section class="cards">${leads}</section>`;
  bindDetail(i);
}

function bindDetail(i){
  const ord=selectedOrder;
  $('#fleetDetailRefresh')?.addEventListener('click',loadDetail);
  $('#fleetOnboardingGenerate')?.addEventListener('click',async()=>{try{const d=await invoke('leadbot-fleet-admin','generate_onboarding',ord,{expires_hours:72});try{await navigator.clipboard.writeText(d.url);alert(`Ссылка создана и скопирована в буфер. Действует до ${fmt(d.expires_at)}.\n\nОтправьте её клиенту. Повторно сырой ключ получить нельзя.`)}catch{prompt('Скопируйте защищённую ссылку. Повторно она не показывается:',d.url)}await loadDetail()}catch(e){alert(e.message)}});
  $('#fleetOnboardingRevoke')?.addEventListener('click',async()=>{if(!confirm('Отозвать текущую ссылку подключения?'))return;try{await invoke('leadbot-fleet-admin','revoke_onboarding',ord);alert('Ссылка отозвана.');await loadDetail()}catch(e){alert(e.message)}});

  $('#fleetTgSave')?.addEventListener('click',async()=>{const v=$('#fleetTgToken')?.value?.trim();if(!v)return alert('Вставьте Telegram token.');try{const d=await invoke('leadbot-admin','set_secret',ord,{kind:'bot_token',value:v});$('#fleetTgToken').value='';alert(d.telegram?.username?`Telegram: @${d.telegram.username}`:'Token сохранён.');await load()}catch(e){alert(e.message)}});
  $('#fleetTgActivate')?.addEventListener('click',async()=>{try{await invoke('leadbot-admin','activate',ord);alert('Telegram webhook активирован.');await load()}catch(e){alert(e.message)}});
  $('#fleetTgClaim')?.addEventListener('click',async()=>{try{const d=await invoke('leadbot-admin','generate_claim',ord);const p=$('#fleetClaim');p.textContent=d.command;p.hidden=false;alert(`Отправьте боту: ${d.command}`)}catch(e){alert(e.message)}});
  $('#fleetTgTest')?.addEventListener('click',async()=>{try{await invoke('leadbot-admin','test_notification',ord);alert('Telegram тест отправлен.')}catch(e){alert(e.message)}});

  $('#fleetMaxSave')?.addEventListener('click',async()=>{const v=$('#fleetMaxToken')?.value?.trim();if(!v)return alert('Вставьте MAX token.');try{const d=await invoke('leadbot-max-admin','set_token',ord,{value:v});$('#fleetMaxToken').value='';alert(d.bot?.username?`MAX: @${d.bot.username}`:'Token сохранён.');await load()}catch(e){alert(e.message)}});
  $('#fleetMaxManagerSave')?.addEventListener('click',async()=>{const v=$('#fleetMaxManager')?.value?.trim();if(!v)return alert('Введите MAX user_id.');try{await invoke('leadbot-max-admin','set_manager',ord,{user_id:v});alert('MAX manager сохранён.');await load()}catch(e){alert(e.message)}});
  $('#fleetMaxActivate')?.addEventListener('click',async()=>{try{await invoke('leadbot-max-admin','activate',ord);alert('MAX webhook активирован.');await load()}catch(e){alert(e.message)}});
  $('#fleetMaxTest')?.addEventListener('click',async()=>{try{await invoke('leadbot-max-admin','test_manager',ord);alert('MAX тест отправлен.')}catch(e){alert(e.message)}});

  $('#fleetWaSave')?.addEventListener('click',async()=>{const access_token=$('#fleetWaToken')?.value?.trim(),app_secret=$('#fleetWaSecret')?.value?.trim(),phone_number_id=$('#fleetWaPhoneId')?.value?.trim(),waba_id=$('#fleetWaWabaId')?.value?.trim(),graph_version=$('#fleetWaVersion')?.value?.trim();if(!access_token||!app_secret||!phone_number_id||!waba_id||!graph_version)return alert('Заполните все WhatsApp credentials.');try{const d=await invoke('leadbot-whatsapp-admin','set_credentials',ord,{access_token,app_secret,phone_number_id,waba_id,graph_version});$('#fleetWaToken').value='';$('#fleetWaSecret').value='';alert(d.phone?.display_phone_number?`WhatsApp: ${d.phone.display_phone_number}`:'Credentials сохранены.');await load()}catch(e){alert(e.message)}});
  $('#fleetWaManagerSave')?.addEventListener('click',async()=>{const v=$('#fleetWaManager')?.value?.trim();if(!v)return alert('Введите телефон менеджера.');try{await invoke('leadbot-whatsapp-admin','set_manager',ord,{phone:v});alert('WhatsApp manager сохранён.');await load()}catch(e){alert(e.message)}});
  $('#fleetWaActivate')?.addEventListener('click',async()=>{try{await invoke('leadbot-whatsapp-admin','activate',ord);alert('WhatsApp webhook активирован.');await load()}catch(e){alert(e.message)}});
  $('#fleetWaTest')?.addEventListener('click',async()=>{try{await invoke('leadbot-whatsapp-admin','test_manager',ord);alert('WhatsApp тест отправлен.')}catch(e){alert(e.message)}});

  const saves=[['fleetSheets','google_sheets_url'],['fleetCrmUrl','crm_url'],['fleetCrmToken','crm_token'],['fleetWebhookUrl','webhook_url'],['fleetAiBase','ai_base_url'],['fleetAiModel','ai_model'],['fleetAiKey','ai_api_key']];
  saves.forEach(([id,kind])=>{const el=$('#'+id);if(!el)return;el.addEventListener('change',async()=>{const v=el.value.trim();if(!v)return;try{await invoke('leadbot-admin','set_secret',ord,{kind,value:v});el.value='';await loadDetail()}catch(e){alert(e.message)}})});
  $('#fleetRotateApi')?.addEventListener('click',async()=>{if(!confirm('Создать новый client API token?'))return;try{const d=await invoke('leadbot-admin','rotate_api_token',ord);prompt('Скопируйте token сейчас:',d.token);await loadDetail()}catch(e){alert(e.message)}});
  $('#fleetRetryOutbox')?.addEventListener('click',async()=>{try{const d=await invoke('leadbot-admin','retry_outbox',ord);alert(`Поставлено в очередь: ${d.queued}`);await loadDetail()}catch(e){alert(e.message)}});
  document.querySelectorAll('[data-fleet-lead-status]').forEach(s=>s.onchange=async()=>{s.disabled=true;try{await invoke('leadbot-admin','set_lead_status',ord,{lead_id:s.dataset.fleetLeadStatus,status:s.value});await loadDetail()}catch(e){alert(e.message)}finally{s.disabled=false}});
}

async function load(){
  ensurePanel();
  const {data:{session}}=await sb.auth.getSession();if(!session||$('#consolePanel')?.hidden)return;
  try{
    const d=await invoke('leadbot-fleet-admin','list');fleet=d.instances||[];role=d.role||'';
    if(!selectedOrder||!fleet.some(i=>orderNo(i)===selectedOrder))selectedOrder=fleet.length?orderNo(fleet[0]):null;
    renderFleet();if(selectedOrder)await loadDetail();
  }catch(e){$('#leadbotFleet').innerHTML=`<div class="off">ERROR · ${esc(e.message)}</div>`}
}

ensurePanel();
sb.auth.onAuthStateChange(()=>setTimeout(load,350));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
setTimeout(load,900);timer=setInterval(load,30000);
