import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let current=null,timer=null;

async function invoke(action,payload={}){
  const {data,error}=await sb.functions.invoke('leadbot-admin',{body:{action,order_no:3,...payload}});
  if(error){let detail=error.message;try{if(error.context){const j=await error.context.json();detail=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(detail)}
  if(!data?.ok)throw new Error(data?.error||'leadbot_admin_failed');
  return data;
}
function fmt(v){return v?new Date(v).toLocaleString():'—'}
function money(v){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Number(v||0))+' ₽'}
function check(label,ok){return `<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span>${esc(label)}</span><strong class="${ok?'on':'off'}">${ok?'READY':'WAITING'}</strong></div>`}
function secretRow(kind,label,placeholder='Вставить значение…'){
  return `<div style="display:grid;grid-template-columns:180px 1fr auto;gap:8px;align-items:end;margin:8px 0"><label style="margin:0"><span>${esc(label)}</span><input data-secret="${esc(kind)}" type="password" autocomplete="off" placeholder="${esc(placeholder)}"></label><div></div><button data-save-secret="${esc(kind)}" class="ghost">Сохранить</button></div>`
}
function ensurePanel(){
  if($('#leadbotPanel'))return;
  const anchor=$('#factoryRequests')?.closest('.panel')||$('#financeHealthPanel');if(!anchor)return;
  const section=document.createElement('section');section.id='leadbotPanel';section.className='panel';section.style.marginTop='16px';
  section.innerHTML=`<div class="toolbar"><div><p class="eyebrow">PRODUCTION · LEADBOT</p><h2 style="margin:.25rem 0">ORD-000003 · Монтаж освещения</h2></div><button id="leadbotReload" class="primary">Обновить</button></div><p class="muted">Это уже производственный экземпляр, а не демо. Секреты сохраняются сервером в Supabase Vault и после отправки не показываются обратно в браузер.</p><div id="leadbotBody">Загрузка…</div>`;
  anchor.insertAdjacentElement('afterend',section);
  $('#leadbotReload').onclick=load;
}
function bind(){
  document.querySelectorAll('[data-save-secret]').forEach(b=>b.onclick=async()=>{const kind=b.dataset.saveSecret,input=document.querySelector(`[data-secret="${kind}"]`);const value=input?.value?.trim();if(!value)return alert('Введите значение.');b.disabled=true;try{const d=await invoke('set_secret',{kind,value});input.value='';alert(kind==='bot_token'&&d.telegram?.username?`Telegram token принят. Бот: @${d.telegram.username}`:'Сохранено в Vault.');await load()}catch(e){alert(e.message)}finally{b.disabled=false}});
  $('#leadbotActivate')?.addEventListener('click',async()=>{const b=$('#leadbotActivate');b.disabled=true;try{const d=await invoke('activate');alert(`Webhook включён. Бот: @${d.bot?.username||'telegram_bot'}`);await load()}catch(e){alert(e.message)}finally{b.disabled=false}});
  $('#leadbotClaim')?.addEventListener('click',async()=>{const b=$('#leadbotClaim');b.disabled=true;try{const d=await invoke('generate_claim');$('#claimCommand').textContent=d.command;$('#claimCommand').hidden=false;alert(`Отправьте боту: ${d.command}\nКод действует 30 минут.`)}catch(e){alert(e.message)}finally{b.disabled=false}});
  $('#leadbotTestNotify')?.addEventListener('click',async()=>{try{await invoke('test_notification');alert('Тестовое сообщение отправлено менеджеру.')}catch(e){alert(e.message)}});
  $('#saveCalc')?.addEventListener('click',async()=>{const base=Number($('#calcBase').value||0),per_point=Number($('#calcPoint').value||0),per_m2=Number($('#calcM2').value||0);try{await invoke('configure_calculator',{base,per_point,per_m2});alert('Тарифы калькулятора сохранены.');await load()}catch(e){alert(e.message)}});
}
function render(d){current=d;const i=d.instance||{},r=i.readiness||{},role=d.role||'',admin=role==='admin';
  const readiness=`${check('Telegram bot token',r.bot_token)}${check('Telegram webhook secret',r.webhook_secret)}${check('Менеджерский чат',r.manager_chat_id)}${check('Google Sheets',r.google_sheets)}${check('CRM',r.crm)}${check('Webhook/API',r.webhook_api)}${check('AI FAQ',r.ai_faq)}${check('Калькулятор тарифов',r.calculator)}`;
  const adminBlock=admin?`<section style="margin-top:18px"><h3>1. Telegram</h3>${secretRow('bot_token','Bot token','Токен от BotFather')}<div class="row"><button id="leadbotActivate" class="primary">Включить Telegram webhook</button><button id="leadbotClaim" class="ghost">Получить код привязки менеджера</button><button id="leadbotTestNotify" class="ghost">Тест менеджеру</button></div><pre id="claimCommand" hidden style="margin-top:10px"></pre><p class="muted">После активации откройте бота, нажмите Start и отправьте команду /claim с кодом выше. Chat ID руками искать не надо.</p><h3 style="margin-top:22px">2. Интеграции заказа</h3>${secretRow('google_sheets_url','Google Sheets URL','Webhook Google Apps Script')}${secretRow('crm_url','CRM URL','Webhook / REST endpoint')}${secretRow('crm_token','CRM token')}${secretRow('webhook_url','Внешний API URL')}${secretRow('webhook_token','API token')}${secretRow('ai_base_url','AI API base URL','OpenAI-compatible endpoint')}${secretRow('ai_model','AI model','Имя модели')}${secretRow('ai_api_key','AI API key')}<h3 style="margin-top:22px">3. Тарифы калькулятора</h3><div style="display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:8px"><label>База, ₽<input id="calcBase" type="number" min="0" value="0"></label><label>За точку, ₽<input id="calcPoint" type="number" min="0" value="0"></label><label>За м², ₽<input id="calcM2" type="number" min="0" value="0"></label></div><button id="saveCalc" class="ghost" style="margin-top:8px">Сохранить тарифы</button></section>`:`<p class="muted">Изменять секреты и активировать production-bot может только admin.</p>`;
  const leads=(d.leads||[]).map(x=>`<article class="card"><div class="card-head"><div><h3>LB-${String(x.lead_no).padStart(6,'0')} · ${esc(x.flow_code)}</h3><div class="meta">${fmt(x.created_at)} · ${esc(x.contact||'без контакта')}</div></div><span class="badge">${esc(x.status)}</span></div><pre>${esc(JSON.stringify(x.answers,null,2))}</pre></article>`).join('')||'<article class="card muted">Лидов пока нет. После активации Telegram они появятся здесь.</article>';
  const failed=(d.outbox||[]).filter(x=>x.status!=='succeeded');
  $('#leadbotBody').innerHTML=`<div class="hero-grid" style="margin-top:14px"><article class="panel metric"><small>INSTANCE</small><strong>${esc(String(i.status||'—').toUpperCase())}</strong><span>${esc(i.public_slug||'')}</span></article><article class="panel metric"><small>CORE</small><strong class="${r.core_ready?'on':'off'}">${r.core_ready?'READY':'WAITING'}</strong><span>Telegram runtime</span></article><article class="panel metric"><small>DELIVERY</small><strong class="${r.delivery_ready?'on':'off'}">${r.delivery_ready?'READY':'BLOCKED'}</strong><span>Все купленные модули</span></article><article class="panel metric"><small>ORDER</small><strong>${money(d.order?.quoted_amount)}</strong><span>${esc(d.factory?.status||'—')} · ${esc(d.order?.status||'—')}</span></article></div><div style="display:grid;grid-template-columns:minmax(260px,.8fr) minmax(320px,1.4fr);gap:18px;margin-top:16px"><div><h3>Готовность</h3>${readiness}</div><div>${adminBlock}</div></div><div class="toolbar" style="margin-top:22px"><h3>Лиды из Telegram</h3><span class="muted">outbox problems: ${failed.length}</span></div><section class="cards">${leads}</section>`;
  bind();
}
async function load(){ensurePanel();const {data:{session}}=await sb.auth.getSession();if(!session||$('#consolePanel')?.hidden)return;try{render(await invoke('snapshot'))}catch(e){$('#leadbotBody').innerHTML=`<div class="off">ERROR · ${esc(e.message)}</div>`}}
ensurePanel();sb.auth.onAuthStateChange(()=>setTimeout(load,350));document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});setTimeout(load,900);timer=setInterval(load,30000);
