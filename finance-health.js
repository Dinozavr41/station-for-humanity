import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let timer=null;let factoryTimer=null;

async function invoke(action='snapshot',payload={}){
  const {data,error}=await sb.functions.invoke('finance-health',{body:{action,...payload}});
  if(error){let detail=error.message;try{if(error.context){const j=await error.context.json();detail=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(detail)}
  if(!data?.ok)throw new Error(data?.error||'finance_health_failed');
  return data;
}

async function invokeFactory(action='list',payload={}){
  const {data,error}=await sb.functions.invoke('factory-admin',{body:{action,...payload}});
  if(error){let detail=error.message;try{if(error.context){const j=await error.context.json();detail=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(detail)}
  if(!data?.ok)throw new Error(data?.error||'factory_admin_failed');
  return data;
}

function stateText(status){return status==='healthy'?'HEALTHY':status==='warning'?'WARNING':'CRITICAL'}
function stateClass(status){return status==='healthy'?'health-ok':status==='warning'?'health-warning':'health-critical'}
function fmtDate(v){if(!v)return'—';try{return new Date(v).toLocaleString()}catch{return String(v)}}
function fmtMoney(v,c='RUB'){const n=Number(v||0);return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n)+' '+(c==='RUB'?'₽':c)}

function renderSnapshot(d){
  const h=d.health||{},m=h.metrics||{},c=h.controls||{},last=h.last_run||null;
  const state=$('#healthState');state.textContent=stateText(h.status);state.className=stateClass(h.status);
  $('#healthIncidentCount').textContent=String(m.open_incidents||0);
  const ledgerProblems=Number(m.ledger_imbalances||0)+Number(m.missing_payment_ledgers||0)+Number(m.missing_refund_ledgers||0);
  const ledger=$('#healthLedger');ledger.textContent=ledgerProblems===0?'BALANCED':`${ledgerProblems} ISSUE`;ledger.className=ledgerProblems===0?'health-ok':'health-critical';
  const lastBox=$('#healthLastRun');lastBox.textContent=last?`${String(last.status).toUpperCase()} · ${last.trigger_source}`:'NO RUNS';lastBox.className=last?.status==='succeeded'?'health-ok':last?.status==='partial'?'health-warning':'health-critical';
  $('#healthGenerated').textContent=`обновлено ${fmtDate(h.generated_at)} · backend cron 5 мин`;
  $('#healthGuards').textContent=`LIVE payments ${c.payments_enabled?'ON':'OFF'} · payouts ${c.payouts_enabled?'ON':'OFF'} · max live ${c.max_live_payment||0} RUB`;
  renderIncidents(d.incidents||[],d.role);
  renderRuns(d.runs||[]);
}

function renderIncidents(items,role){
  const box=$('#healthIncidents');
  const active=items.filter(x=>x.status!=='resolved');
  const recentResolved=items.filter(x=>x.status==='resolved').slice(0,5);
  const rows=[...active,...recentResolved];
  if(!rows.length){box.innerHTML='<article class="card health-empty"><strong>Аварий нет.</strong><span>Провайдер, заказы и бухгалтерия согласованы.</span></article>';return}
  box.innerHTML='';
  for(const x of rows){
    const card=document.createElement('article');card.className=`card health-incident incident-${esc(x.severity)} ${x.status==='resolved'?'incident-resolved':''}`;
    card.innerHTML=`<div class="card-head"><div><h3>${esc(x.title)}</h3><div class="meta">${esc(x.kind)} · ${fmtDate(x.last_seen_at)} · повторов ${esc(x.occurrence_count)}</div></div><span class="badge">${esc(x.severity)} · ${esc(x.status)}</span></div><p class="statement">${esc(JSON.stringify(x.details||{}))}</p><div class="actions"></div>`;
    const actions=card.querySelector('.actions');
    if(x.status==='open'&&['finance','risk','admin'].includes(role)){const b=document.createElement('button');b.className='ghost';b.textContent='Подтвердить, что увидел';b.onclick=async()=>{b.disabled=true;try{await invoke('ack_incident',{incident_id:x.id});await load()}catch(e){alert(e.message)}finally{b.disabled=false}};actions.append(b)}
    box.append(card);
  }
}

function renderRuns(items){
  const box=$('#healthRuns');box.innerHTML='';
  if(!items.length){box.innerHTML='<article class="card muted">Прогонов watchdog пока нет.</article>';return}
  for(const r of items.slice(0,8)){
    const card=document.createElement('article');card.className='card health-run';
    const cls=r.status==='succeeded'?'health-ok':r.status==='partial'?'health-warning':'health-critical';
    card.innerHTML=`<div class="card-head"><div><h3>${fmtDate(r.started_at)}</h3><div class="meta">${esc(r.trigger_source)} · payments ${esc(r.checked_payments)} · refunds ${esc(r.checked_refunds)} · errors ${esc(r.error_count)}</div></div><strong class="${cls}">${esc(String(r.status).toUpperCase())}</strong></div>`;
    box.append(card);
  }
}

function ensureFactoryPanel(){
  if($('#factoryQueuePanel'))return;
  const health=$('#financeHealthPanel');if(!health)return;
  const section=document.createElement('section');
  section.id='factoryQueuePanel';section.className='panel';section.style.marginTop='16px';
  section.innerHTML=`<div class="toolbar"><div><p class="eyebrow">DIGITAL FACTORY</p><h2 style="margin:.25rem 0">Коммерческие заявки</h2></div><div class="row"><a class="ghost" style="text-decoration:none;display:inline-flex;align-items:center" href="/factory/" target="_blank">Открыть витрину ↗</a><button id="factoryReload" class="primary">Обновить очередь</button></div></div><p class="muted">Сюда попадают реальные заявки с публичной Digital Factory. DF — заявка клиента, ORD — заказ, Quote — зафиксированная сервером цена.</p><div id="factoryQueueStats" class="meta">Загрузка…</div><section id="factoryRequests" class="cards" style="margin-top:12px"></section>`;
  health.insertAdjacentElement('afterend',section);
  $('#factoryReload')?.addEventListener('click',loadFactory);
}

function factoryButton(text,cls,fn){const b=document.createElement('button');b.className=cls;b.textContent=text;b.onclick=async()=>{b.disabled=true;try{await fn()}catch(e){alert(e.message)}finally{b.disabled=false}};return b}
async function factoryTransition(id,status,needReason=false){let reason='';if(needReason){reason=prompt(status==='rejected'?'Почему отклоняем заявку?':'Причина отмены:')||'';if(!reason.trim())return}await invokeFactory('transition',{request_id:id,status,reason});await loadFactory()}

function renderFactory(items){
  const box=$('#factoryRequests'),stats=$('#factoryQueueStats');if(!box)return;
  const open=items.filter(x=>!['rejected','canceled'].includes(x.status));
  stats.textContent=`Всего: ${items.length} · в работе: ${open.length} · новых: ${items.filter(x=>['quoted','submitted'].includes(x.status)).length}`;
  if(!items.length){box.innerHTML='<article class="card"><div class="card-head"><div><h3>Пока 0 коммерческих заявок</h3><div class="meta">Это нормально: витрина только запущена.</div></div><span class="badge">READY</span></div><p class="statement">Первая заявка с /factory/ автоматически появится здесь вместе с DF, ORD и серверной сметой.</p><div class="actions"><a href="/factory/" target="_blank" class="primary" style="text-decoration:none;border-radius:11px;padding:11px 15px;font-weight:800">Посмотреть глазами клиента ↗</a></div></article>';return}
  box.innerHTML='';
  for(const x of items){
    const num=`DF-${String(x.request_no).padStart(6,'0')}`;const ord=x.orders?.order_no?`ORD-${String(x.orders.order_no).padStart(6,'0')}`:'ORD —';
    const card=document.createElement('article');card.className='card';
    card.innerHTML=`<div class="card-head"><div><h3>${num} · ${esc(x.customer_name)}</h3><div class="meta">${fmtDate(x.created_at)} · ${esc(x.product_code)} · ${ord}</div></div><span class="badge">${esc(x.status)}</span></div><div class="kv"><b>Цена</b><span>${fmtMoney(x.amount,x.currency)}</span><b>Контакт</b><span>${esc(x.contact)}</span><b>Бизнес</b><span>${esc(x.business_type||'—')}</span><b>Order</b><span>${ord} · ${esc(x.orders?.status||'—')}</span></div><p class="statement"><b>Нужный результат:</b><br>${esc(x.desired_result||'—')}</p><details><summary>Комплектация и смета</summary><pre>${esc(JSON.stringify({options:x.selected_options,breakdown:x.price_breakdown},null,2))}</pre></details><div class="actions"></div>`;
    const a=card.querySelector('.actions');
    if(['quoted','submitted'].includes(x.status))a.append(factoryButton('Взять в review','ghost',()=>factoryTransition(x.id,'review')));
    if(['quoted','submitted','review'].includes(x.status))a.append(factoryButton('Принять в работу','primary',()=>factoryTransition(x.id,'accepted')));
    if(['quoted','submitted','review'].includes(x.status))a.append(factoryButton('Отклонить','danger',()=>factoryTransition(x.id,'rejected',true)));
    if(['quoted','submitted','review','accepted'].includes(x.status))a.append(factoryButton('Отменить','ghost',()=>factoryTransition(x.id,'canceled',true)));
    box.append(card);
  }
}

async function loadFactory(){
  ensureFactoryPanel();const panel=$('#factoryQueuePanel');if(!panel)return;
  const {data:{session}}=await sb.auth.getSession();const consolePanel=$('#consolePanel');
  if(!session||consolePanel?.hidden)return;
  try{const d=await invokeFactory('list');renderFactory(d.requests||[])}catch(e){const box=$('#factoryRequests');if(box)box.innerHTML=`<article class="card"><strong>Не удалось загрузить Digital Factory</strong><p class="muted">${esc(e.message)}</p></article>`}
}

async function load(){
  const panel=$('#financeHealthPanel');if(!panel)return;
  const {data:{session}}=await sb.auth.getSession();
  const consolePanel=$('#consolePanel');
  if(!session||consolePanel?.hidden){panel.dataset.state='waiting';return}
  try{const d=await invoke('snapshot');panel.dataset.state='ready';renderSnapshot(d)}catch(e){panel.dataset.state='error';$('#healthState').textContent='ERROR';$('#healthState').className='health-critical';$('#healthGenerated').textContent=e.message}
  await loadFactory();
}

ensureFactoryPanel();
$('#healthRefresh')?.addEventListener('click',load);
sb.auth.onAuthStateChange(()=>setTimeout(load,250));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
setTimeout(load,700);
if(!timer)timer=setInterval(load,30000);
if(!factoryTimer)factoryTimer=setInterval(loadFactory,30000);
