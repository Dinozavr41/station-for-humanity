import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ACTIVE=new Set(['PLANNED','CODING','QA','BUILD']);
let snapshot={agents:[],projects:[],gates:[],events:[],assistant_queue:[],checkpoints:[]};
let currentFilter='all',currentDoc='handoff_md',timer=null,currentProject=null;

async function invoke(action,payload={}){const {data,error}=await sb.functions.invoke('my-bay-control',{body:{action,...payload}});if(error){let detail=error.message;try{if(error.context){const j=await error.context.json();detail=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(detail)}if(!data?.ok)throw new Error(data?.error||'my_bay_error');return data}
const fmt=d=>d?new Date(d).toLocaleString():'—';
const ago=d=>!d?Infinity:(Date.now()-new Date(d).getTime())/1000;
function stateClass(s){if(s==='READY')return'state-ready';if(s==='FAILED'||s==='CANCELED')return'state-failed';if(s==='HUMAN_GATE')return'state-human';if(ACTIVE.has(s)||s==='NEW')return'state-active';return''}
function progressIndex(s){return {NEW:0,PLANNED:0,CODING:1,QA:2,BUILD:3,READY:5}[s]??0}
function actionButton(text,cls,fn){const b=document.createElement('button');b.className=cls;b.textContent=text;b.onclick=async()=>{b.disabled=true;try{await fn()}finally{b.disabled=false}};return b}

async function boot(){const {data:{session}}=await sb.auth.getSession();if(!session){$('#identity').textContent='OFFLINE';$('#accessText').textContent='Сначала войди через операторский пульт — сессия автоматически подхватится здесь.';$('#loginLink').hidden=false;return}try{const who=await invoke('whoami');$('#identity').textContent=`${who.user?.display_name||'DIMA'} · ${who.user?.role||''}`;if(!who.authorized){$('#accessText').textContent='Для «Моего отсека» нужна роль operator или admin.';return}$('#accessPanel').hidden=true;$('#app').hidden=false;await refresh();timer=setInterval(()=>refresh(false),12000)}catch(e){$('#accessText').textContent=`Не удалось открыть отсек: ${e.message}`}}
async function refresh(showError=true){try{snapshot=await invoke('dashboard');renderAll()}catch(e){if(showError)alert(e.message);$('#agentState').textContent='ERROR';$('#agentState').className='agent-offline';$('#agentMeta').textContent=e.message}}
function renderAll(){renderStats();renderAssistant();renderProjects();renderGates()}
function renderStats(){
  const a=(snapshot.agents||[])[0],fresh=a&&ago(a.heartbeat_at)<45;
  const state=fresh?(a.status==='busy'?'BUSY':'ONLINE'):'OFFLINE';
  $('#agentState').textContent=state;$('#agentState').className=fresh?(a.status==='busy'?'agent-busy':'agent-online'):'agent-offline';
  $('#agentMeta').textContent=a?`${a.name} · ${a.version||'version ?'} · heartbeat ${fmt(a.heartbeat_at)}`:'Агент ещё не зарегистрирован';
  const s=snapshot.assistant_state,q=snapshot.assistant_queue||[];
  $('#assistantState').textContent=s?.mode==='autonomous'?'ACTIVE':'WAITING';$('#assistantState').className=s?.mode==='autonomous'?'agent-online':'agent-busy';
  $('#assistantMeta').textContent=s?`event #${s.last_event_id||0} · updated ${fmt(s.updated_at)}`:'Нет состояния';
  const ps=snapshot.projects||[];$('#activeCount').textContent=ps.filter(p=>ACTIVE.has(p.state)).length;$('#readyCount').textContent=ps.filter(p=>p.state==='READY').length;$('#gateCount').textContent=(snapshot.gates||[]).length;
  $('#assistantQueueBadge').textContent=`QUEUE ${q.length}`;
}

function renderAssistant(){
  const s=snapshot.assistant_state||{},q=snapshot.assistant_queue||[],cp=(snapshot.checkpoints||[])[0];
  $('#assistantObjective').textContent=s.current_objective||'—';$('#assistantCheckpoint').textContent=cp?`${fmt(cp.created_at)} · ${cp.metadata?.state||cp.session_key}`:'—';$('#assistantEvent').textContent=`#${s.last_event_id||0}`;
  $('#canonicalDoc').textContent=s[currentDoc]||'Документ ещё не сформирован.';
  const box=$('#assistantQueue');box.innerHTML='';
  if(!q.length){box.innerHTML='<div class="empty">Очередь пуста — диспетчеру сейчас нечего разбирать.</div>';return}
  for(const item of q.slice(0,30)){const row=document.createElement('div');row.className='queue-item';row.innerHTML=`<span class="badge">P${esc(item.priority)}</span><div><b>${esc(item.subject)}</b><small>${esc(item.kind)} · ${fmt(item.created_at)}</small></div><span class="queue-source">${esc(item.source||'')}</span>`;box.append(row)}
}

function visibleProjects(){const ps=snapshot.projects||[];if(currentFilter==='active')return ps.filter(p=>ACTIVE.has(p.state)||['NEW','PLANNED'].includes(p.state));if(currentFilter==='attention')return ps.filter(p=>p.state==='HUMAN_GATE'||p.state==='FAILED');if(currentFilter==='done')return ps.filter(p=>p.state==='READY');return ps}
function renderProjects(){
  const box=$('#projects'),items=visibleProjects();box.innerHTML='';
  if(!items.length){box.innerHTML='<div class="empty">Здесь пока пусто.</div>';return}
  for(const p of items){
    const card=document.createElement('article');card.className='card project-card';
    const idx=progressIndex(p.state),progress=[0,1,2,3,4].map(i=>`<i class="${i<idx?'done':''}"></i>`).join('');
    const artifact=p.artifact_ref?.startsWith('storage:')?'<div class="meta state-ready">Результат загружен в Мой отсек</div>':(p.artifact_ref?'<div class="meta">Результат готовится к загрузке…</div>':'');
    card.innerHTML=`<div class="project-title"><div><h3>${esc(p.name)}</h3><div class="meta">${fmt(p.created_at)} · попытка ${esc(p.attempts)}/${esc(p.max_attempts)}</div></div><span class="badge ${stateClass(p.state)}">${esc(p.state)}</span></div><p class="goal">${esc(p.goal)}</p><div class="progress-line">${progress}</div>${p.last_error?`<div class="meta state-failed">${esc(p.last_error)}</div>`:''}${artifact}<div class="small-actions"></div>`;
    const actions=card.querySelector('.small-actions');
    if(ACTIVE.has(p.state))actions.append(actionButton('Пауза','ghost',()=>queueCommand(p.id,'pause')));
    if(p.state==='PAUSED')actions.append(actionButton('Продолжить','primary',()=>queueCommand(p.id,'resume')));
    if(p.state==='FAILED')actions.append(actionButton('Повторить','primary',()=>queueCommand(p.id,'retry')));
    if(p.state==='READY'&&p.artifact_ref?.startsWith('storage:'))actions.append(actionButton('Скачать','primary',()=>downloadArtifact(p.id)));
    if(!['READY','CANCELED'].includes(p.state))actions.append(actionButton('Отменить','danger',()=>queueCommand(p.id,'cancel')));
    for(const b of actions.children)b.addEventListener('click',e=>e.stopPropagation());card.addEventListener('click',()=>openProject(p.id));box.append(card)
  }
}
async function queueCommand(projectId,command,payload={}){if(command==='cancel'&&!confirm('Отменить проект?'))return;try{await invoke('command',{project_id:projectId,command,payload});await refresh()}catch(e){alert(e.message)}}
async function downloadArtifact(projectId){const tab=window.open('about:blank','_blank');try{const d=await invoke('artifact_url',{project_id:projectId});if(tab)tab.location=d.url;else location.href=d.url}catch(e){if(tab)tab.close();alert(`Не удалось получить файл: ${e.message}`)}}
function renderGates(){
  const panel=$('#gatePanel'),box=$('#gates'),items=snapshot.gates||[];panel.hidden=!items.length;box.innerHTML='';
  for(const g of items){const p=(snapshot.projects||[]).find(x=>x.id===g.project_id);const card=document.createElement('article');card.className='card';card.innerHTML=`<div class="card-head"><div><h3>${esc(p?.name||'Проект')}</h3><div class="meta">${fmt(g.requested_at)} · ${esc(g.gate_type)}</div></div><span class="badge state-human">НУЖЕН ТЫ</span></div><p class="statement">${esc(g.reason)}</p><div class="actions"></div>`;const a=card.querySelector('.actions');a.append(actionButton('Подтвердил — продолжить','primary',async()=>{await invoke('command',{project_id:g.project_id,command:'approve_gate',gate_id:g.id});await refresh()}));box.append(card)}
}

async function openProject(id){
  try{
    const d=await invoke('project',{project_id:id}),p=d.project;currentProject=p;
    $('#detailTitle').textContent=p.name;$('#detailSummary').innerHTML=`<div><small>STATE</small><b class="${stateClass(p.state)}">${esc(p.state)}</b></div><div><small>ATTEMPTS</small><b>${esc(p.attempts)} / ${esc(p.max_attempts)}</b></div><div><small>WORKER</small><b>${esc(p.worker)}</b></div><div><small>UPDATED</small><b>${fmt(p.updated_at)}</b></div>`;
    const dl=$('#downloadArtifact');dl.hidden=!(p.state==='READY'&&p.artifact_ref?.startsWith('storage:'));
    const eb=$('#detailEvents');eb.innerHTML='';
    for(const e of d.events||[]){const row=document.createElement('div');row.className='event';row.innerHTML=`<time>${fmt(e.created_at)}</time><b>${esc(e.event_type)}</b><span>${esc(e.message||JSON.stringify(e.payload||{}))}</span>`;eb.append(row)}
    if(!(d.events||[]).length)eb.innerHTML='<div class="empty">Событий пока нет.</div>';$('#detailPanel').hidden=false;$('#detailPanel').scrollIntoView({behavior:'smooth',block:'start'})
  }catch(e){alert(e.message)}
}

$('#newProjectForm').addEventListener('submit',async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;$('#createStatus').textContent='Ставлю в очередь…';try{const d=await invoke('create_project',{name:$('#projectName').value.trim(),goal:$('#projectGoal').value.trim(),priority:Number($('#projectPriority').value),max_attempts:Number($('#projectAttempts').value)});$('#createStatus').textContent=`Проект создан: ${d.project.state}`;e.target.reset();$('#projectPriority').value='100';$('#projectAttempts').value='4';await refresh()}catch(err){$('#createStatus').textContent=err.message}finally{btn.disabled=false}});
$('#refreshAll').onclick=()=>refresh();$('#closeDetail').onclick=()=>{$('#detailPanel').hidden=true;currentProject=null};$('#downloadArtifact').onclick=()=>currentProject&&downloadArtifact(currentProject.id);
document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentFilter=b.dataset.filter;renderProjects()}));
document.querySelectorAll('.doc-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.doc-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentDoc=b.dataset.doc;renderAssistant()}));
window.addEventListener('beforeunload',()=>{if(timer)clearInterval(timer)});
boot();
