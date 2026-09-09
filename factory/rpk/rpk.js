import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const qs=new URLSearchParams(location.search),WORKSPACE=qs.get('w')||'focus-biysk';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let snap=null,artworks=[];

async function api(action,payload={}){
  const {data,error}=await sb.functions.invoke('rpk-workspace',{body:{action,workspace_slug:WORKSPACE,...payload}});
  if(error){let m=error.message;try{if(error.context){const j=await error.context.json();m=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(m)}
  if(!data?.ok)throw new Error(data?.error||'rpk_workspace_error');
  return data;
}
function money(v){return v==null?'—':Number(v).toLocaleString('ru-RU')+' ₽'}
function statusLabel(v){return ({brief_incomplete:'ТЗ неполное',brief_ready:'ТЗ готово',blueprint_ready:'Blueprint готов',drafting:'Создаём макет',draft_ready:'Черновик готов',client_review:'На согласовании',revision:'Правки',approved:'Утверждён',preflight:'Проверка печати',print_ready:'ГОТОВ В ПЕЧАТЬ',blocked:'ЗАБЛОКИРОВАН',canceled:'Отменён'})[v]||v}

function render(){
  if(!snap)return;
  $('#workspaceName').textContent=snap.workspace.name;
  $('#workspaceMeta').textContent=[snap.workspace.legal_name,snap.workspace.city,`доступ: ${snap.access_role}`].filter(Boolean).join(' · ');
  $('#statClients').textContent=snap.clients.length;
  $('#statArchive').textContent=snap.archive.total;
  $('#statJobs').textContent=snap.jobs.filter(x=>!['print_ready','canceled'].includes(x.status)).length;
  const verified=snap.print_profiles.find(x=>x.active&&x.verified_at);
  $('#statProfile').textContent=verified?'VERIFIED':'WAITING';
  $('#profileBadge').className='badge '+(verified?'ok':'warn');
  $('#profileBadge').textContent=verified?'ПРОФИЛЬ ПЕЧАТИ VERIFIED':'ПРОФИЛЬ ПЕЧАТИ НЕ ПОДТВЕРЖДЁН';

  $('#clientList').innerHTML=snap.clients.length?snap.clients.map(c=>`<div class="item"><div><strong>${esc(c.name)}</strong><small>${esc(c.legal_name||'')}</small></div><div>${esc(c.phone||c.email||'контакт не указан')}</div><div><small>Архив</small><br>${esc(c.archive_stats?.artworks||0)} макетов</div><div class="item-actions"><button class="mini client-art" data-id="${c.id}">Макеты</button></div></div>`).join(''):'<p class="muted">Клиентов пока нет. Добавьте первого или загрузите архив и разложите его позже.</p>';
  $('#uploadClient').innerHTML='<option value="">Не определён — разберём позже</option>'+snap.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');

  $('#jobList').innerHTML=snap.jobs.length?snap.jobs.map(j=>`<div class="item"><div><strong>DFD-${String(j.job_no).padStart(6,'0')}</strong><small>${esc(j.business_name||'Без клиента')}</small></div><div>${j.workflow_mode==='remake'?'♻️ ПЕРЕДЕЛКА':'➕ '+esc(j.workflow_mode)}</div><div>${esc(statusLabel(j.status))}</div><div><small>${new Date(j.updated_at).toLocaleString('ru-RU')}</small></div></div>`).join(''):'<p class="muted">Очередь пуста.</p>';

  renderProfile(verified);
  bindClientButtons();
}
function renderProfile(p){
  if(!p){$('#verifiedProfile').innerHTML='<div class="profile-card"><b>Печатный профиль пока не согласован.</b><p class="muted">Это нормально для первого запуска: Station не даст случайно выпустить PRINT_READY с выдуманными DPI/вылетами.</p></div>';return}
  $('#verifiedProfile').innerHTML=`<div class="profile-card"><b>✅ ${esc(p.name)}</b><div class="profile-grid"><div><small>Принтер</small><br>${esc(p.printer_model||'—')}</div><div><small>RIP</small><br>${esc(p.rip_software||'—')}</div><div><small>Масштаб</small><br>${esc(p.artwork_scale)}</div><div><small>DPI</small><br>${esc(p.target_dpi)}</div><div><small>Цвет</small><br>${esc(p.color_mode||'—')}</div><div><small>Профиль</small><br>${esc(p.color_profile||'—')}</div><div><small>Вылет</small><br>${esc(p.bleed_mm)} мм</div><div><small>Safe zone</small><br>${esc(p.safe_zone_mm)} мм</div><div><small>Форматы</small><br>${esc((p.allowed_formats||[]).join(', '))}</div><div><small>Материал</small><br>${esc(p.material_name||'—')}</div></div><p class="muted">Согласовано печатником и менеджером. Версия ${esc(p.agreement_version)}.</p></div>`;
}
function bindClientButtons(){document.querySelectorAll('.client-art').forEach(b=>b.onclick=async()=>{$('#uploadClient').value=b.dataset.id;await loadArtworks(b.dataset.id);location.hash='archive'})}
async function load(){snap=await api('snapshot');render();await loadArtworks('')}
async function loadArtworks(clientId=''){
  const x=await api('list_artworks',{client_id:clientId,limit:150});artworks=x.artworks||[];
  $('#artworkList').innerHTML=artworks.length?artworks.map(a=>`<div class="item"><div><strong>${esc(a.original_name)}</strong><small>${esc((a.file_ext||'').toUpperCase())} · ${a.width_mm&&a.height_mm?`${a.width_mm}×${a.height_mm} мм`:'размер ещё не разобран'}</small></div><div>${a.client_match_state==='confirmed'?'✅ клиент определён':'⚠️ клиент не определён'}</div><div>${esc(a.status)}</div><div class="item-actions"><button class="mini remake" data-id="${a.id}" data-client="${a.client_id||''}">♻️ Переделать</button></div></div>`).join(''):'<p class="muted">В архиве пока нет макетов.</p>';
  document.querySelectorAll('.remake').forEach(b=>b.onclick=()=>createRemake(b.dataset.id,b.dataset.client));
}
async function createRemake(artworkId,clientId){
  if(!clientId){alert('Сначала привяжите старый макет к клиенту. Для пилота выберите клиента при загрузке.');return}
  const text=prompt('Что изменить в старом макете?\nНапример: цена 1990 вместо 1490; телефон +7...; оставить стиль и расположение элементов.');
  if(!text)return;
  const x=await api('create_remake',{client_id:clientId,artwork_id:artworkId,changes:{instruction:text,requested_at:new Date().toISOString()}});
  alert(`Переделка создана: job ${x.job_id}`);await load();location.hash='queue';
}

async function ensureQuestionnaire(){const x=await api('ensure_printer_questionnaire');fillQuestionnaire(x.questionnaire);$('#printerForm').hidden=false;location.hash='printer'}
function fillQuestionnaire(q){
  $('#questionnaireId').value=q.id;$('#printerModel').value=q.printer_model||'';$('#ripSoftware').value=q.rip_software||'';$('#ripVersion').value=q.rip_version||'';$('#materialName').value=q.material_name||'';$('#artworkScale').value=q.artwork_scale??'';$('#targetDpi').value=q.target_dpi??'';$('#colorMode').value=q.color_mode||'';$('#colorProfile').value=q.color_profile||'';$('#bleedMm').value=q.bleed_mm??'';$('#safeZoneMm').value=q.safe_zone_mm??'';$('#maxFileMb').value=q.max_file_mb??'';$('#allowedFormats').value=(q.allowed_formats||[]).join(', ');$('#fileNamingRule').value=q.file_naming_rule||'';$('#fontsCurves').checked=q.convert_fonts_to_curves===true;$('#rasterize').checked=q.rasterize_transparency===true;$('#otherRequirements').value=q.other_requirements||'';$('#printerStatus').textContent=`Статус: ${q.status}\nПечатник: ${q.printer_confirmed_at?'подтвердил':'ожидается'} · Менеджер: ${q.manager_confirmed_at?'подтвердил':'ожидается'}`;
}
function questionnairePayload(submit=false){return{questionnaire_id:$('#questionnaireId').value,printer_model:$('#printerModel').value,rip_software:$('#ripSoftware').value,rip_version:$('#ripVersion').value,material_name:$('#materialName').value,artwork_scale:$('#artworkScale').value===''?null:Number($('#artworkScale').value),target_dpi:$('#targetDpi').value===''?null:Number($('#targetDpi').value),color_mode:$('#colorMode').value,color_profile:$('#colorProfile').value,bleed_mm:$('#bleedMm').value===''?null:Number($('#bleedMm').value),safe_zone_mm:$('#safeZoneMm').value===''?null:Number($('#safeZoneMm').value),max_file_mb:$('#maxFileMb').value===''?null:Number($('#maxFileMb').value),allowed_formats:$('#allowedFormats').value.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean),file_naming_rule:$('#fileNamingRule').value,convert_fonts_to_curves:$('#fontsCurves').checked,rasterize_transparency:$('#rasterize').checked,other_requirements:$('#otherRequirements').value,submit}}
async function saveQ(submit=false){const x=await api('save_printer_questionnaire',questionnairePayload(submit));fillQuestionnaire(x.questionnaire);$('#printerStatus').textContent+=`\nValidation: ${x.validation?.valid?'OK':'НЕ ГОТОВО'}${x.validation?.errors?.length?'\nНужно заполнить: '+x.validation.errors.join(', '):''}${x.validation?.warnings?.length?'\nПредупреждения: '+x.validation.warnings.join(', '):''}`;await load()}
async function confirmParty(party){const id=$('#questionnaireId').value;if(!id)return alert('Сначала откройте анкету.');const x=await api('confirm_printer_profile',{questionnaire_id:id,party});if(x.generated_print_profile_id)alert('✅ Профиль печати подтверждён обеими сторонами и опубликован.');else alert(`Подтверждение ${party==='printer'?'печатника':'менеджера'} сохранено. Ждём вторую сторону.`);await load();const q=snap.printer_questionnaires.find(q=>q.id===id);if(q){fillQuestionnaire(q);$('#printerForm').hidden=false}}

async function uploadArchive(){
  const files=[...$('#archiveFiles').files];if(!files.length)return alert('Выберите файлы.');const clientId=$('#uploadClient').value||null;let batchId=null,done=0;$('#uploadStatus').textContent=`Загрузка 0 / ${files.length}`;
  for(const f of files){
    try{
      const up=await api('create_archive_upload',{batch_id:batchId,original_name:f.name,byte_size:f.size,mime_type:f.type||'application/octet-stream',source_kind:files.length>1?'files':'files'});batchId=up.batch_id;
      const {error}=await sb.storage.from('rpk-archive').uploadToSignedUrl(up.path,up.token,f,{contentType:f.type||'application/octet-stream'});if(error)throw error;
      await api('register_archive_file',{batch_id:batchId,storage_path:up.path,original_name:f.name,mime_type:f.type||'application/octet-stream',byte_size:f.size,client_id:clientId});done++;$('#uploadStatus').textContent=`Загружено ${done} / ${files.length}: ${f.name}`;
    }catch(e){$('#uploadStatus').textContent+=`\nОшибка ${f.name}: ${e.message}`}
  }
  await load();$('#archiveFiles').value='';
}

$('#authForm').onsubmit=async e=>{e.preventDefault();$('#authMsg').textContent='Вход…';const {error}=await sb.auth.signInWithPassword({email:$('#email').value,password:$('#password').value});$('#authMsg').textContent=error?error.message:'';if(!error)await boot()};
$('#signOut').onclick=async()=>{await sb.auth.signOut();location.reload()};
$('#reload').onclick=load;$('#loadArtworks').onclick=()=>loadArtworks($('#uploadClient').value||'');$('#uploadArchive').onclick=uploadArchive;$('#ensureQuestionnaire').onclick=ensureQuestionnaire;$('#saveQuestionnaire').onclick=()=>saveQ(false);$('#submitQuestionnaire').onclick=()=>saveQ(true);$('#confirmPrinter').onclick=()=>confirmParty('printer');$('#confirmManager').onclick=()=>confirmParty('manager');
$('#addClient').onclick=async()=>{const name=prompt('Название клиента');if(!name)return;const phone=prompt('Телефон клиента (можно оставить пустым)')||'';await api('create_client',{name,phone});await load()};
document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{location.hash=b.dataset.jump});

async function boot(){const {data:{session}}=await sb.auth.getSession();if(!session){$('#authPanel').hidden=false;$('#workspace').hidden=true;return}$('#authPanel').hidden=true;$('#workspace').hidden=false;$('#signOut').hidden=false;$('#identity').textContent=session.user.email||'ONLINE';try{await load()}catch(e){alert(`Нет доступа к кабинету: ${e.message}`);$('#workspace').hidden=true;$('#authPanel').hidden=false}}
sb.auth.onAuthStateChange(()=>setTimeout(boot,200));boot();