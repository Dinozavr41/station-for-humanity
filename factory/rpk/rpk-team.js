import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const WORKSPACE=new URLSearchParams(location.search).get('w')||'focus-biysk';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
let accessRole=null;

async function teamApi(action,payload={}){
  const {data,error}=await sb.functions.invoke('rpk-team',{body:{action,workspace_slug:WORKSPACE,...payload}});
  if(error){let m=error.message;try{if(error.context){const j=await error.context.json();m=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(m)}
  if(!data?.ok)throw new Error(data?.error||'rpk_team_error');
  return data;
}
function human(a){
  const m={
    'rpk.member_added':'Добавил сотрудника','rpk.member_role_changed':'Изменил роль сотрудника','rpk.member_disabled':'Отключил сотрудника',
    'rpk.client_created':'Создал клиента','rpk.client_updated':'Изменил карточку клиента',
    'rpk.deal_created':'Создал сделку','rpk.deal_updated':'Изменил сделку','rpk.cash_entry_created':'Добавил приход / расход',
    'rpk.document_draft_created':'Создал черновик документа','rpk.document_uploaded':'Загрузил документ','rpk.document_downloaded':'Скачал документ','rpk.document_cloned':'Создал новый документ из старого',
    'rpk.accounting_request_created':'Создал запрос бухгалтеру','rpk.accounting_request_updated':'Изменил статус запроса бухгалтеру','rpk.communication_logged':'Добавил событие в переписку','rpk.mailbox_registered':'Добавил почту',
    'rpk.artwork_uploaded':'Загрузил старый макет','rpk.artwork_client_assigned':'Привязал макет к клиенту','rpk.remake_created':'Запустил переделку старого макета',
    'rpk.print_questionnaire_created':'Создал анкету печатника','rpk.print_questionnaire_updated':'Изменил параметры печати','rpk.print_profile_confirmed':'Подтвердил профиль печати',
    'rpk.module_toggled':'Изменил набор рабочих модулей'
  };
  if(m[a])return m[a];
  if(a?.startsWith('rpk.ui.'))return a.split('.').slice(-2).join(' · ').replaceAll('_',' ');
  return String(a||'Действие').replaceAll('_',' ');
}
function syncOperationalButtons(){
  if(accessRole!=='manager')return;
  document.querySelectorAll('.module-switch').forEach(b=>b.disabled=false);
}
function inject(){
  if(document.getElementById('team'))return;
  const nav=document.getElementById('moduleNav');
  if(nav){const b=document.createElement('button');b.dataset.jump='team';b.textContent='Команда / История';b.onclick=()=>document.getElementById('team')?.scrollIntoView({behavior:'smooth',block:'start'});nav.appendChild(b)}
  const workspace=document.getElementById('workspace');if(!workspace)return;
  const s=document.createElement('section');s.id='team';s.className='panel section';s.innerHTML=`
    <div class="section-head"><div><p class="eyebrow">КОМАНДА РПК</p><h2>Люди и цифровой след</h2></div><div class="row"><button id="teamAdd" class="primary">+ Сотрудник</button><button id="teamReload" class="ghost">Обновить</button></div></div>
    <p class="muted">Владелец и менеджер работают с одной базой и видят одинаковые операционные цифры. Каждое изменение привязано к конкретному аккаунту.</p>
    <div id="teamMembers" class="list"></div>
    <div class="subsection"><div class="section-head"><div><p class="eyebrow">ACTIVITY LOG</p><h2>Кто что делал</h2></div></div><div id="teamActivity" class="list"></div></div>`;
  workspace.appendChild(s);
  const st=document.createElement('style');st.textContent=`#teamActivity .rpk-activity{grid-template-columns:170px minmax(180px,1fr) minmax(220px,1.4fr)}#teamMembers .rpk-member{grid-template-columns:minmax(220px,1.5fr) 120px 120px auto}@media(max-width:800px){#teamActivity .rpk-activity,#teamMembers .rpk-member{grid-template-columns:1fr}}`;document.head.appendChild(st);
  document.getElementById('teamAdd').onclick=addMember;document.getElementById('teamReload').onclick=loadTeam;
  new MutationObserver(syncOperationalButtons).observe(document.getElementById('moduleList')||workspace,{childList:true,subtree:true});
}
async function addMember(){
  if(!['owner','platform_admin'].includes(accessRole))return alert('Составом команды управляет владелец компании.');
  const email=prompt('Email сотрудника');if(!email)return;
  const role=prompt('Роль: owner или manager','manager');if(!role)return;
  try{const x=await teamApi('add_member',{email,role});alert(x.invited?'Приглашение отправлено на email.':'Сотрудник добавлен.');await loadTeam()}catch(e){alert(e.message)}
}
async function loadTeam(){
  inject();
  const {data:{session}}=await sb.auth.getSession();if(!session)return;
  try{
    const x=await teamApi('snapshot',{limit:200});accessRole=x.access_role;syncOperationalButtons();
    const add=document.getElementById('teamAdd');if(add)add.hidden=!['owner','platform_admin'].includes(accessRole);
    const members=x.members||[];
    document.getElementById('teamMembers').innerHTML=members.length?members.map(m=>`<div class="item rpk-member"><div><strong>${esc(m.name||m.email||'Пользователь')}</strong><small>${esc(m.email||'')}</small></div><div>${esc(m.role)}</div><div>${m.status==='active'?'✅ активен':'⛔ отключён'}</div><div></div></div>`).join(''):'<div class="empty-box">Сотрудники РПК ещё не добавлены отдельными аккаунтами.</div>';
    const logs=(x.activity||[]).filter(v=>String(v.action||'').startsWith('rpk.'));
    document.getElementById('teamActivity').innerHTML=logs.length?logs.map(v=>`<div class="item rpk-activity"><div><strong>${new Date(v.created_at).toLocaleString('ru-RU')}</strong></div><div><strong>${esc(v.actor?.name||v.actor?.email||'System')}</strong><small>${esc(v.actor?.email||'')}</small></div><div>${esc(human(v.action))}<small>${esc(v.entity_type||'')} ${esc(v.entity_id||'')}</small></div></div>`).join(''):'<div class="empty-box">История появится после первых действий сотрудников.</div>';
  }catch(e){const a=document.getElementById('teamActivity');if(a)a.innerHTML=`<div class="empty-box danger">История не загрузилась: ${esc(e.message)}</div>`}
}

inject();
sb.auth.onAuthStateChange(()=>setTimeout(loadTeam,450));
setTimeout(loadTeam,700);
