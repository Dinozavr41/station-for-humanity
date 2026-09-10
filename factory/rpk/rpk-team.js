import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const WORKSPACE=new URLSearchParams(location.search).get('w')||'focus-biysk';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
let accessRole=null,allowedRoles=[];
const roleLabels={owner:'Владелец / директор',manager:'Менеджер',designer:'Дизайнер',printer:'Печатник',production:'Производство',accountant:'Бухгалтер',installer:'Монтажник',viewer:'Только просмотр',platform_admin:'Администратор Station'};

async function teamApi(action,payload={}){
  const {data,error}=await sb.functions.invoke('rpk-team',{body:{action,workspace_slug:WORKSPACE,...payload}});
  if(error){let m=error.message;try{if(error.context){const j=await error.context.json();m=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(m)}
  if(!data?.ok)throw new Error(data?.error||'rpk_team_error');
  return data;
}
function human(a){
  const m={
    'rpk.member_added':'Добавил сотрудника','rpk.member_role_changed':'Изменил роль сотрудника','rpk.member_disabled':'Отключил сотрудника','rpk.team_size_updated':'Указал размер команды',
    'rpk.client_created':'Создал клиента','rpk.client_updated':'Изменил карточку клиента','rpk.deal_created':'Создал сделку','rpk.deal_updated':'Изменил сделку','rpk.cash_entry_created':'Добавил приход / расход',
    'rpk.document_draft_created':'Создал черновик документа','rpk.document_uploaded':'Загрузил документ','rpk.document_downloaded':'Скачал документ','rpk.document_cloned':'Создал новый документ из старого',
    'rpk.accounting_request_created':'Создал запрос бухгалтеру','rpk.accounting_request_updated':'Изменил статус запроса бухгалтеру','rpk.communication_logged':'Добавил событие в переписку','rpk.mailbox_registered':'Добавил почту',
    'rpk.artwork_uploaded':'Загрузил старый макет','rpk.artwork_client_assigned':'Привязал макет к клиенту','rpk.remake_created':'Запустил переделку старого макета',
    'rpk.print_questionnaire_created':'Создал анкету печатника','rpk.print_questionnaire_updated':'Изменил параметры печати','rpk.print_profile_confirmed':'Подтвердил профиль печати','rpk.module_toggled':'Изменил набор рабочих модулей'
  };
  if(m[a])return m[a];if(a?.startsWith('rpk.ui.'))return a.split('.').slice(-2).join(' · ').replaceAll('_',' ');return String(a||'Действие').replaceAll('_',' ');
}
function canOwn(){return ['owner','platform_admin'].includes(accessRole)}
function syncOperationalButtons(){if(accessRole!=='manager')return;document.querySelectorAll('.module-switch').forEach(b=>b.disabled=false)}
function inject(){
  if(document.getElementById('team'))return;
  const nav=document.getElementById('moduleNav');if(nav){const b=document.createElement('button');b.dataset.jump='team';b.textContent='Команда / История';b.onclick=()=>document.getElementById('team')?.scrollIntoView({behavior:'smooth',block:'start'});nav.appendChild(b)}
  const workspace=document.getElementById('workspace');if(!workspace)return;
  const s=document.createElement('section');s.id='team';s.className='panel section';s.innerHTML=`
    <div class="section-head"><div><p class="eyebrow">КОМАНДА РПК</p><h2>Люди, роли и цифровой след</h2></div><div class="row"><button id="teamAdd" class="primary">+ Сотрудник</button><button id="teamReload" class="ghost">Обновить</button></div></div>
    <p class="muted">Владелец сам определяет размер команды и решает, кому открыть CRM и в какой роли. Доступ можно отключить в любой момент. Администратор Station имеет сервисный доступ для поддержки системы, но не считается сотрудником компании.</p>
    <div id="teamStats" class="money-strip" style="margin:18px 0"></div>
    <div id="teamMembers" class="list"></div>
    <div class="subsection"><div class="section-head"><div><p class="eyebrow">ACTIVITY LOG</p><h2>Кто что делал</h2></div></div><div id="teamActivity" class="list"></div></div>`;
  workspace.appendChild(s);
  const st=document.createElement('style');st.textContent=`#teamActivity .rpk-activity{grid-template-columns:170px minmax(180px,1fr) minmax(220px,1.4fr)}#teamMembers .rpk-member{grid-template-columns:minmax(220px,1.5fr) minmax(150px,.8fr) 110px minmax(130px,.6fr)}.member-role{width:100%;background:#071522;color:#eef8ff;border:1px solid rgba(255,255,255,.11);border-radius:9px;padding:8px}.team-size-row{display:flex;gap:8px;align-items:center}.team-size-row input{width:90px;background:#071522;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:8px}@media(max-width:800px){#teamActivity .rpk-activity,#teamMembers .rpk-member{grid-template-columns:1fr}}`;document.head.appendChild(st);
  document.getElementById('teamAdd').onclick=addMember;document.getElementById('teamReload').onclick=loadTeam;new MutationObserver(syncOperationalButtons).observe(document.getElementById('moduleList')||workspace,{childList:true,subtree:true});
}
async function addMember(){
  if(!canOwn())return alert('Составом команды управляет владелец компании.');
  const email=prompt('Email сотрудника');if(!email)return;
  const menu=allowedRoles.map((r,i)=>`${i+1}. ${roleLabels[r]||r} (${r})`).join('\n');const raw=prompt(`Выберите роль номером:\n${menu}`,'2');if(raw===null)return;const role=allowedRoles[Number(raw)-1]||raw.trim();if(!allowedRoles.includes(role))return alert('Такой роли нет.');
  try{const x=await teamApi('add_member',{email,role});alert(x.invited?'Приглашение отправлено на email. После первого входа сотрудник увидит только ООО «Фокус».':'Сотрудник добавлен в команду.');await loadTeam()}catch(e){alert(e.message)}
}
async function setRole(userId,role){if(!canOwn())return;try{await teamApi('set_member_role',{user_id:userId,role});await loadTeam()}catch(e){alert(e.message)}}
async function disableMember(userId){if(!canOwn())return;if(!confirm('Отключить этому сотруднику доступ к CRM? Данные и история его действий сохранятся.'))return;try{await teamApi('disable_member',{user_id:userId});await loadTeam()}catch(e){alert(e.message)}}
async function saveTeamSize(){const n=Number(document.getElementById('declaredTeamSize').value);if(!Number.isInteger(n)||n<1)return alert('Укажите реальное количество сотрудников.');try{await teamApi('set_team_size',{declared_team_size:n});await loadTeam()}catch(e){alert(e.message)}}
function renderStats(team){const el=document.getElementById('teamStats');const size=team?.declared_size??'';el.innerHTML=`<div><small>ВСЕГО ЛЮДЕЙ В КОМПАНИИ</small>${canOwn()?`<div class="team-size-row"><input id="declaredTeamSize" type="number" min="1" max="5000" value="${esc(size)}" placeholder="сколько"><button id="saveTeamSize" class="mini">Сохранить</button></div>`:`<strong>${size||'не указано'}</strong>`}</div><div><small>ДОСТУП К CRM</small><strong>${Number(team?.active_crm_users||0)}</strong></div><div><small>ПРИНЦИП</small><strong style="font-size:16px">Доступ только по приглашению</strong></div>`;document.getElementById('saveTeamSize')?.addEventListener('click',saveTeamSize)}
function renderMembers(members){const owner=canOwn();document.getElementById('teamMembers').innerHTML=members.length?members.map(m=>{const platform=m.role==='platform_admin';const options=allowedRoles.map(r=>`<option value="${r}" ${m.role===r?'selected':''}>${esc(roleLabels[r]||r)}</option>`).join('');return `<div class="item rpk-member"><div><strong>${esc(m.name||m.email||'Пользователь')}</strong><small>${esc(m.email||'')}</small></div><div>${platform?esc(roleLabels.platform_admin):`<select class="member-role" data-user="${esc(m.user_id)}" ${owner?'':'disabled'}>${options}</select>`}</div><div>${m.status==='active'?'✅ активен':'⛔ отключён'}</div><div>${owner&&!platform&&m.status==='active'?`<button class="mini disable-member" data-user="${esc(m.user_id)}">Отключить</button>`:''}</div></div>`}).join(''):'<div class="empty-box">Доступ к CRM пока никому из сотрудников не выдан.</div>';document.querySelectorAll('.member-role').forEach(s=>s.onchange=()=>setRole(s.dataset.user,s.value));document.querySelectorAll('.disable-member').forEach(b=>b.onclick=()=>disableMember(b.dataset.user))}
async function loadTeam(){
  inject();const {data:{session}}=await sb.auth.getSession();if(!session)return;
  try{const x=await teamApi('snapshot',{limit:200});accessRole=x.access_role;allowedRoles=x.allowed_roles||['owner','manager'];syncOperationalButtons();const add=document.getElementById('teamAdd');if(add)add.hidden=!canOwn();renderStats(x.team);renderMembers(x.members||[]);const logs=(x.activity||[]).filter(v=>String(v.action||'').startsWith('rpk.'));document.getElementById('teamActivity').innerHTML=logs.length?logs.map(v=>`<div class="item rpk-activity"><div><strong>${new Date(v.created_at).toLocaleString('ru-RU')}</strong></div><div><strong>${esc(v.actor?.name||v.actor?.email||'System')}</strong><small>${esc(v.actor?.email||'')}</small></div><div>${esc(human(v.action))}<small>${esc(v.entity_type||'')} ${esc(v.entity_id||'')}</small></div></div>`).join(''):'<div class="empty-box">История появится после первых действий сотрудников.</div>'}catch(e){const a=document.getElementById('teamActivity');if(a)a.innerHTML=`<div class="empty-box danger">История не загрузилась: ${esc(e.message)}</div>`}
}

inject();sb.auth.onAuthStateChange(()=>setTimeout(loadTeam,450));setTimeout(loadTeam,700);