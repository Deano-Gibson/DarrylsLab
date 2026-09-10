const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
const form = document.querySelector('.contact-form');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 24);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  nav.classList.toggle('open', !isOpen);
});

nav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
  });
});

if (reduceMotion) {
  document.querySelectorAll('.reveal').forEach((item) => item.classList.add('is-visible'));
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
    { threshold: 0.12 }
  );

  document.querySelectorAll('.reveal').forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index % 3, 2) * 70}ms`;
    observer.observe(item);
  });
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const requiredFields = [...form.querySelectorAll('[required]')];
  const invalidField = requiredFields.find((field) => !field.checkValidity());
  const status = form.querySelector('.form-status');

  requiredFields.forEach((field) => field.setAttribute('aria-invalid', String(!field.checkValidity())));

  if (invalidField) {
    status.textContent = 'Please complete the highlighted fields.';
    status.style.color = '#9a2f2f';
    invalidField.focus();
    return;
  }

  const button = form.querySelector('button');
  button.disabled = true;
  button.firstChild.textContent = 'Sending… ';
  status.textContent = '';

  window.setTimeout(() => {
    const firstName = new FormData(form).get('firstName');
    status.textContent = `Thanks, ${firstName}. Your demo enquiry is ready to go!`;
    status.style.color = '#28603a';
    button.disabled = false;
    button.firstChild.textContent = 'Sent ✓ ';
    form.reset();
  }, 700);
});

document.querySelector('[data-year]').textContent = new Date().getFullYear();
