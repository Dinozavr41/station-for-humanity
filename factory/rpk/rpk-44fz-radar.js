import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const WORKSPACE=new URLSearchParams(location.search).get('w')||'focus-biysk';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>v==null?'НМЦК не распознана':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(Number(v)||0);
const dt=v=>v?new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'дедлайн в карточке ЕИС';
const CATEGORIES=[
  ['banner','Баннеры'],['signage','Вывески'],['rim','РИМ'],['stands','Стенды'],
  ['plates','Таблички'],['print','Полиграфия'],['outdoor','Наружка'],['branding','Брендированная продукция']
];
let current='banner';
let items=[];
let imported=new Set();

function inject(){
  if($('#tender44Radar'))return;
  const opp=$('#opportunities');if(!opp)return;
  const sec=document.createElement('section');sec.id='tender44Radar';sec.className='panel section';sec.innerHTML=`
    <div class="section-head">
      <div><p class="eyebrow">ЕИС · ТОЛЬКО 44-ФЗ · БОЕВОЙ КОНТУР</p><h2>Тендерная биржа 44-ФЗ</h2></div>
      <button id="t44Reload" class="primary">Обновить ЕИС</button>
    </div>
    <p class="muted">Здесь нет 223-ФЗ и коммерческих платных подборок. Источник — официальный ЕИС. Кнопка «В расчёт» только создаёт карточку и экономику; КЭП и подача заявки остаются отдельным осознанным действием владельца.</p>
    <div class="t44-categories" id="t44Categories"></div>
    <div class="t44-stats"><div><small>Режим</small><strong>44-ФЗ ONLY</strong></div><div><small>Источник</small><strong>zakupki.gov.ru</strong></div><div><small>Найдено</small><strong id="t44Count">—</strong></div><div><small>Категория</small><strong id="t44Query">—</strong></div></div>
    <div id="t44Status" class="muted"></div>
    <div id="t44List" class="t44-list"><div class="empty-box">Нажмите «Обновить ЕИС» или выберите категорию.</div></div>`;
  opp.insertAdjacentElement('afterend',sec);
  const st=document.createElement('style');st.textContent=`
    .t44-categories{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.t44-cat{border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.035);color:inherit;border-radius:999px;padding:8px 12px;cursor:pointer}.t44-cat.active{border-color:rgba(95,214,255,.65);background:rgba(95,214,255,.12)}
    .t44-stats{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px;margin:12px 0 16px}.t44-stats>div{padding:12px;border-radius:12px;background:rgba(255,255,255,.045)}.t44-stats small{display:block;color:#9fb4c3}.t44-stats strong{display:block;margin-top:4px}
    .t44-list{display:grid;gap:12px}.t44-card{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(150px,.6fr) auto;gap:14px;align-items:center;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px;background:rgba(7,17,31,.48)}.t44-card h3{margin:5px 0 7px;font-size:18px}.t44-meta{font-size:12px;color:#9fb4c3}.t44-money{text-align:right}.t44-money strong{display:block;font-size:18px}.t44-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.t44-law{display:inline-flex;padding:5px 8px;border-radius:999px;background:rgba(92,219,153,.12);border:1px solid rgba(92,219,153,.35);font-size:11px;font-weight:800;letter-spacing:.04em}.t44-imported{color:#7fe7ac;font-weight:800;font-size:12px}
    @media(max-width:900px){.t44-stats{grid-template-columns:repeat(2,1fr)}.t44-card{grid-template-columns:1fr}.t44-money{text-align:left}.t44-actions{justify-content:flex-start}}
  `;document.head.appendChild(st);
  $('#t44Categories').innerHTML=CATEGORIES.map(([k,n])=>`<button class="t44-cat ${k===current?'active':''}" data-key="${k}">${n}</button>`).join('');
  document.querySelectorAll('.t44-cat').forEach(b=>b.onclick=()=>{current=b.dataset.key;document.querySelectorAll('.t44-cat').forEach(x=>x.classList.toggle('active',x===b));scan()});
  $('#t44Reload').onclick=scan;
  const nav=$('#moduleNav');if(nav&&!nav.querySelector('[data-jump="tender44Radar"]')){const b=document.createElement('button');b.dataset.jump='tender44Radar';b.textContent='44-ФЗ';nav.insertBefore(b,nav.querySelector('[data-jump="crm"]')||null);b.onclick=()=>sec.scrollIntoView({behavior:'smooth',block:'start'})}
}

function relevance(x){
  const t=`${x.title||''} ${x.description||''}`.toLowerCase();let s=50;
  if(/баннер|вывес|таблич|стенд|полиграф|печат|рекламно-информац|светов/.test(t))s+=25;
  if(/монтаж|установк/.test(t))s+=5;
  if(Number(x.budget_max)>=100000)s+=5;
  if(Number(x.budget_max)>=300000)s+=5;
  if(Number(x.budget_max)>=1000000)s+=5;
  return Math.min(100,s);
}
function card(x,i){
  const score=relevance(x),num=x.purchase_number||x.id||'ЕИС';
  return `<article class="t44-card">
    <div><span class="t44-law">44-ФЗ · ЕИС</span><h3>${esc(x.title||'Закупка')}</h3><div class="t44-meta">№ ${esc(num)} · обновлено ${x.published_at?dt(x.published_at):'ЕИС'} · предварительный fit ${score}/100</div></div>
    <div class="t44-money"><strong>${money(x.budget_max)}</strong><small>приём: ${esc(dt(x.deadline_at))}</small></div>
    <div class="t44-actions">${x.source_url?`<a class="mini" href="${esc(x.source_url)}" target="_blank" rel="noopener noreferrer">ЕИС ↗</a>`:''}${imported.has(String(num))?'<span class="t44-imported">В РАСЧЁТЕ ✓</span>':`<button class="mini primary t44-import" data-i="${i}">В расчёт →</button>`}</div>
  </article>`;
}
function render(){
  $('#t44Count').textContent=String(items.length);$('#t44Query').textContent=CATEGORIES.find(x=>x[0]===current)?.[1]||current;
  $('#t44List').innerHTML=items.length?items.map(card).join(''):'<div class="empty-box">ЕИС не вернул подходящих записей по этой категории.</div>';
  document.querySelectorAll('.t44-import').forEach(b=>b.onclick=()=>importCandidate(Number(b.dataset.i),b));
}
async function scan(){
  const b=$('#t44Reload');b.disabled=true;$('#t44Status').textContent='Читаем официальный RSS ЕИС, только 44-ФЗ…';
  try{
    const r=await fetch(`/api/opportunity/eis-rss?q=${encodeURIComponent(current)}`,{headers:{accept:'application/json'}});const d=await r.json();
    if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);
    if(d.law!=='44-FZ')throw new Error('Источник вернул процедуру вне разрешённого контура');
    items=(d.items||[]).filter(x=>x?.law==='44-FZ'&&String(x?.source_url||'').startsWith('https://zakupki.gov.ru/'));
    render();$('#t44Status').textContent=`ЕИС: ${items.length} записей · запрос «${d.search||current}» · 223-ФЗ отключён.`;
  }catch(e){items=[];render();$('#t44Status').textContent=`ЕИС временно недоступен: ${e.message}`}
  finally{b.disabled=false}
}
async function importCandidate(i,button){
  const x=items[i];if(!x)return;button.disabled=true;button.textContent='Импорт…';$('#t44Status').textContent='Создаём карточку и обязательные строки себестоимости…';
  try{
    const {data,error}=await sb.rpc('rpk_44fz_import_candidate',{p_workspace_slug:WORKSPACE,p_candidate:x});if(error)throw error;
    const key=String(x.purchase_number||x.id||'');imported.add(key);render();
    try{await sb.functions.invoke('opportunity-engine',{body:{action:'rescore',workspace_slug:WORKSPACE}})}catch{}
    $('#t44Status').textContent='Готово: закупка помещена в расчёт. Прибыль останется заблокированной, пока не закрыты все обязательные расходы.';
    window.dispatchEvent(new CustomEvent('station:tender-imported',{detail:data||{}}));
    setTimeout(()=>document.getElementById('tenderEconomics')?.scrollIntoView({behavior:'smooth',block:'start'}),250);
  }catch(e){$('#t44Status').textContent=`Не удалось импортировать: ${e.message}`;button.disabled=false;button.textContent='В расчёт →'}
}

inject();
const {data:{session}}=await sb.auth.getSession();if(session)setTimeout(scan,500);
sb.auth.onAuthStateChange((_event,s)=>{if(s)setTimeout(scan,500)});
