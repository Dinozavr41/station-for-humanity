const langBtn=document.getElementById('langBtn');let lang=localStorage.getItem('sfh-lang')||(navigator.language?.toLowerCase().startsWith('ru')?'ru':'en');
function applyLanguage(){document.documentElement.lang=lang;document.documentElement.dataset.lang=lang;document.querySelectorAll('[data-en][data-ru]').forEach(el=>el.textContent=el.dataset[lang]);langBtn.textContent=lang==='en'?'RU':'EN';localStorage.setItem('sfh-lang',lang);renderAllocation();}
langBtn.addEventListener('click',()=>{lang=lang==='en'?'ru':'en';applyLanguage()});

const modal=document.getElementById('joinModal');const roleInput=document.getElementById('ticketRole');const ticketTitle=document.getElementById('ticketTitle');const ticketForm=document.getElementById('ticketForm');const output=document.getElementById('ticketOutput');
const roleNames={need:{en:'I need something',ru:'Мне что-то нужно'},build:{en:'I can build',ru:'Я могу создавать'},resource:{en:'I have a resource',ru:'У меня есть ресурс'},contribute:{en:'I want to contribute',ru:'Я хочу внести вклад'},dream:{en:'I have a dream',ru:'У меня есть мечта'}};
function openTicket(role){roleInput.value=role;ticketTitle.textContent=roleNames[role]?.[lang]||'Join the Station';modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';}
function closeTicket(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';}
document.querySelectorAll('.role-card').forEach(card=>card.addEventListener('click',()=>openTicket(card.dataset.role)));
document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',closeTicket));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTicket()});

function buildTicket(){return{schema:'station-for-humanity/founding-ticket/v0.2',created_at:new Date().toISOString(),role:roleInput.value,name:document.getElementById('ticketName').value.trim()||null,region:document.getElementById('ticketRegion').value.trim()||null,statement:document.getElementById('ticketText').value.trim(),privacy:'local-prototype-no-upload',article_0_acknowledged:true};}
ticketForm.addEventListener('submit',e=>{e.preventDefault();const ticket=buildTicket();output.textContent=JSON.stringify(ticket,null,2);localStorage.setItem('sfh-last-ticket',JSON.stringify(ticket));});
document.getElementById('copyTicket').addEventListener('click',async()=>{const ticket=buildTicket();const text=JSON.stringify(ticket,null,2);output.textContent=text;try{await navigator.clipboard.writeText(text);document.getElementById('copyTicket').textContent=lang==='ru'?'Скопировано':'Copied';setTimeout(()=>document.getElementById('copyTicket').textContent=lang==='ru'?'Скопировать JSON':'Copy JSON',1300)}catch{output.textContent=text}});

const allocationPlan=[['Creator / исполнители',35],['Module creators / авторы модулей',15],['Infrastructure + AI',10],['Dream Fund',10],['Platform development',20],['Social + reserve',10]];
function money(v){return new Intl.NumberFormat(lang==='ru'?'ru-RU':'en-US',{maximumFractionDigits:0}).format(v)}
function renderAllocation(){const input=document.getElementById('orderValue');const box=document.getElementById('allocation');if(!input||!box)return;const value=Math.max(0,Number(input.value)||0);box.innerHTML=allocationPlan.map(([name,pct])=>`<div class="allocation-row"><span>${name} · ${pct}%</span><span>${money(value*pct/100)}</span></div>`).join('');}
document.getElementById('orderValue')?.addEventListener('input',renderAllocation);

const saved=localStorage.getItem('sfh-last-ticket');if(saved){try{output.textContent=JSON.stringify(JSON.parse(saved),null,2)}catch{}}
applyLanguage();