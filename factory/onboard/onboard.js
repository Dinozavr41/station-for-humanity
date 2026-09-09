const API='https://xwapzjsnqyfiqbzeycyh.supabase.co/functions/v1/leadbot-onboarding';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let token='';let state=null;

function takeToken(){
  const q=new URLSearchParams(location.search),fromUrl=q.get('token');
  if(fromUrl){sessionStorage.setItem('sfh_leadbot_onboarding',fromUrl);history.replaceState({},'',location.pathname)}
  token=sessionStorage.getItem('sfh_leadbot_onboarding')||'';
}
async function call(action,payload={}){
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token,...payload})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d?.ok)throw new Error(d?.detail||d?.error||`HTTP ${r.status}`);
  return d;
}
function pill(name,ready){return `<span class="channel-pill"><span>${esc(name)}</span><strong class="${ready?'ready':'waiting'}">${ready?'READY':'WAITING'}</strong></span>`}
function updateState(s){state=s;$('#businessName').textContent=s.business_name||'LeadBot';$('#businessMeta').textContent=[s.business_type,s.public_slug].filter(Boolean).join(' · ');$('#expires').textContent=`Ссылка действует до ${new Date(s.expires_at).toLocaleString('ru-RU')}.`;$('#summary').innerHTML=[s.requested.telegram?pill('Telegram',s.ready.telegram):'',s.requested.max?pill('MAX',s.ready.max):'',s.requested.whatsapp?pill('WhatsApp',s.ready.whatsapp):''].join('');$('#project').hidden=false;$('#channels').hidden=false;$('#complete').hidden=!s.ready.channels;renderChannels()}
function result(id,text,bad=false){const el=$(id);if(!el)return;el.textContent=text;el.className='result'+(bad?' bad':'')}
function clear(...ids){ids.forEach(id=>{const e=$(id);if(e)e.value=''})}

function telegramCard(){if(!state.requested.telegram)return'';const ready=state.ready.telegram;return `<article class="channel-card ${ready?'ready':''}"><h3>Telegram</h3><div class="status ${ready?'ready':'waiting'}">${ready?'Подключён':'Нужно подключить'}</div>${ready?'<p class="hint">Webhook и token уже прошли проверку.</p>':`<p class="hint">Создайте бота через BotFather и вставьте полученный token. Station проверит его и сама включит webhook.</p><label><span>Bot token</span><input id="tgToken" type="password" autocomplete="off" placeholder="123456:ABC..."></label><button id="tgConnect" class="btn primary">Подключить Telegram</button><div id="tgResult" class="result" hidden></div>`}</article>`}
function maxCard(){if(!state.requested.max)return'';const ready=state.ready.max;return `<article class="channel-card ${ready?'ready':''}"><h3>MAX</h3><div class="status ${ready?'ready':'waiting'}">${ready?'Подключён':'Нужно подключить'}</div>${ready?'<p class="hint">MAX bot token и webhook готовы.</p>':`<p class="hint">После создания и проверки бота в MAX вставьте token. ID менеджера можно указать сразу или оставить пустым, если основное уведомление идёт через Telegram/MiniCRM.</p><label><span>MAX bot token</span><input id="maxToken" type="password" autocomplete="off"></label><label><span>MAX user_id менеджера — необязательно</span><input id="maxManager" inputmode="numeric"></label><button id="maxConnect" class="btn primary">Подключить MAX</button><div id="maxResult" class="result" hidden></div>`}</article>`}
function whatsappCard(){if(!state.requested.whatsapp)return'';const ready=state.ready.whatsapp;return `<article class="channel-card ${ready?'ready':''}"><h3>WhatsApp Business</h3><div class="status ${ready?'ready':'waiting'}">${ready?'Подключён':'Нужно подключить'}</div>${ready?'<p class="hint">WhatsApp Cloud API прошёл проверку.</p>':`<div class="warning">WhatsApp Business подключается только там, где платформа фактически доступна вашей компании и номеру. Для российских клиентов основной контур Station — Telegram + MAX.</div><p class="hint">Нужны данные официального Meta WhatsApp Cloud API: Access Token, App Secret, Phone Number ID, WABA ID и текущая Graph API version.</p><label><span>Access Token</span><input id="waToken" type="password" autocomplete="off"></label><label><span>Meta App Secret</span><input id="waSecret" type="password" autocomplete="off"></label><label><span>Phone Number ID</span><input id="waPhoneId" inputmode="numeric"></label><label><span>WABA ID</span><input id="waWabaId" inputmode="numeric"></label><label><span>Graph API version</span><input id="waVersion" placeholder="vXX.X"></label><label><span>Телефон менеджера — необязательно</span><input id="waManager" inputmode="tel" placeholder="79991234567"></label><button id="waConnect" class="btn primary">Подключить WhatsApp</button><div id="waResult" class="result" hidden></div>`}</article>`}
function renderChannels(){
  $('#channelCards').innerHTML=telegramCard()+maxCard()+whatsappCard();
  $('#tgConnect')?.addEventListener('click',async()=>{const b=$('#tgConnect'),v=$('#tgToken').value.trim();if(!v)return result('#tgResult','Вставьте BotFather token.',true);b.disabled=true;try{const d=await call('telegram_connect',{bot_token:v});clear('#tgToken');const claim=d.manager_claim?.command?`\n\nЧтобы привязать менеджера, откройте @${d.bot?.username||'бота'} и отправьте:\n${d.manager_claim.command}\nКод действует 30 минут.`:'';result('#tgResult',`Telegram подключён${d.bot?.username?`: @${d.bot.username}`:''}.${claim}`);$('#tgResult').hidden=false;await inspect()}catch(e){result('#tgResult',e.message,true);$('#tgResult').hidden=false}finally{b.disabled=false}});
  $('#maxConnect')?.addEventListener('click',async()=>{const b=$('#maxConnect'),v=$('#maxToken').value.trim(),m=$('#maxManager').value.trim();if(!v)return result('#maxResult','Вставьте MAX token.',true);b.disabled=true;try{const d=await call('max_connect',{bot_token:v,manager_user_id:m});clear('#maxToken');result('#maxResult',`MAX подключён${d.bot?.username?`: @${d.bot.username}`:''}.`);$('#maxResult').hidden=false;await inspect()}catch(e){result('#maxResult',e.message,true);$('#maxResult').hidden=false}finally{b.disabled=false}});
  $('#waConnect')?.addEventListener('click',async()=>{const b=$('#waConnect'),payload={access_token:$('#waToken').value.trim(),app_secret:$('#waSecret').value.trim(),phone_number_id:$('#waPhoneId').value.trim(),waba_id:$('#waWabaId').value.trim(),graph_version:$('#waVersion').value.trim(),manager_phone:$('#waManager').value.trim()};if(!payload.access_token||!payload.app_secret||!payload.phone_number_id||!payload.waba_id||!payload.graph_version)return result('#waResult','Заполните обязательные поля WhatsApp Cloud API.',true);b.disabled=true;try{const d=await call('whatsapp_connect',payload);clear('#waToken','#waSecret');result('#waResult',`WhatsApp подключён${d.phone?.display_phone_number?`: ${d.phone.display_phone_number}`:''}.`);$('#waResult').hidden=false;await inspect()}catch(e){result('#waResult',e.message,true);$('#waResult').hidden=false}finally{b.disabled=false}});
}
async function inspect(){
  const d=await call('inspect');updateState(d.state);$('#linkStatus').textContent='Защищённая ссылка подтверждена.';$('#linkStatus').className='link-status ok';
}
async function init(){
  takeToken();
  if(!token){$('#linkStatus').textContent='В ссылке нет ключа подключения. Попросите оператора Station создать новую ссылку.';$('#linkStatus').className='link-status bad';return}
  try{await inspect()}catch(e){sessionStorage.removeItem('sfh_leadbot_onboarding');$('#linkStatus').textContent='Ссылка недействительна, истекла или была отозвана.';$('#linkStatus').className='link-status bad'}
}
init();