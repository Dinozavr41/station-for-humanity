import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const sb=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function snapshot(){
  const {data,error}=await sb.functions.invoke('business-hub',{body:{action:'snapshot'}});
  if(error){let m=error.message;try{if(error.context){const j=await error.context.json();m=j.error+(j.detail?`: ${j.detail}`:'')}}catch{}throw new Error(m)}
  if(!data?.ok)throw new Error(data?.error||'business_hub_error');
  return data;
}
function renderCompanies(data){
  const list=(data.workspaces||[]).filter(x=>x.vertical_code==='rpk');
  $('#identity').textContent=[data.user?.display_name||data.user?.email,data.user?.platform_role?`Station: ${data.user.platform_role}`:null].filter(Boolean).join(' · ');
  $('#companyGrid').innerHTML=list.length?list.map(w=>`<article class="company-card"><span class="status">${esc(String(w.status||'active').toUpperCase())}</span><h3>${esc(w.name)}</h3><p>${esc(w.legal_name||'')} ${w.city?`· ${esc(w.city)}`:''}</p><div class="company-meta"><span>RPK OS</span>${w.access_role?`<span>${esc(w.access_role)}</span>`:''}${w.metadata?.workspace_no?`<span>Workspace #${esc(w.metadata.workspace_no)}</span>`:''}</div><a class="button primary" href="${esc(w.route_path)}">Открыть рабочий кабинет →</a></article>`).join(''):'<div class="empty">Для этого аккаунта пока нет доступных РПК. Владелец компании может добавить вас в разделе «Команда / История» своего кабинета.</div>';
}
async function load(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){$('#authPanel').hidden=false;$('#workspacePanel').hidden=true;return}
  try{const data=await snapshot();renderCompanies(data);$('#authPanel').hidden=true;$('#workspacePanel').hidden=false}catch(e){$('#authMsg').textContent='Не удалось открыть список компаний: '+e.message;$('#authPanel').hidden=false;$('#workspacePanel').hidden=true}
}
$('#authForm').addEventListener('submit',async e=>{e.preventDefault();$('#authMsg').textContent='Входим…';const {error}=await sb.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value});if(error){$('#authMsg').textContent=error.message;return}$('#authMsg').textContent='';await load()});
$('#signOut').addEventListener('click',async()=>{await sb.auth.signOut();await load()});
sb.auth.onAuthStateChange(()=>setTimeout(load,120));
load();