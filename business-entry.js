(()=>{
  if(document.getElementById('businessOsEntry'))return;
  const style=document.createElement('style');
  style.textContent=`
    .business-nav-link{color:#ffd479!important;font-weight:900!important}
    .business-os-btn{position:relative;overflow:hidden;background:linear-gradient(135deg,#ffd479,#ffad57)!important;color:#07111f!important;border:0!important;box-shadow:0 0 0 1px rgba(255,212,121,.22),0 12px 42px rgba(255,174,79,.16)!important}
    .business-os-btn:after{content:'';position:absolute;inset:-80% -30%;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.35),transparent 65%);transform:translateX(-70%) rotate(8deg);animation:businessGlow 4.8s ease-in-out infinite}
    @keyframes businessGlow{0%,55%{transform:translateX(-75%) rotate(8deg)}75%,100%{transform:translateX(85%) rotate(8deg)}}
    .business-os-btn span{position:relative;z-index:1}
  `;
  document.head.appendChild(style);
  const nav=document.querySelector('.nav nav');
  if(nav){
    const a=document.createElement('a');a.id='businessOsEntry';a.href='/business/';a.className='business-nav-link';a.dataset.en='Business CRM';a.dataset.ru='CRM для бизнеса';a.textContent=document.documentElement.dataset.lang==='ru'?'CRM для бизнеса':'Business CRM';nav.prepend(a);
  }
  const actions=document.querySelector('.hero .actions');
  if(actions){
    const a=document.createElement('a');a.href='/business/';a.className='btn business-os-btn';a.dataset.en='Business CRM';a.dataset.ru='CRM для бизнеса';a.innerHTML='<span>CRM для бизнеса</span>';
    const sync=()=>{const ru=document.documentElement.dataset.lang==='ru';a.querySelector('span').textContent=ru?'CRM для бизнеса':'Business CRM'};
    sync();actions.prepend(a);
    const langBtn=document.getElementById('langBtn');langBtn?.addEventListener('click',()=>setTimeout(sync,0));
  }
})();