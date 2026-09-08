const header = document.querySelector('.site-header');
const toggle = document.querySelector('.menu-toggle');

if (toggle && header) {
  toggle.addEventListener('click', () => {
    const open = header.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '×' : '☰';
  });

  header.querySelectorAll('.main-nav a').forEach((link) => {
    link.addEventListener('click', () => {
      header.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
    });
  });
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems = [...document.querySelectorAll('.reveal')];

if (reducedMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((el) => el.classList.add('visible'));
} else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  revealItems.forEach((el) => observer.observe(el));
}

// Keep the preview intentionally read-only. All actions that mutate platform
// state are links to the existing, already-tested production surfaces.
console.info('SFH Frontend V2 Preview: visual shell only; backend unchanged.');
