// Shared behaviour for every page: mobile menu, scroll reveals, footer year.
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

const setMenu = (open) => {
  menuButton.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('open', open);
};
menuButton.addEventListener('click', () =>
  setMenu(menuButton.getAttribute('aria-expanded') !== 'true'),
);
nav.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenu(false);
});

const reveals = document.querySelectorAll('.reveal');
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  reveals.forEach((item) => item.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  reveals.forEach((item, index) => {
    item.style.transitionDelay = `${(index % 3) * 70}ms`;
    observer.observe(item);
  });
}

document.querySelectorAll('[data-year]').forEach((node) => {
  node.textContent = new Date().getFullYear();
});
