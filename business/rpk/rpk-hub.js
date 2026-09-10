import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>(Number(v)||0).toLocaleString('ru-RU',{maximumFractionDigits:0})+' ₽';
const PENDING_KEY='station:rpk-pending-signup:v1';
let publicData=null;

async function publicSnapshot(){
  const r=await fetch(`${SUPABASE_URL}/functions/v1/business-public`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY}});
  const d=await r.json();if(!r.ok||!d?.ok)throw new Error(d?.error||'public_snapshot_failed');return d;
}
async function businessSnapshot(){
  const {data,error}=await sb.functions.invoke('business-hub',{body:{action:'snapshot'}});
  if(error){let m=error.message;try{if(error.context){const j=await error.context.json();m=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(m)}
  if(!data?.ok)throw new Error(data?.error||'business_hub_error');return data;
}
async function subscriptionApi(action,payload={}){
  const {data,error}=await sb.functions.invoke('business-subscription',{body:{action,...payload}});
  if(error){let m=error.message;try{if(error.context){const j=await error.context.json();m=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(m)}
  if(!data?.ok)throw new Error(data?.error||'business_subscription_error');return data;
}
function renderPublic(d){
  publicData=d;const rpkCount=Number(d.company_counts_by_vertical?.rpk||0);$('#rpkCompanyCount').textContent=rpkCount.toLocaleString('ru-RU');
  const companies=(d.directory||[]).filter(x=>x.vertical_code==='rpk');
  $('#publicCompanyGrid').innerHTML=companies.length?companies.map(c=>`<article class="public-company"><span class="company-place">${esc(c.city||'РОССИЯ')}</span><h3>${esc(c.company_name||'РПК')}</h3><p>${esc(c.headline||c.about||'Участник RPK OS')}</p>${c.offers?.length?`<div class="tag-row">${c.offers.slice(0,5).map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}</article>`).join(''):'<div class="empty">Первые компании уже подключаются. Публичные карточки появляются только с согласия владельца.</div>';
  const plans=(d.plans||[]).filter(x=>x.vertical_code==='rpk');
  $('#signupPlan').innerHTML=plans.map(p=>`<option value="${esc(p.code)}">${esc(p.name_ru)} — ${money(p.total_price)}</option>`).join('');
  $('#planGrid').innerHTML=plans.map(p=>{const best=Number(p.billing_months)===12,disc=Number(p.discount_pct||0);return `<article class="plan-card ${best?'best':''}">${best?'<span class="plan-badge">ВЫГОДНЕЕ</span>':disc?`<span class="plan-badge">−${disc}%</span>`:''}<p class="eyebrow">${p.billing_months===1?'ПОМЕСЯЧНО':p.billing_months===6?'ПОЛГОДА':'ГОД'}</p><h3>${esc(p.name_ru.replace('RPK OS · ',''))}</h3><div class="plan-price">${money(p.monthly_price)} <small>/ мес</small></div><div class="plan-total">К оплате за период: <b>${money(p.total_price)}</b></div><ul><li>CRM, клиенты и сделки</li><li>Документы и старые макеты</li><li>Деньги, закупки и производство</li><li>Команда и цифровой след</li><li>Business Network</li></ul><button class="button ${best?'primary':''} plan-select" data-plan="${esc(p.code)}">Выбрать →</button></article>`}).join('');
  document.querySelectorAll('.plan-select').forEach(b=>b.onclick=()=>{setPlan(b.dataset.plan);document.getElementById('signup').scrollIntoView({behavior:'smooth'})});
  $('#paymentNotice').hidden=d.payment_live===true;
}
function setPlan(code){if([...$('#signupPlan').options].some(o=>o.value===code))$('#signupPlan').value=code}
function renderCompanies(data){
  const list=(data.workspaces||[]).filter(x=>x.vertical_code==='rpk');
  $('#identity').textContent=[data.user?.display_name||data.user?.email,data.user?.platform_role?`Station: ${data.user.platform_role}`:null].filter(Boolean).join(' · ');
  $('#companyGrid').innerHTML=list.length?list.map(w=>`<article class="company-card"><span class="status">${esc(String(w.status||'active').toUpperCase())}</span><h3>${esc(w.name)}</h3><p>${esc(w.legal_name||'')} ${w.city?`· ${esc(w.city)}`:''}</p><div class="company-meta"><span>RPK OS</span>${w.access_role?`<span>${esc(w.access_role)}</span>`:''}</div><a class="button primary" href="${esc(w.route_path)}">Открыть рабочий кабинет →</a></article>`).join(''):'<div class="empty">У этого аккаунта пока нет РПК. Если это ваша компания — создайте кабинет ниже. Если вы сотрудник — владелец должен пригласить вас из своей CRM.</div>';
}
async function createWorkspace(payload){
  $('#signupMsg').className='signup-msg';$('#signupMsg').textContent='Создаём отдельный кабинет и назначаем вас владельцем…';
  const d=await subscriptionApi('create_rpk_workspace',payload);localStorage.removeItem(PENDING_KEY);$('#signupMsg').className='signup-msg ok';$('#signupMsg').textContent=`Готово. ${payload.name} создана в Station. Тариф зафиксирован; сейчас деньги не списывались.`;await loadPrivate();setTimeout(()=>{location.href=d.workspace.route_path},900);
}
async function continuePending(){
  const raw=localStorage.getItem(PENDING_KEY);if(!raw)return;let p;try{p=JSON.parse(raw)}catch{localStorage.removeItem(PENDING_KEY);return}try{await createWorkspace(p)}catch(e){$('#signupMsg').className='signup-msg error';$('#signupMsg').textContent='Не удалось завершить создание кабинета: '+e.message}
}
async function loadPrivate(){
  const {data:{session}}=await sb.auth.getSession();const newFields=$('#newUserFields');
  if(!session){$('#authPanel').hidden=false;$('#workspacePanel').hidden=true;newFields.hidden=false;$('.signup-submit').textContent='Создать мой кабинет →';return}
  $('#authPanel').hidden=true;newFields.hidden=true;$('.signup-submit').textContent='Создать ещё один кабинет →';
  try{const data=await businessSnapshot();renderCompanies(data);$('#workspacePanel').hidden=false;await continuePending()}catch(e){$('#workspacePanel').hidden=true;$('#authPanel').hidden=false;$('#authMsg').textContent='Не удалось открыть список компаний: '+e.message}
}
async function load(){try{renderPublic(await publicSnapshot())}catch(e){console.error(e);$('#publicCompanyGrid').innerHTML='<div class="empty">Счётчик временно не загрузился.</div>'}await loadPrivate()}

$('#authForm').addEventListener('submit',async e=>{e.preventDefault();$('#authMsg').textContent='Входим…';const {error}=await sb.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(error){$('#authMsg').textContent=error.message;return}$('#authMsg').textContent='';await loadPrivate()});
$('#signOut').addEventListener('click',async()=>{await sb.auth.signOut();await loadPrivate()});
$('#signupForm').addEventListener('submit',async e=>{
  e.preventDefault();const payload={name:$('#signupCompany').value.trim(),legal_name:$('#signupLegal').value.trim(),city:$('#signupCity').value.trim(),plan_code:$('#signupPlan').value};if(!payload.name||!payload.plan_code)return;
  const {data:{session}}=await sb.auth.getSession();
  if(session){try{await createWorkspace(payload)}catch(err){$('#signupMsg').className='signup-msg error';$('#signupMsg').textContent=err.message}return}
  const fullName=$('#signupName').value.trim(),email=$('#signupEmail').value.trim(),password=$('#signupPassword').value;if(fullName.length<2||!email.includes('@')||password.length<10){$('#signupMsg').className='signup-msg error';$('#signupMsg').textContent='Укажите имя, корректный email и пароль не короче 10 символов.';return}
  $('#signupMsg').className='signup-msg';$('#signupMsg').textContent='Создаём аккаунт Station…';localStorage.setItem(PENDING_KEY,JSON.stringify(payload));
  const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name:fullName},emailRedirectTo:'https://stationforhumanity.com/business/rpk/'}});
  if(error){localStorage.removeItem(PENDING_KEY);$('#signupMsg').className='signup-msg error';$('#signupMsg').textContent=error.message;return}
  if(data.session){await continuePending()}else{$('#signupMsg').className='signup-msg ok';$('#signupMsg').textContent='Аккаунт создан. Подтвердите email по письму Station — после перехода кабинет создастся автоматически.'}
});
sb.auth.onAuthStateChange(()=>setTimeout(loadPrivate,180));
load();