const SUPABASE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_mVOY1vbk6e6jiBnT0VAX9w_sFXODDsi';
const routes=new Map();

async function loadRoutes(){
  try{
    const r=await fetch(`${SUPABASE_URL}/functions/v1/business-public`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY},cache:'no-store'});
    const d=await r.json();
    if(!r.ok||!d?.ok)return;
    for(const c of d.directory||[]){
      if(c?.workspace_id&&c?.entry_path)routes.set(String(c.workspace_id),String(c.entry_path));
    }
    patchButtons();
  }catch(e){console.error('RPK direct entry unavailable',e)}
}

function patchButtons(root=document){
  root.querySelectorAll?.('.company-login[data-workspace]').forEach(b=>{
    if(!routes.has(String(b.dataset.workspace)))return;
    b.classList.add('primary');
    b.textContent='Открыть / войти в кабинет →';
    b.title='Вход выполняется в защищённом кабинете компании';
  });
}

document.addEventListener('click',e=>{
  const b=e.target.closest?.('.company-login[data-workspace]');
  if(!b)return;
  const path=routes.get(String(b.dataset.workspace));
  if(!path)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  location.assign(path);
},true);

new MutationObserver(m=>{
  for(const x of m){for(const n of x.addedNodes){if(n.nodeType===1)patchButtons(n)}}
}).observe(document.documentElement,{childList:true,subtree:true});

loadRoutes();