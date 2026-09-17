import { createAuthClient } from '@neondatabase/auth';

const $ = (selector) => document.querySelector(selector);
const auth = import.meta.env.VITE_NEON_AUTH_URL
  ? createAuthClient(import.meta.env.VITE_NEON_AUTH_URL)
  : null;
const resetToken = new URLSearchParams(location.search).get('token');
const ukTime = (value) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));

function message(text, type = 'info') {
  $('#notice').textContent = text;
  $('#notice').dataset.type = type;
  $('#notice').hidden = !text;
}

function el(tag, className, text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

async function privateFetch(path, options = {}) {
  if (!auth) throw new Error('Account sign-in is not configured');
  const token = await auth.getJWTToken();
  if (!token) throw new Error('Please sign in again');
  return fetch(path, {
    ...options,
    cache: 'no-store',
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  });
}

async function refresh() {
  if (resetToken) {
    $('#auth-panel').hidden = true;
    $('#member').hidden = true;
    $('#reset-panel').hidden = false;
    return;
  }
  if (!auth) {
    $('#auth-panel').hidden = false;
    $('#member').hidden = true;
    message('Account sign-in is not configured yet. Please contact Darryl.', 'error');
    return;
  }
  try {
    const session = await auth.getSession();
    const signedIn = !!session.data?.user;
    $('#auth-panel').hidden = signedIn;
    $('#member').hidden = !signedIn;
    if (!signedIn) return;
    const [accountResponse, slotsResponse] = await Promise.all([
      privateFetch('/api/account'),
      privateFetch('/api/availability'),
    ]);
    if (!accountResponse.ok)
      throw new Error('Your account could not be loaded. Please sign in again.');
    const account = await accountResponse.json();
    const slots = slotsResponse.ok ? (await slotsResponse.json()).slots : null;
    $('#member-email').textContent = account.email;
    $('#credit-count').textContent = account.credits;
    const slotList = $('#slots');
    slotList.replaceChildren();
    if (!slots) {
      slotList.append(
        el('p', '', 'Availability is temporarily unavailable. Please try again later.'),
      );
      message(
        'Darryl’s calendar cannot be checked right now. Booking is temporarily unavailable.',
        'error',
      );
    } else if (!slots.length) {
      slotList.append(el('p', '', 'No times are published right now. Please check back soon.'));
    }
    for (const slot of slots || []) {
      const button = el(
        'button',
        'btn btn-primary btn-sm',
        account.credits ? 'Book · 1 credit' : 'Buy credits to book',
      );
      button.type = 'button';
      button.disabled = !account.credits;
      button.addEventListener('click', () => book(slot, button));
      const row = el('div', 'slot');
      row.append(el('span', '', ukTime(slot.starts_at)), button);
      slotList.append(row);
    }
    const booked = $('#bookings');
    booked.replaceChildren();
    if (!account.bookings.length)
      booked.append(el('p', '', 'No bookings yet. Choose a time above when you are ready.'));
    for (const item of account.bookings) {
      const confirmed = item.calendar_status === 'confirmed';
      const row = el('div', 'booking');
      row.append(
        el('span', '', ukTime(item.starts_at)),
        el(
          'span',
          confirmed ? 'badge badge-success' : 'badge badge-warning',
          confirmed ? 'Confirmed' : 'Pending calendar confirmation',
        ),
      );
      booked.append(row);
    }
  } catch (error) {
    message(error.message || 'We could not load your account. Please refresh.', 'error');
  }
}

async function book(slot, button) {
  if (!confirm(`Use one credit to book ${ukTime(slot.starts_at)}?`)) return;
  button.disabled = true;
  button.textContent = 'Booking…';
  try {
    const response = await privateFetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: slot.id }),
    });
    const result = await response.json();
    message(
      response.ok && response.status !== 202
        ? 'Booked! Your session is on Darryl’s calendar and one credit was used.'
        : result.error || 'Booking failed. Please refresh.',
      response.ok ? 'success' : 'error',
    );
  } catch {
    message('Booking could not be completed. Please refresh before trying again.', 'error');
  }
  await refresh();
}

$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!auth) return message('Account sign-in is not configured yet.', 'error');
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  button.textContent = 'Please wait…';
  $('#auth-error').textContent = '';
  try {
    const email = $('#email').value.trim();
    const password = $('#password').value;
    const result =
      $('#auth-mode').value === 'create'
        ? await auth.signUp.email({ email, password, name: $('#name').value.trim() })
        : await auth.signIn.email({ email, password });
    if (result.error) throw result.error;
    message(
      $('#auth-mode').value === 'create'
        ? 'Account created. Check your email for next steps, then sign in.'
        : 'Signed in successfully.',
      'success',
    );
    await refresh();
  } catch {
    $('#auth-error').textContent =
      'We could not complete sign-in. Check your details and try again.';
  } finally {
    button.disabled = false;
    button.textContent = $('#auth-mode').value === 'create' ? 'Create account' : 'Sign in';
  }
});

$('#auth-mode').addEventListener('change', () => {
  const creating = $('#auth-mode').value === 'create';
  $('#name-field').hidden = !creating;
  $('#name').required = creating;
  $('#password').autocomplete = creating ? 'new-password' : 'current-password';
  $('#auth-form button').textContent = creating ? 'Create account' : 'Sign in';
});

$('#forgot-password').addEventListener('click', async () => {
  const email = $('#email').value.trim();
  if (!$('#email').reportValidity() || !email) return;
  if (!auth) return message('Account recovery is not configured yet.', 'error');
  const button = $('#forgot-password');
  button.disabled = true;
  try {
    const result = await auth.requestPasswordReset({
      email,
      redirectTo: `${location.origin}/account.html`,
    });
    if (result.error) throw result.error;
    message('If this email has an account, a password-reset link is on its way.', 'success');
  } catch {
    message('A reset link could not be sent. Please try again later.', 'error');
  } finally {
    button.disabled = false;
  }
});

$('#reset-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!auth || !resetToken) return;
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  $('#reset-error').textContent = '';
  try {
    const result = await auth.resetPassword({
      newPassword: $('#new-password').value,
      token: resetToken,
    });
    if (result.error) throw result.error;
    location.assign('/account.html?reset=success');
  } catch {
    $('#reset-error').textContent = 'This reset link could not be used. Request a new one.';
    button.disabled = false;
  }
});

document.querySelectorAll('[data-pack]').forEach((button) =>
  button.addEventListener('click', async () => {
    button.disabled = true;
    const old = button.textContent;
    button.textContent = 'Opening checkout…';
    try {
      const response = await privateFetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: button.dataset.pack }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error();
      location.assign(result.url);
    } catch {
      message('Checkout could not open. Please refresh and try again.', 'error');
      button.disabled = false;
      button.textContent = old;
    }
  }),
);

$('#sign-out').addEventListener('click', async () => {
  await auth.signOut();
  message('You have signed out.');
  await refresh();
});

const payment = new URLSearchParams(location.search).get('payment');
if (payment === 'success')
  message(
    'Payment received by Stripe. Credits appear after confirmation; refresh in a moment.',
    'success',
  );
if (payment === 'cancelled') message('Checkout was cancelled. You have not been charged.');
if (new URLSearchParams(location.search).get('reset') === 'success')
  message('Password updated. Sign in with your new password.', 'success');
refresh();
