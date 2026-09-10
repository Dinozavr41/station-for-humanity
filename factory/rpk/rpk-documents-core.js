import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const WORKSPACE=new URLSearchParams(location.search).get('w')||'focus-biysk';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let base=null,docs=null;

async function invoke(fn,action,payload={}){
  const {data,error}=await sb.functions.invoke(fn,{body:{action,workspace_slug:WORKSPACE,...payload}});
  if(error){let m=error.message;try{if(error.context){const j=await error.context.json();m=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(m)}
  if(!data?.ok)throw new Error(data?.error||`${fn}_error`);
  return data;
}
const docApi=(action,payload={})=>invoke('rpk-documents',action,payload);
const workspaceApi=(action,payload={})=>invoke('rpk-workspace',action,payload);
const docLabel=v=>({quote:'КП',invoice:'Счёт',contract:'Договор',act:'Акт',work_order:'Производственное задание',other:'Документ'})[v]||v;
const statusLabel=v=>({draft:'Черновик',received:'Получен',archived:'Архив',issued:'Выпущен',sent:'Отправлен',accepted:'Принят',paid:'Оплачен',canceled:'Отменён'})[v]||v;
const threadLabel=v=>({draft:'Черновик',requested:'Запрос создан',sent_to_accountant:'Отправлено бухгалтеру',received:'Получено',sent_to_client:'Отправлено клиенту',paid:'Оплачено',closed:'Закрыто',canceled:'Отменено'})[v]||v;
const money=v=>(Number(v)||0).toLocaleString('ru-RU',{maximumFractionDigits:0})+' ₽';
const bytes=v=>{const n=Number(v)||0;if(!n)return '—';if(n<1024*1024)return Math.max(1,Math.round(n/1024))+' КБ';return (n/1024/1024).toFixed(n<10*1024*1024?1:0)+' МБ'};

function clientName(id){return base?.clients?.find(x=>x.id===id)?.name||'Без клиента'}
function fillClients(){
  if(!$('#documentClient'))return;
  const current=$('#documentClient').value;
  $('#documentClient').innerHTML='<option value="">Не привязывать</option>'+(base?.clients||[]).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if([...$('#documentClient').options].some(o=>o.value===current))$('#documentClient').value=current;
}

function renderDocuments(){
  const list=$('#documentVaultList');if(!list)return;
  const items=docs?.documents||[];
  list.innerHTML=items.length?items.map(d=>`<div class="item"><div><strong>${esc(docLabel(d.document_type))} · ${esc(d.title||d.original_name||d.document_no||'Без названия')}</strong><small>${esc(clientName(d.client_id))}${d.original_name?` · ${esc(d.original_name)}`:''}</small></div><div><small>${esc((d.file_ext||'').toUpperCase()||d.source_kind)}</small><br>${bytes(d.byte_size)}</div><div><b>${esc(statusLabel(d.status))}</b><br><small>${d.indexing_status==='queued'?'ждёт разбора':esc(d.indexing_status||'')}</small></div><div class="item-actions">${d.storage_path?`<button class="mini doc-download" data-id="${d.id}">Скачать</button>`:''}<button class="mini doc-clone" data-id="${d.id}">Новое из этого</button></div></div>`).join(''):'<div class="empty-box">Документный архив пока пуст. Загрузите старые КП, счета или задания — Word, PDF и Excel.</div>';
  document.querySelectorAll('.doc-download').forEach(b=>b.onclick=()=>downloadDocument(b.dataset.id));
  document.querySelectorAll('.doc-clone').forEach(b=>b.onclick=()=>cloneDocument(b.dataset.id));
}

function renderMailboxes(){
  const box=$('#mailboxState');if(!box)return;
  const arr=docs?.mailboxes||[];
  box.innerHTML=arr.length?arr.map(m=>`<div><b>${m.purpose==='company'?'Почта РПК':m.purpose==='accountant'?'Почта бухгалтера':'Почта'}:</b> ${esc(m.email_address)} · ${m.status==='active'?'✅ подключена':'🟡 ожидает подключения'}</div>`).join(''):'Почты пока не зарегистрированы. Можно указать почту РПК и бухгалтера; OAuth/IMAP подключим отдельным защищённым шагом без хранения пароля в кабинете.';
}

function renderAccounting(){
  const list=$('#accountingList');if(!list)return;
  const items=docs?.accounting_threads||[];
  const statuses=['requested','sent_to_accountant','received','sent_to_client','paid','closed','canceled'];
  list.innerHTML=items.length?items.map(t=>`<div class="item"><div><strong>БХ-${String(t.thread_no).padStart(5,'0')} · ${esc(t.subject)}</strong><small>${esc(clientName(t.client_id))} · ${esc(t.preferred_channel)}</small></div><div>${esc(t.accountant_address||'адрес не указан')}</div><div><select class="stage-select accounting-status" data-id="${t.id}">${statuses.map(s=>`<option value="${s}" ${s===t.status?'selected':''}>${threadLabel(s)}</option>`).join('')}</select></div><div class="item-actions"><button class="mini accounting-log" data-id="${t.id}">+ Контакт</button></div></div>`).join(''):'<div class="empty-box">Запросов бухгалтеру пока нет. Создайте первый: счёт, акт, договор или сверка.</div>';
  document.querySelectorAll('.accounting-status').forEach(x=>x.onchange=async()=>{try{await docApi('update_accounting_request',{thread_id:x.dataset.id,status:x.value});await loadDocs()}catch(e){alert(e.message)}});
  document.querySelectorAll('.accounting-log').forEach(x=>x.onclick=()=>logCommunication(x.dataset.id));
}

async function loadDocs(){
  const {data:{session}}=await sb.auth.getSession();if(!session)return;
  try{
    [base,docs]=await Promise.all([workspaceApi('snapshot'),docApi('snapshot')]);
    fillClients();renderDocuments();renderMailboxes();renderAccounting();
  }catch(e){console.error('RPK documents',e);const list=$('#documentVaultList');if(list)list.innerHTML=`<div class="empty-box danger">Документы не загрузились: ${esc(e.message)}</div>`}
}

async function uploadDocuments(){
  const files=[...($('#documentFiles')?.files||[])];if(!files.length)return alert('Выберите Word, PDF или Excel файлы.');
  const clientId=$('#documentClient')?.value||null,type=$('#documentType')?.value||'other';let done=0;
  $('#documentUploadStatus').textContent=`Загрузка 0 / ${files.length}`;
  for(const f of files){
    try{
      const up=await docApi('create_upload',{original_name:f.name,byte_size:f.size,mime_type:f.type||'application/octet-stream'});
      const {error}=await sb.storage.from('rpk-documents').uploadToSignedUrl(up.path,up.token,f,{contentType:f.type||'application/octet-stream'});if(error)throw error;
      await docApi('register_upload',{storage_path:up.path,original_name:f.name,mime_type:f.type||'application/octet-stream',byte_size:f.size,client_id:clientId,document_type:type,title:f.name});
      done++;$('#documentUploadStatus').textContent=`Загружено ${done} / ${files.length}: ${f.name}`;
    }catch(e){$('#documentUploadStatus').textContent+=`\nОшибка ${f.name}: ${e.message}`}
  }
  $('#documentFiles').value='';await loadDocs();
}

async function downloadDocument(id){
  try{const x=await docApi('download',{document_id:id});window.open(x.url,'_blank','noopener,noreferrer')}catch(e){alert(e.message)}
}

async function cloneDocument(id){
  const source=docs?.documents?.find(x=>x.id===id);if(!source)return;
  const instruction=prompt('Что изменить в новом документе?\nНапример: взять это КП, заменить клиента, позиции, количество и цены; структуру оставить.','');if(instruction===null)return;
  const title=prompt('Название нового документа',`Новое ${docLabel(source.document_type)} на основе старого`)||`Новое ${docLabel(source.document_type)}`;
  try{await docApi('clone_document',{source_document_id:id,client_id:source.client_id||null,document_type:source.document_type,title,instruction});alert('Черновик создан и связан со старым документом. Следующим слоем подключим разбор Word/Excel/PDF и автоматическую сборку нового файла.');await loadDocs()}catch(e){alert(e.message)}
}

async function requestAccounting(){
  const types={1:'invoice',2:'act',3:'contract',4:'reconciliation',5:'payment',6:'other'};
  const raw=prompt('Что запросить у бухгалтера?\n1 — счёт\n2 — акт\n3 — договор\n4 — сверка\n5 — подтверждение оплаты\n6 — другое','1');if(raw===null)return;
  const requestType=types[raw]||'invoice',subject=prompt('Коротко: что нужно?',requestType==='invoice'?'Выставить счёт клиенту':'Подготовить документ');if(!subject)return;
  const channelRaw=prompt('Канал\n1 — email\n2 — MAX\n3 — телефон\n4 — вручную','1');if(channelRaw===null)return;
  const channel=({1:'email',2:'max',3:'phone',4:'manual'})[channelRaw]||'email';
  const accountant=channel==='email'?(prompt('Email бухгалтера (можно оставить пустым)','')||''):'';
  const notes=prompt('Комментарий / что именно выставить','')||'';
  const clientId=$('#documentClient')?.value||null;
  try{await docApi('create_accounting_request',{request_type:requestType,subject,preferred_channel:channel,accountant_address:accountant,notes,client_id:clientId});await loadDocs()}catch(e){alert(e.message)}
}

async function logCommunication(threadId){
  const c=prompt('Как связались?\n1 — email\n2 — MAX\n3 — звонок\n4 — вручную','1');if(c===null)return;const channel=({1:'email',2:'max',3:'phone',4:'manual'})[c]||'manual';
  const d=prompt('Направление\n1 — мы отправили\n2 — получили от бухгалтера','1');if(d===null)return;const direction=d==='2'?'in':'out';
  const text=prompt('Что произошло?\nНапример: запрос на счёт отправлен; счёт получен на почту; созвонились — обещали до 15:00','');if(!text)return;
  try{await docApi('log_communication',{thread_id:threadId,channel,direction,actor_side:direction==='in'?'accountant':'rpk',message_excerpt:text});await loadDocs()}catch(e){alert(e.message)}
}

async function registerMailbox(){
  const p=prompt('Какая почта?\n1 — почта РПК\n2 — почта бухгалтера','1');if(p===null)return;const purpose=p==='2'?'accountant':'company';
  const email=prompt(purpose==='accountant'?'Email бухгалтера':'Email РПК','');if(!email)return;
  const pr=prompt('Провайдер\n1 — Gmail/Google\n2 — обычная почта (IMAP)\n3 — другой','2');if(pr===null)return;const provider=({1:'gmail',2:'imap',3:'other'})[pr]||'imap';
  try{const x=await docApi('register_mailbox',{purpose,provider,email_address:email});alert(`${x.mailbox.email_address} зарегистрирована. Пароль мы здесь не сохраняем; подключение OAuth/IMAP будет отдельным защищённым шагом.`);await loadDocs()}catch(e){alert(e.message)}
}

$('#uploadDocuments')?.addEventListener('click',uploadDocuments);
$('#requestAccounting')?.addEventListener('click',requestAccounting);
$('#registerMailbox')?.addEventListener('click',registerMailbox);
$('#reload')?.addEventListener('click',()=>setTimeout(loadDocs,150));
sb.auth.onAuthStateChange(()=>setTimeout(loadDocs,400));
setTimeout(loadDocs,500);
