const menuButton=document.querySelector('[data-menu-toggle]');
const menu=document.querySelector('#navigation');
function closeMenu(){menuButton?.setAttribute('aria-expanded','false');menu?.classList.remove('is-open');}
menuButton?.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',String(open));menu.classList.toggle('is-open',open);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeMenu();menuButton?.focus();}});
menu?.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
document.addEventListener('click',event=>{if(!event.target.closest('.masthead'))closeMenu();});
function revealChapter(){const id=decodeURIComponent(location.hash.slice(1));const target=document.getElementById(id);if(target?.tagName==='DETAILS'){target.open=true;target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}
window.addEventListener('hashchange',revealChapter);
revealChapter();
const chapters=document.querySelectorAll('[data-chapter]');
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){document.querySelectorAll('[data-step]').forEach(link=>link.toggleAttribute('data-current',link.hash==='#'+entry.target.id));}}},{rootMargin:'-20% 0px -45% 0px'});chapters.forEach(chapter=>observer.observe(chapter));}
