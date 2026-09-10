import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const qs=new URLSearchParams(location.search),WORKSPACE=qs.get('w')||'focus-biysk';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let snap=null,os=null,artworks=[];

async function invoke(fn,action,payload={}){
  const {data,error}=await sb.functions.invoke(fn,{body:{action,workspace_slug:WORKSPACE,...payload}});
  if(error){let m=error.message;try{if(error.context){const j=await error.context.json();m=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(m)}
  if(!data?.ok)throw new Error(data?.error||`${fn}_error`);
  return data;
}
const api=(action,payload={})=>invoke('rpk-workspace',action,payload);
const osApi=(action,payload={})=>invoke('rpk-os',action,payload);
function money(v){return (Number(v)||0).toLocaleString('ru-RU',{maximumFractionDigits:0})+' ₽'}
function statusLabel(v){return ({brief_incomplete:'ТЗ неполное',brief_ready:'ТЗ готово',blueprint_ready:'Blueprint готов',drafting:'Создаём макет',draft_ready:'Черновик готов',client_review:'На согласовании',revision:'Правки',approved:'Утверждён',preflight:'Проверка печати',print_ready:'ГОТОВ В ПЕЧАТЬ',blocked:'ЗАБЛОКИРОВАН',canceled:'Отменён'})[v]||v}
function stageLabel(v){return ({lead:'Лид',qualified:'Уточняем',quote:'КП / расчёт',approved:'Согласовано',production:'В производстве',ready:'Готово',won:'Оплачено / завершено',lost:'Не состоялось'})[v]||v}
function docLabel(v){return ({quote:'КП',invoice:'Счёт',contract:'Договор',act:'Акт',work_order:'Задание',other:'Документ'})[v]||v}
function dateTime(v){return v?new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}
function localDateTimeToIso(v){if(!v)return null;const x=new Date(v.replace(' ','T'));return Number.isNaN(x.getTime())?null:x.toISOString()}
function enabledModule(code){return !!os?.dashboard?.modules?.find(x=>x.code===code)?.enabled}

function renderBase(){
  if(!snap)return;
  $('#workspaceName').textContent=snap.workspace.name;
  $('#workspaceMeta').textContent=[snap.workspace.legal_name,snap.workspace.city,`доступ: ${snap.access_role}`].filter(Boolean).join(' · ');
  const verified=snap.print_profiles.find(x=>x.active&&x.verified_at);
  $('#profileBadge').className='badge '+(verified?'ok':'warn');
  $('#profileBadge').textContent=verified?'ПРОФИЛЬ ПЕЧАТИ VERIFIED':'ПРОФИЛЬ ПЕЧАТИ НЕ ПОДТВЕРЖДЁН';
  $('#clientSummaryCount').textContent=`(${snap.clients.length})`;
  $('#clientList').innerHTML=snap.clients.length?snap.clients.map(c=>`<div class="item"><div><strong>${esc(c.name)}</strong><small>${esc(c.legal_name||'')}</small></div><div>${esc(c.phone||c.email||'контакт не указан')}</div><div><small>Архив</small><br>${esc(c.archive_stats?.artworks||0)} макетов</div><div class="item-actions"><button class="mini client-art" data-id="${c.id}">Макеты</button></div></div>`).join(''):'<p class="muted">Клиентов пока нет. Добавьте первого или загрузите базу.</p>';
  $('#uploadClient').innerHTML='<option value="">Не определён — разберём позже</option>'+snap.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#jobList').innerHTML=snap.jobs.length?snap.jobs.map(j=>`<div class="item"><div><strong>DFD-${String(j.job_no).padStart(6,'0')}</strong><small>${esc(j.business_name||'Без клиента')}</small></div><div>${j.workflow_mode==='remake'?'♻️ ПЕРЕДЕЛКА':'➕ '+esc(j.workflow_mode)}</div><div>${esc(statusLabel(j.status))}</div><div><small>${new Date(j.updated_at).toLocaleString('ru-RU')}</small></div></div>`).join(''):'<p class="muted">Очередь пуста.</p>';
  renderProfile(verified);bindClientButtons();
}
function renderProfile(p){
  if(!p){$('#verifiedProfile').innerHTML='<div class="profile-card"><b>Печатный профиль пока не согласован.</b><p class="muted">Station не даст выпустить PRINT_READY с выдуманными DPI, цветом или вылетами.</p></div>';return}
  $('#verifiedProfile').innerHTML=`<div class="profile-card"><b>✅ ${esc(p.name)}</b><div class="profile-grid"><div><small>Принтер</small><br>${esc(p.printer_model||'—')}</div><div><small>RIP</small><br>${esc(p.rip_software||'—')}</div><div><small>Масштаб</small><br>${esc(p.artwork_scale)}</div><div><small>DPI</small><br>${esc(p.target_dpi)}</div><div><small>Цвет</small><br>${esc(p.color_mode||'—')}</div><div><small>Профиль</small><br>${esc(p.color_profile||'—')}</div><div><small>Вылет</small><br>${esc(p.bleed_mm)} мм</div><div><small>Safe zone</small><br>${esc(p.safe_zone_mm)} мм</div><div><small>Форматы</small><br>${esc((p.allowed_formats||[]).join(', '))}</div><div><small>Материал</small><br>${esc(p.material_name||'—')}</div></div><p class="muted">Согласовано печатником и менеджером. Версия ${esc(p.agreement_version)}.</p></div>`;
}
function renderOS(){
  const d=os?.dashboard;if(!d)return;const m=d.metrics||{};
  $('#osDeals').textContent=m.deals_active||0;$('#osPipeline').textContent=`${money(m.pipeline_amount)} в работе`;
  $('#osNet').textContent=money(m.cash_net_month);$('#osCashFlow').textContent=`${money(m.cash_in_month)} приход · ${money(m.cash_out_month)} расход`;
  $('#osOverdue').textContent=m.overdue_actions||0;$('#osDesignJobs').textContent=m.design_jobs_active||0;$('#osArchiveInfo').textContent=`архив: ${m.archive||0}${m.archive_unindexed?` · не разобрано ${m.archive_unindexed}`:''}`;
  $('#moneyIn').textContent=money(m.cash_in_month);$('#moneyOut').textContent=money(m.cash_out_month);$('#moneyNet').textContent=money(m.cash_net_month);
  $('#procurementSummary').innerHTML=`Основных поставщиков: <b>${m.suppliers||0}</b>. ${m.suppliers?'Можно переходить к загрузке закупочных прайсов и сравнению себестоимости.':'Добавьте хотя бы 2–3 основных поставщика — дальше Station сможет сравнивать цены.'}`;
  renderToday(d);renderRecommendations(d.recommendations||[]);renderDeals(d.deals||[]);renderCash(d.cash_recent||[]);renderDocuments(d.documents_recent||[]);renderModules(d.modules||[]);
}
function renderToday(d){
  const m=d.metrics||{},items=[];const now=Date.now();
  (d.deals||[]).filter(x=>!['won','lost'].includes(x.stage)&&x.next_action_at&&new Date(x.next_action_at).getTime()<=now).slice(0,5).forEach(x=>items.push({title:`${x.client_name||'Клиент'} · ${x.title}`,text:`${x.next_action||'Нужен следующий шаг'} · ${dateTime(x.next_action_at)}`}));
  if(m.unpaid_invoices)items.push({title:`Неоплаченные счета: ${m.unpaid_invoices}`,text:'Проверьте оплату или свяжитесь с клиентом.'});
  if(!m.print_profile_verified)items.push({title:'Профиль печати 3×6 не подтверждён',text:'До согласования печатника и менеджера PRINT_READY заблокирован.'});
  if(m.archive_unindexed)items.push({title:`Архив: не разобрано ${m.archive_unindexed}`,text:'Файлы сохранены, но ещё не готовы для автоматических переделок.'});
  $('#todayList').innerHTML=items.length?items.map(x=>`<div class="attention"><strong>${esc(x.title)}</strong><span>${esc(x.text)}</span></div>`).join(''):'<div class="attention"><strong>На сейчас критичных дел нет</strong><span>Новые задачи появятся здесь из сделок, документов, производства и склада.</span></div>';
}
function renderRecommendations(items){
  $('#recommendationList').innerHTML=items.length?items.slice(0,7).map(r=>`<div class="recommendation ${esc(r.priority)}"><strong>${esc(r.title)}</strong><p>${esc(r.message)}</p><button class="rec-action" data-target="${esc(r.action||'today')}">Открыть</button></div>`).join(''):'<div class="recommendation"><strong>Пока всё спокойно</strong><p>Station будет предлагать улучшения только когда увидит для них фактическую причину.</p></div>';
  document.querySelectorAll('.rec-action').forEach(b=>b.onclick=()=>jump(b.dataset.target));
}
function renderDeals(items){
  const stages=['lead','qualified','quote','approved','production','ready','won','lost'];
  $('#dealList').innerHTML=items.length?items.map(d=>{const overdue=d.next_action_at&&!['won','lost'].includes(d.stage)&&new Date(d.next_action_at)<new Date();return `<div class="deal-card"><div class="deal-title"><strong>RPK-${String(d.deal_no).padStart(5,'0')} · ${esc(d.title)}</strong><small>${esc(d.client_name||'Без клиента')}</small></div><div><select class="stage-select deal-stage" data-id="${d.id}">${stages.map(s=>`<option value="${s}" ${s===d.stage?'selected':''}>${stageLabel(s)}</option>`).join('')}</select></div><div class="deal-money"><strong>${money(d.amount)}</strong><small>маржа: ${d.margin_estimate==null?'—':money(d.margin_estimate)}</small></div><div class="deal-next ${overdue?'overdue':''}"><small>Следующее действие</small><br>${esc(d.next_action||'не задано')}<br><small>${dateTime(d.next_action_at)}</small></div><div class="item-actions deal-actions"><button class="mini deal-next-btn" data-id="${d.id}">След. шаг</button><button class="mini deal-doc" data-id="${d.id}" data-type="quote">КП</button><button class="mini deal-doc" data-id="${d.id}" data-type="invoice">Счёт</button></div></div>`}).join(''):'<div class="empty-box">Сделок пока нет. Добавьте текущий заказ — достаточно названия, клиента и суммы.</div>';
  document.querySelectorAll('.deal-stage').forEach(x=>x.onchange=async()=>{try{await osApi('update_deal',{deal_id:x.dataset.id,stage:x.value});await load()}catch(e){alert(e.message)}});
  document.querySelectorAll('.deal-next-btn').forEach(x=>x.onclick=()=>editNextAction(x.dataset.id));
  document.querySelectorAll('.deal-doc').forEach(x=>x.onclick=()=>createDoc(x.dataset.id,x.dataset.type));
}
function renderCash(items){
  $('#cashList').innerHTML=items.length?items.map(x=>`<div class="item"><div><strong class="${x.direction==='in'?'cash-in':'cash-out'}">${x.direction==='in'?'+':'−'} ${money(x.amount)}</strong><small>${esc(x.category||'без категории')}</small></div><div>${esc(x.counterparty||'—')}</div><div>${esc(x.note||'')}</div><div><small>${new Date(x.occurred_on+'T00:00:00').toLocaleDateString('ru-RU')}</small></div></div>`).join(''):'<div class="empty-box">Движений пока нет. Начните с сегодняшнего реального прихода или расхода.</div>';
}
function renderDocuments(items){
  $('#documentList').innerHTML=items.length?items.map(x=>`<div class="item"><div><strong>${docLabel(x.document_type)} ${esc(x.document_no||'черновик')}</strong><small>${esc(x.client_name||'')}</small></div><div>${money(x.total)}</div><div>${esc(x.status)}</div><div><small>${new Date(x.created_at).toLocaleDateString('ru-RU')}</small></div></div>`).join(''):'<div class="empty-box">Документов пока нет. Из карточки сделки можно создать черновик КП или счёта.</div>';
}
function renderModules(items){
  const toggleable=new Set(['inventory','leadbot']);const owner=['owner','platform_admin'].includes(os?.access_role);
  $('#moduleList').innerHTML=items.map(m=>`<div class="module-card ${m.enabled?'':'off'}"><div class="module-top"><strong>${esc(m.name)}</strong>${toggleable.has(m.code)?`<button class="module-switch ${m.enabled?'on':''}" data-code="${m.code}" data-enabled="${m.enabled}" ${owner?'':'disabled'}>${m.enabled?'ВКЛ':'ВКЛЮЧИТЬ'}</button>`:`<span class="badge ${m.enabled?'ok':'warn'}">${m.enabled?'ВКЛ':'OFF'}</span>`}</div><p>${esc(m.description||'')}</p></div>`).join('');
  document.querySelectorAll('.module-switch').forEach(b=>b.onclick=async()=>{const enabled=b.dataset.enabled!=='true';try{await osApi('toggle_module',{module_code:b.dataset.code,enabled});await load()}catch(e){alert(e.message)}});
  document.querySelectorAll('#moduleNav button').forEach(b=>{const code=({crm:'crm',archive:'archive',queue:'design_factory',documents:'documents',money:'cashflow',procurement:'suppliers'})[b.dataset.jump];if(code)b.hidden=!enabledModule(code)});
}
function bindClientButtons(){document.querySelectorAll('.client-art').forEach(b=>b.onclick=async()=>{$('#uploadClient').value=b.dataset.id;await loadArtworks(b.dataset.id);jump('archive')})}
function jump(id){const el=document.getElementById(id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('#moduleNav button').forEach(x=>x.classList.toggle('active',x.dataset.jump===id))}
async function load(){
  const [base,osx]=await Promise.all([api('snapshot'),osApi('snapshot')]);snap=base;os=osx;renderBase();renderOS();await loadArtworks('');
}
async function loadArtworks(clientId=''){
  const x=await api('list_artworks',{client_id:clientId,limit:150});artworks=x.artworks||[];
  $('#artworkList').innerHTML=artworks.length?artworks.map(a=>`<div class="item"><div><strong>${esc(a.original_name)}</strong><small>${esc((a.file_ext||'').toUpperCase())} · ${a.width_mm&&a.height_mm?`${a.width_mm}×${a.height_mm} мм`:'размер ещё не разобран'}</small></div><div>${a.client_match_state==='confirmed'?'✅ клиент определён':'⚠️ клиент не определён'}</div><div>${esc(a.status)}</div><div class="item-actions"><button class="mini remake" data-id="${a.id}" data-client="${a.client_id||''}">♻️ Переделать</button></div></div>`).join(''):'<p class="muted">В архиве пока нет макетов.</p>';
  document.querySelectorAll('.remake').forEach(b=>b.onclick=()=>createRemake(b.dataset.id,b.dataset.client));
}
async function createRemake(artworkId,clientId){if(!clientId){alert('Сначала привяжите старый макет к клиенту.');return}const text=prompt('Что изменить в старом макете?\nНапример: цена 1990 вместо 1490; телефон новый; стиль и расположение оставить.');if(!text)return;const x=await api('create_remake',{client_id:clientId,artwork_id:artworkId,changes:{instruction:text,requested_at:new Date().toISOString()}});alert(`Переделка создана: ${x.job_id}`);await load();jump('queue')}

async function addClient(){const name=prompt('Название клиента');if(!name)return;const phone=prompt('Телефон клиента (можно оставить пустым)')||'';try{await api('create_client',{name,phone});await load();jump('crm')}catch(e){alert(e.message)}}
function chooseClient(){if(!snap?.clients?.length)return null;const lines=snap.clients.map((c,i)=>`${i+1}. ${c.name}`).join('\n');const raw=prompt(`Выберите клиента номером (0 — без клиента):\n${lines}`,'1');if(raw===null)return undefined;const n=Number(raw);if(!n)return null;return snap.clients[n-1]?.id||null}
async function addDeal(){const clientId=chooseClient();if(clientId===undefined)return;const title=prompt('Что за заказ?\nНапример: Баннер 3×6 — акция сентябрь');if(!title)return;const amountRaw=prompt('Сумма продажи, ₽ (можно пусто)','');const costRaw=prompt('Ожидаемая себестоимость, ₽ (можно пусто)','');const next=prompt('Что сделать дальше?\nНапример: отправить макет на согласование','')||'';const when=next?(prompt('Когда? Формат YYYY-MM-DD HH:MM (можно пусто)','')||''):'';try{await osApi('create_deal',{client_id:clientId,title,amount:amountRaw===''?null:Number(amountRaw),cost_estimate:costRaw===''?null:Number(costRaw),next_action:next,next_action_at:localDateTimeToIso(when)});await load();jump('crm')}catch(e){alert(e.message)}}
async function editNextAction(dealId){const next=prompt('Следующее действие','');if(next===null)return;const when=next?(prompt('Когда? YYYY-MM-DD HH:MM (можно пусто)','')||''):'';try{await osApi('update_deal',{deal_id:dealId,next_action:next,next_action_at:localDateTimeToIso(when)});await load()}catch(e){alert(e.message)}}
async function addCash(){const kind=prompt('1 — приход\n2 — расход','1');if(kind===null)return;const direction=kind==='2'?'out':'in';const amount=Number(prompt('Сумма, ₽',''));if(!amount||amount<=0)return alert('Нужна положительная сумма.');const category=prompt('Категория\nНапример: оплата клиента / материал / аренда / зарплата','')||'';const counterparty=prompt('Клиент / поставщик (можно пусто)','')||'';const note=prompt('Комментарий (можно пусто)','')||'';try{await osApi('add_cash_entry',{direction,amount,category,counterparty,note});await load();jump('money')}catch(e){alert(e.message)}}
async function createDoc(dealId,type){try{const x=await osApi('create_document_draft',{deal_id:dealId,document_type:type});alert(`${type==='invoice'?'Счёт':'КП'} создан как черновик. Генератор готового файла подключим отдельным безопасным шагом.`);await load();jump('documents')}catch(e){alert(e.message)}}
async function addSupplier(){const name=prompt('Название поставщика');if(!name)return;const phone=prompt('Телефон (можно пусто)','')||'';const notes=prompt('Что у него покупаете / комментарий','')||'';try{await osApi('create_supplier',{name,phone,notes});await load();jump('procurement')}catch(e){alert(e.message)}}

async function ensureQuestionnaire(){const x=await api('ensure_printer_questionnaire');fillQuestionnaire(x.questionnaire);$('#printerForm').hidden=false;jump('printer')}
function fillQuestionnaire(q){$('#questionnaireId').value=q.id;$('#printerModel').value=q.printer_model||'';$('#ripSoftware').value=q.rip_software||'';$('#ripVersion').value=q.rip_version||'';$('#materialName').value=q.material_name||'';$('#artworkScale').value=q.artwork_scale??'';$('#targetDpi').value=q.target_dpi??'';$('#colorMode').value=q.color_mode||'';$('#colorProfile').value=q.color_profile||'';$('#bleedMm').value=q.bleed_mm??'';$('#safeZoneMm').value=q.safe_zone_mm??'';$('#maxFileMb').value=q.max_file_mb??'';$('#allowedFormats').value=(q.allowed_formats||[]).join(', ');$('#fileNamingRule').value=q.file_naming_rule||'';$('#fontsCurves').checked=q.convert_fonts_to_curves===true;$('#rasterize').checked=q.rasterize_transparency===true;$('#otherRequirements').value=q.other_requirements||'';$('#printerStatus').textContent=`Статус: ${q.status}\nПечатник: ${q.printer_confirmed_at?'подтвердил':'ожидается'} · Менеджер: ${q.manager_confirmed_at?'подтвердил':'ожидается'}`}
function questionnairePayload(submit=false){return{questionnaire_id:$('#questionnaireId').value,printer_model:$('#printerModel').value,rip_software:$('#ripSoftware').value,rip_version:$('#ripVersion').value,material_name:$('#materialName').value,artwork_scale:$('#artworkScale').value===''?null:Number($('#artworkScale').value),target_dpi:$('#targetDpi').value===''?null:Number($('#targetDpi').value),color_mode:$('#colorMode').value,color_profile:$('#colorProfile').value,bleed_mm:$('#bleedMm').value===''?null:Number($('#bleedMm').value),safe_zone_mm:$('#safeZoneMm').value===''?null:Number($('#safeZoneMm').value),max_file_mb:$('#maxFileMb').value===''?null:Number($('#maxFileMb').value),allowed_formats:$('#allowedFormats').value.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean),file_naming_rule:$('#fileNamingRule').value,convert_fonts_to_curves:$('#fontsCurves').checked,rasterize_transparency:$('#rasterize').checked,other_requirements:$('#otherRequirements').value,submit}}
async function saveQ(submit=false){const x=await api('save_printer_questionnaire',questionnairePayload(submit));fillQuestionnaire(x.questionnaire);$('#printerStatus').textContent+=`\nValidation: ${x.validation?.valid?'OK':'НЕ ГОТОВО'}${x.validation?.errors?.length?'\nНужно заполнить: '+x.validation.errors.join(', '):''}${x.validation?.warnings?.length?'\nПредупреждения: '+x.validation.warnings.join(', '):''}`;await load()}
async function confirmParty(party){const id=$('#questionnaireId').value;if(!id)return alert('Сначала откройте анкету.');const x=await api('confirm_printer_profile',{questionnaire_id:id,party});alert(x.generated_print_profile_id?'✅ Профиль печати подтверждён обеими сторонами и опубликован.':`Подтверждение ${party==='printer'?'печатника':'менеджера'} сохранено. Ждём вторую сторону.`);await load();const q=snap.printer_questionnaires.find(q=>q.id===id);if(q){fillQuestionnaire(q);$('#printerForm').hidden=false}}
async function uploadArchive(){const files=[...$('#archiveFiles').files];if(!files.length)return alert('Выберите файлы.');const clientId=$('#uploadClient').value||null;let batchId=null,done=0;$('#uploadStatus').textContent=`Загрузка 0 / ${files.length}`;for(const f of files){try{const up=await api('create_archive_upload',{batch_id:batchId,original_name:f.name,byte_size:f.size,mime_type:f.type||'application/octet-stream',source_kind:'files'});batchId=up.batch_id;const {error}=await sb.storage.from('rpk-archive').uploadToSignedUrl(up.path,up.token,f,{contentType:f.type||'application/octet-stream'});if(error)throw error;await api('register_archive_file',{batch_id:batchId,storage_path:up.path,original_name:f.name,mime_type:f.type||'application/octet-stream',byte_size:f.size,client_id:clientId});done++;$('#uploadStatus').textContent=`Загружено ${done} / ${files.length}: ${f.name}`}catch(e){$('#uploadStatus').textContent+=`\nОшибка ${f.name}: ${e.message}`}}await load();$('#archiveFiles').value=''}

$('#authForm').onsubmit=async e=>{e.preventDefault();$('#authMsg').textContent='Вход…';const {error}=await sb.auth.signInWithPassword({email:$('#email').value,password:$('#password').value});$('#authMsg').textContent=error?error.message:'';if(!error)await boot()};
$('#signOut').onclick=async()=>{await sb.auth.signOut();location.reload()};$('#reload').onclick=load;$('#loadArtworks').onclick=()=>loadArtworks($('#uploadClient').value||'');$('#uploadArchive').onclick=uploadArchive;$('#ensureQuestionnaire').onclick=ensureQuestionnaire;$('#saveQuestionnaire').onclick=()=>saveQ(false);$('#submitQuestionnaire').onclick=()=>saveQ(true);$('#confirmPrinter').onclick=()=>confirmParty('printer');$('#confirmManager').onclick=()=>confirmParty('manager');
$('#addClient').onclick=addClient;$('#quickClient').onclick=addClient;$('#addDeal').onclick=addDeal;$('#quickDeal').onclick=addDeal;$('#addCash').onclick=addCash;$('#quickCash').onclick=addCash;$('#addSupplier').onclick=addSupplier;
document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jump(b.dataset.jump));

async function boot(){const {data:{session}}=await sb.auth.getSession();if(!session){$('#authPanel').hidden=false;$('#workspace').hidden=true;return}$('#authPanel').hidden=true;$('#workspace').hidden=false;$('#signOut').hidden=false;$('#identity').textContent=session.user.email||'ONLINE';try{await load()}catch(e){console.error(e);alert(`Нет доступа к кабинету: ${e.message}`);$('#workspace').hidden=true;$('#authPanel').hidden=false}}
sb.auth.onAuthStateChange(()=>setTimeout(boot,200));boot();