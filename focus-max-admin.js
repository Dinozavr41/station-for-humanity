import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let timer=null;

async function invoke(action,payload={}){
  const {data,error}=await sb.functions.invoke('leadbot-max-admin',{body:{action,order_no:4,...payload}});
  if(error){
    let detail=error.message;
    try{if(error.context){const j=await error.context.json();detail=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}
    throw new Error(detail);
  }
  if(!data?.ok)throw new Error(data?.error||'leadbot_max_admin_failed');
  return data;
}

function state(label,ok,note=''){
  return `<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span>${esc(label)}${note?`<small class="muted" style="display:block">${esc(note)}</small>`:''}</span><strong class="${ok?'on':'off'}">${ok?'READY':'WAITING'}</strong></div>`;
}

function ensurePanel(){
  if($('#focusMaxPanel'))return;
  const anchor=$('#leadbotPanel')||$('#factoryRequests')?.closest('.panel')||$('#financeHealthPanel');
  if(!anchor)return;
  const section=document.createElement('section');
  section.id='focusMaxPanel';
  section.className='panel';
  section.style.marginTop='16px';
  section.innerHTML=`
    <div class="toolbar">
      <div><p class="eyebrow">PILOT · MULTICHANNEL</p><h2 style="margin:.25rem 0">ORD-000004 · ООО «Фокус» · MAX</h2></div>
      <button id="focusMaxReload" class="ghost">Обновить</button>
    </div>
    <p class="muted">Бесплатный реальный пилот РПК «Фокус». Токен MAX проверяется сервером через официальный API и сразу сохраняется в Supabase Vault — браузер его повторно не получает.</p>
    <div id="focusMaxBody">Загрузка…</div>`;
  anchor.insertAdjacentElement('afterend',section);
  $('#focusMaxReload').onclick=load;
}

function render(d){
  const r=d.readiness||{};
  const bot=d.bot||null;
  const subs=Array.isArray(d.subscriptions)?d.subscriptions:[];
  const subscribed=subs.some(x=>String(x?.url||'').includes('leadbot-max')&&String(x?.url||'').includes('focus-biysk-pilot'));
  $('#focusMaxBody').innerHTML=`
    <div class="hero-grid" style="margin-top:14px">
      <article class="panel metric"><small>INSTANCE</small><strong>${esc(String(d.status||'—').toUpperCase())}</strong><span>focus-biysk-pilot</span></article>
      <article class="panel metric"><small>MAX TOKEN</small><strong class="${r.max_bot_token?'on':'off'}">${r.max_bot_token?'READY':'WAITING'}</strong><span>${bot?.username?'@'+esc(bot.username):'нужен токен после модерации MAX'}</span></article>
      <article class="panel metric"><small>WEBHOOK</small><strong class="${subscribed?'on':'off'}">${subscribed?'ACTIVE':'WAITING'}</strong><span>message_created + bot_started</span></article>
      <article class="panel metric"><small>MANAGER</small><strong class="${r.max_manager?'on':'off'}">${r.max_manager?'READY':'WAITING'}</strong><span>получатель новых заявок в MAX</span></article>
    </div>
    <div style="display:grid;grid-template-columns:minmax(260px,.9fr) minmax(360px,1.3fr);gap:18px;margin-top:16px">
      <div>
        <h3>Готовность MAX</h3>
        ${state('MAX bot token',!!r.max_bot_token,'хранится только в Vault')}
        ${state('Webhook secret',!!r.max_webhook_secret,'создаётся автоматически при активации')}
        ${state('MAX manager',!!r.max_manager,'MAX user_id менеджера')}
        ${state('MAX channel',!!r.max_ready,'token + webhook secret')}
        <p class="muted" style="margin-top:12px">Подписок MAX: ${subs.length}. Бот: ${bot?`${esc(bot.first_name||'')} ${bot.username?'@'+esc(bot.username):''}`:'ещё не подключён'}.</p>
      </div>
      <div>
        <h3>1. Подключить бота MAX</h3>
        <label>Bot token
          <input id="focusMaxToken" type="password" autocomplete="off" placeholder="Токен из MAX после проверки бота">
        </label>
        <button id="focusMaxSaveToken" class="primary" style="margin-top:8px">Проверить и сохранить в Vault</button>
        <h3 style="margin-top:22px">2. Кому отправлять заявки</h3>
        <label>MAX user_id менеджера
          <input id="focusMaxManager" inputmode="numeric" placeholder="Числовой user_id">
        </label>
        <div class="row" style="margin-top:8px"><button id="focusMaxSaveManager" class="ghost">Сохранить менеджера</button><button id="focusMaxTestManager" class="ghost">Тест менеджеру</button></div>
        <h3 style="margin-top:22px">3. Запуск</h3>
        <button id="focusMaxActivate" class="primary">Активировать MAX webhook</button>
        <p class="muted">Station сама создаст секрет webhook, сохранит его в Vault и подпишет MAX на production endpoint. Секрет вручную копировать не нужно.</p>
      </div>
    </div>`;

  $('#focusMaxSaveToken').onclick=async()=>{
    const b=$('#focusMaxSaveToken'),input=$('#focusMaxToken'),value=input?.value?.trim();
    if(!value)return alert('Вставьте токен MAX.');
    b.disabled=true;
    try{const x=await invoke('set_token',{value});input.value='';alert(`MAX token принят${x.bot?.username?`. Бот: @${x.bot.username}`:''}`);await load()}catch(e){alert(e.message)}finally{b.disabled=false}
  };
  $('#focusMaxSaveManager').onclick=async()=>{
    const value=$('#focusMaxManager')?.value?.trim();
    if(!value)return alert('Введите MAX user_id менеджера.');
    try{await invoke('set_manager',{user_id:value});alert('MAX manager сохранён.');await load()}catch(e){alert(e.message)}
  };
  $('#focusMaxActivate').onclick=async()=>{
    try{const x=await invoke('activate');alert(`MAX webhook активирован${x.bot?.username?`. Бот: @${x.bot.username}`:''}`);await load()}catch(e){alert(e.message)}
  };
  $('#focusMaxTestManager').onclick=async()=>{
    try{await invoke('test_manager');alert('Тестовое сообщение отправлено менеджеру в MAX.')}catch(e){alert(e.message)}
  };
}

async function load(){
  ensurePanel();
  const {data:{session}}=await sb.auth.getSession();
  if(!session||$('#consolePanel')?.hidden)return;
  try{render(await invoke('snapshot'))}
  catch(e){if($('#focusMaxBody'))$('#focusMaxBody').innerHTML=`<div class="off">WAITING · ${esc(e.message)}</div>`}
}

ensurePanel();
sb.auth.onAuthStateChange(()=>setTimeout(load,350));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
setTimeout(load,1100);
timer=setInterval(load,30000);
