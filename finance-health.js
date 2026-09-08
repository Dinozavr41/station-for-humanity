import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let timer=null;

async function invoke(action='snapshot',payload={}){
  const {data,error}=await sb.functions.invoke('finance-health',{body:{action,...payload}});
  if(error){let detail=error.message;try{if(error.context){const j=await error.context.json();detail=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(detail)}
  if(!data?.ok)throw new Error(data?.error||'finance_health_failed');
  return data;
}

function stateText(status){return status==='healthy'?'HEALTHY':status==='warning'?'WARNING':'CRITICAL'}
function stateClass(status){return status==='healthy'?'health-ok':status==='warning'?'health-warning':'health-critical'}
function fmtDate(v){if(!v)return'—';try{return new Date(v).toLocaleString()}catch{return String(v)}}

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

async function load(){
  const panel=$('#financeHealthPanel');if(!panel)return;
  const {data:{session}}=await sb.auth.getSession();
  const consolePanel=$('#consolePanel');
  if(!session||consolePanel?.hidden){panel.dataset.state='waiting';return}
  try{const d=await invoke('snapshot');panel.dataset.state='ready';renderSnapshot(d)}catch(e){panel.dataset.state='error';$('#healthState').textContent='ERROR';$('#healthState').className='health-critical';$('#healthGenerated').textContent=e.message}
}

$('#healthRefresh')?.addEventListener('click',load);
sb.auth.onAuthStateChange(()=>setTimeout(load,250));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
setTimeout(load,700);
if(!timer)timer=setInterval(load,30000);
