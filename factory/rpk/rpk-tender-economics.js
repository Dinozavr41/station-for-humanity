import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const WORKSPACE=new URLSearchParams(location.search).get('w')||'focus-biysk';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const money=v=>v==null?'—':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(Number(v)||0);
const pct=v=>v==null?'—':`${Number(v).toLocaleString('ru-RU',{maximumFractionDigits:1})}%`;
const numPrompt=(title,value)=>{const x=prompt(title,value==null?'':String(value));if(x===null)return undefined;if(x.trim()==='')return null;const n=Number(x.replace(',','.'));return Number.isFinite(n)?n:undefined};
let snapshot=null;
const importInFlight=new Set();

async function rpc(name,args){const {data,error}=await sb.rpc(name,args);if(error)throw new Error(error.message);return data}
function statusLabel(s){return({draft:'НУЖНЫ ДАННЫЕ',review_ready:'ГОТОВО К РЕШЕНИЮ',approved:'ОДОБРЕНО',rejected:'ОТКЛОНЕНО'})[s]||s}
function statusClass(s){return s==='approved'||s==='review_ready'?'ok':s==='draft'?'warn':''}

function inject(){
  if($('#tenderEconomics'))return;
  const opp=$('#opportunities');if(!opp)return;
  const sec=document.createElement('section');sec.id='tenderEconomics';sec.className='panel section';sec.innerHTML=`
    <div class="section-head"><div><p class="eyebrow">STATION TENDER ECONOMICS · HUMAN-IN-THE-LOOP</p><h2>Экономика тендеров</h2></div><button id="tenderReload" class="primary">Пересчитать</button></div>
    <p class="muted">Station не показывает прибыль, пока не закрыты обязательные строки себестоимости. У каждой цены хранится источник. Финальное «участвуем» подтверждает владелец.</p>
    <div id="tenderStatus"></div><div id="tenderList" class="tender-econ-list"><div class="empty-box">Загружаем расчёты…</div></div>`;
  opp.insertAdjacentElement('afterend',sec);
  const nav=$('#moduleNav');if(nav&&!nav.querySelector('[data-jump="tenderEconomics"]')){const b=document.createElement('button');b.dataset.jump='tenderEconomics';b.textContent='Экономика тендеров';nav.insertBefore(b,nav.querySelector('[data-jump="crm"]')||null);b.onclick=()=>sec.scrollIntoView({behavior:'smooth',block:'start'})}
  $('#tenderReload').onclick=async()=>{for(const x of snapshot?.items||[])await rpc('rpk_tender_recalculate',{p_workspace_slug:WORKSPACE,p_calculation_id:x.calculation.id});await load()};
  const st=document.createElement('style');st.textContent=`
    .tender-econ-list{display:grid;gap:16px}.tender-econ-card{border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:18px;background:rgba(7,17,31,.5)}
    .tender-econ-head{display:flex;gap:14px;justify-content:space-between;align-items:flex-start}.tender-econ-head h3{margin:4px 0 6px;font-size:20px}.tender-econ-metrics{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:10px;margin:16px 0}.tender-econ-metrics div{padding:12px;border-radius:12px;background:rgba(255,255,255,.05)}.tender-econ-metrics small{display:block;color:#9fb4c3}.tender-econ-metrics strong{display:block;font-size:18px;margin-top:5px}.tender-lines{display:grid;gap:7px}.tender-line{display:grid;grid-template-columns:1.5fr .65fr 1.2fr auto;gap:10px;align-items:center;padding:9px 10px;border-radius:10px;background:rgba(255,255,255,.035)}.tender-line small{color:#9fb4c3}.tender-missing{color:#ffcf70}.tender-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.tender-proof{font-size:12px;color:#9fb4c3;overflow-wrap:anywhere}@media(max-width:900px){.tender-econ-metrics{grid-template-columns:repeat(2,1fr)}.tender-line{grid-template-columns:1fr}.tender-econ-head{display:block}}
  `;document.head.appendChild(st);
}

function lineHtml(c,l){
  const known=l.total_cost!=null;const src=l.source_label||'источник не указан';
  return `<div class="tender-line"><div><strong>${esc(l.item_name)}</strong><small>${esc(l.specification||'')}</small></div><div class="${known?'':'tender-missing'}"><strong>${known?money(l.total_cost):'НУЖНА ЦЕНА'}</strong><small>${known?`${Math.round(Number(l.confidence||0)*100)}% confidence`:'блокирует прибыль'}</small></div><div class="tender-proof">${l.source_url?`<a href="${esc(l.source_url)}" target="_blank" rel="noopener noreferrer">${esc(src)} ↗</a>`:esc(src)}</div><button class="mini tender-line-edit" data-calc="${c.id}" data-line="${l.line_no}">Изменить</button></div>`;
}
function card(x){
  const c=x.calculation,o=x.opportunity||{},lines=x.lines||[],missing=c.missing_data||[];const canApprove=['owner','platform_admin'].includes(snapshot?.access_role);const ready=c.status==='review_ready';
  const sourceCount=Array.isArray(c.assumptions?.attachments)?c.assumptions.attachments.length:0;
  return `<article class="tender-econ-card">
    <div class="tender-econ-head"><div><span class="badge ${statusClass(c.status)}">${esc(statusLabel(c.status))}</span><h3>${esc(o.source_item_id||'Тендер')} · ${esc(o.title||'')}</h3><div class="muted">${esc(o.buyer_name||'Заказчик не указан')} · ${esc(o.region||o.city||'')}${sourceCount?` · источников: ${sourceCount}`:''}</div></div><div>${o.source_url?`<a class="mini" href="${esc(o.source_url)}" target="_blank" rel="noopener noreferrer">Тендер ↗</a>`:''}</div></div>
    <div class="tender-econ-metrics"><div><small>НМЦ / бюджет</small><strong>${money(c.tender_price)}</strong></div><div><small>Наша ставка</small><strong>${money(c.candidate_bid)}</strong></div><div><small>Себестоимость</small><strong>${money(c.total_cost)}</strong></div><div><small>Прибыль</small><strong>${c.projected_profit==null?'ЗАБЛОКИРОВАНА':money(c.projected_profit)}</strong></div><div><small>STOP PRICE</small><strong>${money(c.stop_price)}</strong></div></div>
    <div class="muted">Покрытие себестоимости: <b>${pct(c.cost_coverage_pct)}</b> · доверие: <b>${pct(Number(c.confidence||0)*100)}</b>${missing.length?` · не закрыто: <b>${missing.length}</b>`:''}</div>
    <div class="tender-lines">${lines.map(l=>lineHtml(c,l)).join('')}</div>
    <div class="tender-actions"><button class="mini tender-policy" data-id="${c.id}">Ставка / порог прибыли</button><button class="mini tender-recalc" data-id="${c.id}">Пересчитать</button>${canApprove&&ready?`<button class="mini primary tender-approve" data-id="${c.id}">✓ Участвуем</button>`:''}${canApprove&&c.status!=='rejected'?`<button class="mini tender-reject" data-id="${c.id}">Отклонить</button>`:''}</div>
  </article>`;
}
function render(d){snapshot=d;$('#tenderList').innerHTML=(d.items||[]).length?(d.items||[]).map(card).join(''):'<div class="empty-box">Расчётов пока нет. Они создаются для тендерных возможностей после первичного отбора.</div>';bind()}
function bind(){
  document.querySelectorAll('.tender-line-edit').forEach(b=>b.onclick=()=>editLine(b.dataset.calc,Number(b.dataset.line)));
  document.querySelectorAll('.tender-policy').forEach(b=>b.onclick=()=>policy(b.dataset.id));
  document.querySelectorAll('.tender-recalc').forEach(b=>b.onclick=()=>recalc(b.dataset.id));
  document.querySelectorAll('.tender-approve').forEach(b=>b.onclick=()=>decide(b.dataset.id,'approve'));
  document.querySelectorAll('.tender-reject').forEach(b=>b.onclick=()=>decide(b.dataset.id,'reject'));
}
async function editLine(calcId,lineNo){
  const item=snapshot.items.find(x=>x.calculation.id===calcId);const l=item?.lines.find(x=>Number(x.line_no)===lineNo);if(!l)return;
  const total=numPrompt(`Стоимость «${l.item_name}», ₽\nЕсли неизвестна — оставить пусто`,l.total_cost);if(total===undefined)return;
  const source=prompt('Источник цены / кто подтвердил',l.source_label||'');if(source===null)return;const url=prompt('Ссылка на источник (можно пусто)',l.source_url||'');if(url===null)return;
  const conf=numPrompt('Достоверность цены, % (0–100)',Math.round(Number(l.confidence||0)*100));if(conf===undefined)return;
  try{await rpc('rpk_tender_update_line',{p_workspace_slug:WORKSPACE,p_calculation_id:calcId,p_line_no:lineNo,p_patch:{total_cost:total,cost_basis:l.cost_basis==='official_fee'?'official_fee':(url?'market_price':'manual'),source_label:source,source_url:url,source_date:new Date().toISOString().slice(0,10),confidence:conf==null?0:Math.max(0,Math.min(1,conf/100))}});await load()}catch(e){alert(e.message)}
}
async function policy(id){
  const c=snapshot.items.find(x=>x.calculation.id===id)?.calculation;if(!c)return;
  const bid=numPrompt('Наша плановая ставка, ₽',c.candidate_bid??c.tender_price);if(bid===undefined)return;const profit=numPrompt('Минимальная прибыль, ₽',c.min_profit);if(profit===undefined)return;const margin=numPrompt('Минимальная маржа, %',c.min_margin_pct);if(margin===undefined)return;
  try{await rpc('rpk_tender_set_policy',{p_workspace_slug:WORKSPACE,p_calculation_id:id,p_candidate_bid:bid,p_min_profit:profit,p_min_margin_pct:margin});await load()}catch(e){alert(e.message)}
}
async function recalc(id){try{await rpc('rpk_tender_recalculate',{p_workspace_slug:WORKSPACE,p_calculation_id:id});await load()}catch(e){alert(e.message)}}
async function decide(id,decision){const text=decision==='approve'?'Подтвердить участие с текущей экономикой?':'Отклонить этот тендер?';if(!confirm(text))return;const comment=prompt('Комментарий к решению (можно пусто)','');if(comment===null)return;try{await rpc('rpk_tender_decide',{p_workspace_slug:WORKSPACE,p_calculation_id:id,p_decision:decision,p_comment:comment});await load()}catch(e){alert(e.message)}}

async function autoImportTenderDocs(d){
  for(const item of d?.items||[]){
    const needId=Number(item?.calculation?.assumptions?.need_id||0);if(!Number.isInteger(needId)||needId<=0||importInFlight.has(needId))continue;
    const key=`station:rpk:tender-import:${WORKSPACE}:${needId}`;let state={};try{state=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
    const now=Date.now(),done=state?.status==='done',recent=state?.at&&now-Number(state.at)<30*60*1000;if(done||recent)continue;
    importInFlight.add(needId);localStorage.setItem(key,JSON.stringify({status:'trying',at:now}));
    try{
      const {data,error}=await sb.functions.invoke('rpk-tender-public-import',{body:{workspace_slug:WORKSPACE,need_id:needId}});
      if(error||!data?.ok)throw new Error(error?.message||data?.error||'tender_document_import_failed');
      localStorage.setItem(key,JSON.stringify({status:'done',at:Date.now(),success:data.success,total:data.total}));
      if($('#tenderStatus'))$('#tenderStatus').textContent=`Исходники закупки ${needId}: ${data.success}/${data.total} сохранены в защищённый архив.`;
    }catch(e){
      localStorage.setItem(key,JSON.stringify({status:'retry',at:Date.now(),error:String(e?.message||e)}));
      console.warn('Tender document auto-import will retry later',needId,e);
    }finally{importInFlight.delete(needId)}
  }
}

async function load(){const {data:{session}}=await sb.auth.getSession();if(!session)return;try{const d=await rpc('rpk_tender_snapshot',{p_workspace_slug:WORKSPACE});render(d);$('#tenderStatus').textContent='';void autoImportTenderDocs(d)}catch(e){$('#tenderStatus').innerHTML=`<div class="empty-box">Tender Economics: ${esc(e.message)}</div>`}}

inject();sb.auth.onAuthStateChange(()=>setTimeout(load,500));setTimeout(load,1200);
