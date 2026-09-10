const langBtn=document.getElementById('langBtn');let lang=localStorage.getItem('sfh-lang')||(navigator.language?.toLowerCase().startsWith('ru')?'ru':'en');
const INTAKE_URL='https://xwapzjsnqyfiqbzeycyh.supabase.co/functions/v1/founding-ticket';
function applyLanguage(){document.documentElement.lang=lang;document.documentElement.dataset.lang=lang;document.querySelectorAll('[data-en][data-ru]').forEach(el=>el.textContent=el.dataset[lang]);langBtn.textContent=lang==='en'?'RU':'EN';localStorage.setItem('sfh-lang',lang);renderAllocation();updateDynamicText();}
langBtn.addEventListener('click',()=>{lang=lang==='en'?'ru':'en';applyLanguage()});

const modal=document.getElementById('joinModal');const roleInput=document.getElementById('ticketRole');const ticketTitle=document.getElementById('ticketTitle');const ticketForm=document.getElementById('ticketForm');const output=document.getElementById('ticketOutput');
const roleNames={need:{en:'I need something',ru:'Мне что-то нужно'},build:{en:'I can build',ru:'Я могу создавать'},resource:{en:'I have a resource',ru:'У меня есть ресурс'},contribute:{en:'I want to contribute',ru:'Я хочу внести вклад'},dream:{en:'I have a dream',ru:'У меня есть мечта'}};
function openTicket(role){roleInput.value=role;ticketTitle.textContent=roleNames[role]?.[lang]||'Join the Station';modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';}
function closeTicket(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';}
document.querySelectorAll('.role-card').forEach(card=>card.addEventListener('click',()=>openTicket(card.dataset.role)));
document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',closeTicket));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTicket()});

// Alpha 0.3: explicit consent + honeypot are injected here so the existing static HTML stays backwards-compatible.
const actions=ticketForm?.querySelector('.ticket-actions');
if(ticketForm&&actions){
  const hp=document.createElement('input');hp.type='text';hp.id='ticketWebsite';hp.name='website';hp.tabIndex=-1;hp.autocomplete='off';hp.setAttribute('aria-hidden','true');hp.style.cssText='position:absolute;left:-9999px;width:1px;height:1px;opacity:0';ticketForm.insertBefore(hp,actions);
  const consent=document.createElement('label');consent.id='ticketConsentLabel';consent.style.cssText='display:flex;grid-template-columns:auto 1fr;align-items:flex-start;gap:10px;cursor:pointer';consent.innerHTML='<input id="ticketConsent" type="checkbox" required style="width:auto;margin-top:3px"><span id="ticketConsentText"></span>';ticketForm.insertBefore(consent,actions);
}
function updateDynamicText(){const c=document.getElementById('ticketConsentText');if(c)c.textContent=lang==='ru'?'Я согласен отправить эти данные в Station for Humanity для обработки этой заявки.':'I agree to send this data to Station for Humanity for processing this request.';const submit=ticketForm?.querySelector('button[type="submit"]');if(submit&&!submit.dataset.busy)submit.textContent=lang==='ru'?'Отправить Founding Ticket':'Submit Founding Ticket';}

function buildTicket(){return{schema:'station-for-humanity/founding-ticket/v0.3',created_at:new Date().toISOString(),role:roleInput.value,name:document.getElementById('ticketName').value.trim()||null,region:document.getElementById('ticketRegion').value.trim()||null,statement:document.getElementById('ticketText').value.trim(),consent:document.getElementById('ticketConsent')?.checked===true,website:document.getElementById('ticketWebsite')?.value||'',article_0_acknowledged:true};}

function friendlyError(code){const ru={consent_required:'Нужно согласие на отправку данных.',invalid_role:'Некорректная роль.',statement_length:'Описание должно быть от 10 до 1500 символов.',field_too_long:'Одно из полей слишком длинное.',rate_limit:'Слишком много заявок с этого устройства. Попробуйте позже.',registration_closed:'Приём заявок временно закрыт.',origin_not_allowed:'Этот источник запроса не разрешён.'};const en={consent_required:'Consent is required.',invalid_role:'Invalid role.',statement_length:'Statement must be 10–1500 characters.',field_too_long:'One field is too long.',rate_limit:'Too many submissions from this device. Please try later.',registration_closed:'Registration is temporarily closed.',origin_not_allowed:'This request origin is not allowed.'};return (lang==='ru'?ru:en)[code]||(lang==='ru'?'Не удалось отправить заявку. Попробуйте ещё раз.':'Could not submit the ticket. Please try again.');}

ticketForm.addEventListener('submit',async e=>{e.preventDefault();const ticket=buildTicket();if(!ticket.consent){output.textContent=friendlyError('consent_required');return}const submit=ticketForm.querySelector('button[type="submit"]');submit.disabled=true;submit.dataset.busy='1';submit.textContent=lang==='ru'?'Отправляем…':'Submitting…';output.textContent=lang==='ru'?'Соединяемся со станцией…':'Connecting to the Station…';try{const res=await fetch(INTAKE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ticket)});const data=await res.json().catch(()=>({ok:false,error:'invalid_response'}));if(!res.ok||!data.ok){output.textContent=friendlyError(data.error);return}const result={...ticket,website:undefined,server_ticket:data.ticket};localStorage.setItem('sfh-last-ticket',JSON.stringify(result));output.textContent=(lang==='ru'?`Заявка принята. Номер: ${data.ticket.number}\nСтатус: ${data.ticket.status}`:`Ticket accepted. Number: ${data.ticket.number}\nStatus: ${data.ticket.status}`);ticketForm.dataset.submitted='1';}catch(err){output.textContent=lang==='ru'?'Сеть недоступна. Заявка не потеряна — попробуйте отправить ещё раз.':'Network unavailable. Your form is still here — please try again.';}finally{submit.disabled=false;delete submit.dataset.busy;updateDynamicText();}});

document.getElementById('copyTicket').addEventListener('click',async()=>{const ticket=buildTicket();delete ticket.website;const text=JSON.stringify(ticket,null,2);try{await navigator.clipboard.writeText(text);document.getElementById('copyTicket').textContent=lang==='ru'?'Скопировано':'Copied';setTimeout(()=>document.getElementById('copyTicket').textContent=lang==='ru'?'Скопировать JSON':'Copy JSON',1300)}catch{output.textContent=text}});

const allocationPlan=[['Creator / исполнители',35],['Module creators / авторы модулей',15],['Infrastructure + AI',10],['Dream Fund',10],['Platform development',20],['Social + reserve',10]];
function money(v){return new Intl.NumberFormat(lang==='ru'?'ru-RU':'en-US',{maximumFractionDigits:0}).format(v)}
function renderAllocation(){const input=document.getElementById('orderValue');const box=document.getElementById('allocation');if(!input||!box)return;const value=Math.max(0,Number(input.value)||0);box.innerHTML=allocationPlan.map(([name,pct])=>`<div class="allocation-row"><span>${name} · ${pct}%</span><span>${money(value*pct/100)}</span></div>`).join('');}
document.getElementById('orderValue')?.addEventListener('input',renderAllocation);

const saved=localStorage.getItem('sfh-last-ticket');if(saved){try{const parsed=JSON.parse(saved);if(parsed.server_ticket)output.textContent=(navigator.language?.toLowerCase().startsWith('ru')?`Последняя заявка: ${parsed.server_ticket.number}`:`Last ticket: ${parsed.server_ticket.number}`)}catch{}}

// Alpha 0.7: Digital Factory must be discoverable from the front door, not hidden behind a remembered URL.
function installFactoryEntry(){
  if(document.getElementById('factoryEntry'))return;
  const style=document.createElement('style');
  style.textContent=`
    .factory-nav-link{color:#64e9ff!important;font-weight:900!important}
    .factory-entry{margin-top:-14px!important;padding-top:44px!important;padding-bottom:44px!important}
    .factory-entry-card{position:relative;overflow:hidden;display:grid;grid-template-columns:1.45fr .8fr;gap:34px;align-items:center;padding:38px;border:1px solid rgba(86,229,255,.24);border-radius:26px;background:linear-gradient(135deg,rgba(15,45,70,.94),rgba(10,22,39,.94));box-shadow:0 24px 80px rgba(0,0,0,.28)}
    .factory-entry-card:before{content:'';position:absolute;width:360px;height:360px;border-radius:50%;right:-120px;top:-170px;background:radial-gradient(circle,rgba(69,232,255,.22),transparent 68%);pointer-events:none}
    .factory-entry-card h2{font-size:clamp(30px,4.5vw,58px);line-height:1.02;margin:8px 0 16px}.factory-entry-card h2 span{color:#65eaff}
    .factory-entry-card p{color:#abc1d2;line-height:1.65;max-width:760px}.factory-entry-price{position:relative;padding:24px;border-radius:20px;background:rgba(2,13,24,.64);border:1px solid rgba(255,255,255,.08);display:grid;gap:10px}
    .factory-entry-price small{letter-spacing:.16em;color:#81a6bb;font-size:10px}.factory-entry-price strong{font-size:42px;color:#fff}.factory-entry-price span{color:#88f0bb;font-size:12px}.factory-entry-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
    .factory-hero-btn{box-shadow:0 0 0 1px rgba(98,233,255,.22),0 10px 38px rgba(61,217,255,.12)}
    @media(max-width:760px){.factory-entry-card{grid-template-columns:1fr;padding:24px}.factory-entry-price strong{font-size:34px}}
  `;
  document.head.append(style);
  const nav=document.querySelector('.nav nav');
  if(nav){const a=document.createElement('a');a.href='/factory/';a.className='factory-nav-link';a.dataset.en='Digital Factory';a.dataset.ru='Фабрика';a.textContent='Digital Factory';nav.prepend(a)}
  const heroActions=document.querySelector('.hero .actions');
  if(heroActions){const a=document.createElement('a');a.href='/factory/';a.className='btn primary factory-hero-btn';a.dataset.en='Order from Digital Factory';a.dataset.ru='Заказать у Digital Factory';a.textContent='Order from Digital Factory';heroActions.prepend(a)}
  const hero=document.querySelector('.hero');
  if(hero){const section=document.createElement('section');section.id='factoryEntry';section.className='section factory-entry';section.innerHTML=`<div class="factory-entry-card"><div><span class="kicker">DIGITAL FACTORY · PRODUCT 01</span><h2 data-en="A real product. A server price. A real order." data-ru="Реальный продукт. Серверная цена. Настоящий заказ.">A real product. A server price. A real order.</h2><p data-en="SFH LeadBot 1.0 is a custom Telegram bot for business lead capture: questions, manager notification, database storage, deployment, source code and handover." data-ru="SFH LeadBot 1.0 — Telegram-бот для бизнеса: задаёт вопросы клиенту, отправляет заявку менеджеру, хранит её в базе. Развёртывание, исходный код и инструкция входят.">SFH LeadBot 1.0 is a custom Telegram bot for business lead capture.</p><div class="factory-entry-actions"><a class="btn primary" href="/factory/" data-en="Configure and get exact price" data-ru="Собрать вариант и узнать точную цену">Configure and get exact price</a><a class="btn" href="/factory/#configure" data-en="See options" data-ru="Посмотреть допы">See options</a></div></div><div class="factory-entry-price"><small data-en="FOUNDING PRICE" data-ru="СТАРТОВАЯ ЦЕНА">FOUNDING PRICE</small><strong>14 900 ₽</strong><span data-en="target: 3 business days · live charging still OFF" data-ru="цель: 3 рабочих дня · LIVE-списания пока OFF">target: 3 business days · live charging still OFF</span></div></div>`;hero.insertAdjacentElement('afterend',section)}
}
installFactoryEntry();
applyLanguage();
import('/business-entry.js').catch(()=>{});