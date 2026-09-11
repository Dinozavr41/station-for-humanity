import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const WORKSPACE=new URLSearchParams(location.search).get('w')||'focus-biysk';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const money=(v,c='RUB')=>v==null?'—':new Intl.NumberFormat('ru-RU',{style:'currency',currency:c,maximumFractionDigits:0}).format(Number(v)||0);
const dt=v=>v?new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';

async function api(action,payload={}){
  const {data,error}=await sb.functions.invoke('opportunity-engine',{body:{action,workspace_slug:WORKSPACE,...payload}});
  if(error){let m=error.message;try{if(error.context){const j=await error.context.json();m=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(m)}
  if(!data?.ok)throw new Error(data?.error||'opportunity_engine_error');
  return data;
}

function scoreClass(n){return Number(n)>=75?'ok':Number(n)>=55?'warn':''}
function reasonText(reasons){return (reasons||[]).map(r=>r?.label).filter(Boolean).slice(0,4).join(' · ')}
function renderItem(x){
  const o=x.opportunity||{},source=o.source?.name||o.source_label||'Источник';
  const budget=o.budget_max??o.budget_min;
  const converted=x.status==='converted';
  return `<div class="deal-card opportunity-card">
    <div class="deal-title"><strong>${esc(o.title||'Возможность')}</strong><small>${esc(source)}${o.city?` · ${esc(o.city)}`:''}${o.region?` · ${esc(o.region)}`:''}</small></div>
    <div><span class="badge ${scoreClass(x.score)}">MATCH ${esc(x.score)}/100</span><small style="display:block;margin-top:7px">услуга ${esc(x.service_score)} · гео ${esc(x.geography_score)} · бюджет ${esc(x.budget_score)}</small></div>
    <div class="deal-money"><strong>${money(budget,o.currency||'RUB')}</strong><small>${o.deadline_at?`до ${dt(o.deadline_at)}`:'дедлайн не указан'}</small></div>
    <div class="deal-next"><small>Почему подходит</small><br>${esc(reasonText(x.reasons)||'Совпадение рассчитано Station')}</div>
    <div class="item-actions deal-actions">
      ${o.source_url?`<a class="mini" href="${esc(o.source_url)}" target="_blank" rel="noopener noreferrer">Источник ↗</a>`:''}
      ${converted?'<span class="badge ok">УЖЕ В CRM</span>':`<button class="mini opp-save" data-id="${x.id}">Сохранить</button><button class="mini opp-reject" data-id="${x.id}">Не подходит</button><button class="mini primary opp-convert" data-id="${x.id}">В сделку →</button>`}
    </div>
  </div>`;
}

function render(d){
  const s=d.summary||{};
  if($('#oppTotal'))$('#oppTotal').textContent=s.total||0;
  if($('#oppNew'))$('#oppNew').textContent=s.new||0;
  if($('#oppHigh'))$('#oppHigh').textContent=s.high||0;
  if($('#oppHighPanel'))$('#oppHighPanel').textContent=s.high||0;
  if($('#oppPotential'))$('#oppPotential').textContent=`${money(s.potential_revenue||0)} потенциально`;
  if($('#oppPotentialBig'))$('#oppPotentialBig').textContent=money(s.potential_revenue||0);
  const list=$('#opportunityList');if(!list)return;
  list.innerHTML=(d.items||[]).length?(d.items||[]).map(renderItem).join(''):'<div class="empty-box"><b>Пока подходящих заказов нет.</b><br>Движок уже готов. Следующий слой — подключение реальных публичных источников и автоматический DISCOVER/FETCH по расписанию.</div>';
  document.querySelectorAll('.opp-save').forEach(b=>b.onclick=()=>setStatus(b.dataset.id,'saved'));
  document.querySelectorAll('.opp-reject').forEach(b=>b.onclick=()=>setStatus(b.dataset.id,'rejected'));
  document.querySelectorAll('.opp-convert').forEach(b=>b.onclick=()=>convert(b.dataset.id));
}

async function load(){
  const {data:{session}}=await sb.auth.getSession();if(!session)return;
  try{render(await api('snapshot'));if($('#oppStatus'))$('#oppStatus').textContent=''}catch(e){if($('#oppStatus'))$('#oppStatus').textContent='Opportunity Engine: '+e.message}
}
async function rescore(){
  const b=$('#oppRescore');if(b)b.disabled=true;if($('#oppStatus'))$('#oppStatus').textContent='Пересчитываем совпадения…';
  try{const r=await api('rescore');if($('#oppStatus'))$('#oppStatus').textContent=`Проверено ${r.scored}, подходит ${r.matched}.`;await load()}catch(e){if($('#oppStatus'))$('#oppStatus').textContent=e.message}finally{if(b)b.disabled=false}
}
async function setStatus(id,status){try{await api('set_match_status',{match_id:id,status});await load()}catch(e){alert(e.message)}}
async function convert(id){
  if(!confirm('Создать из этой возможности обычную сделку в CRM?'))return;
  try{const r=await api('convert_to_deal',{match_id:id});await load();alert(r.already_converted?'Эта возможность уже была перенесена в CRM.':`Сделка RPK-${String(r.deal?.deal_no||'').padStart(5,'0')} создана.`)}catch(e){alert(e.message)}
}

$('#oppRescore')?.addEventListener('click',rescore);
document.querySelectorAll('[data-jump="opportunities"]').forEach(b=>b.addEventListener('click',()=>document.getElementById('opportunities')?.scrollIntoView({behavior:'smooth',block:'start'})));
sb.auth.onAuthStateChange(()=>setTimeout(load,500));
setTimeout(load,900);
import('./rpk-need-radar.js?v=20260910-need1').catch(err=>console.error('Need Radar UI load failed',err));
import('./rpk-44fz-radar.js?v=20260911-44fz1').catch(err=>console.error('44-FZ Radar UI load failed',err));
import('./rpk-tender-economics.js?v=20260911-te2').catch(err=>console.error('Tender Economics UI load failed',err));
