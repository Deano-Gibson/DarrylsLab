import { createAuthClient } from '@neondatabase/auth';
import { accountSession, accountToken, authErrorMessage } from '../lib/account-auth.js';

const $ = (selector) => document.querySelector(selector);
const auth = import.meta.env.VITE_NEON_AUTH_URL
  ? createAuthClient(import.meta.env.VITE_NEON_AUTH_URL)
  : null;
const resetToken = new URLSearchParams(location.search).get('token');
let availableSlots = [];
const ukDate = (value) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
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

function renderSlots() {
  const list = $('#slots');
  list.replaceChildren();
  const selected = availableSlots.filter(
    (slot) => ukDate(slot.starts_at) === $('#session-date').value,
  );
  if (!selected.length)
    list.append(el('p', '', 'No available times on this day. Please choose another date.'));
  for (const slot of selected) {
    const button = el('button', 'btn btn-primary btn-sm', 'Book session');
    button.type = 'button';
    button.addEventListener('click', () => book(slot, button));
    const row = el('div', 'slot');
    row.append(el('span', '', ukTime(slot.starts_at)), button);
    list.append(row);
  }
}
$('#session-date').addEventListener('change', renderSlots);

async function privateFetch(path, options = {}) {
  if (!auth) throw new Error('Account sign-in is not configured');
  const token = await accountToken(auth);
  return fetch(path, {
    ...options,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
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
    const session = await accountSession(auth);
    const signedIn = !!session?.user;
    $('#auth-panel').hidden = signedIn;
    $('#member').hidden = !signedIn;
    if (!signedIn) return false;
    $('#member-email').textContent = session.user.email;
    const [accountResponse, slotsResponse] = await Promise.all([
      privateFetch('/api/account'),
      privateFetch('/api/availability'),
    ]);
    if (!accountResponse.ok) {
      if (accountResponse.status === 401) {
        $('#auth-panel').hidden = false;
        $('#member').hidden = true;
      }
      throw new Error('Your account could not be loaded. Please sign in again.');
    }
    const account = await accountResponse.json();
    const availability = await slotsResponse.json();
    const slots = slotsResponse.ok ? availability.slots : null;
    availableSlots = slots || [];
    $('#date-picker').hidden = !slots?.length;
    $('#member-email').textContent = account.email;
    const slotList = $('#slots');
    slotList.replaceChildren();
    if (!slots) {
      slotList.append(
        el(
          'p',
          '',
          availability.code === 'CALENDAR_NOT_CONNECTED'
            ? 'Your account is ready. Booking will open once Darryl finishes connecting his calendar.'
            : 'Availability is temporarily unavailable. Please try again later.',
        ),
      );
    } else if (!slots.length) {
      slotList.append(el('p', '', 'No times are published right now. Please check back soon.'));
    }
    if (slots?.length) {
      const date = $('#session-date');
      date.min = ukDate(slots[0].starts_at);
      date.max = ukDate(slots.at(-1).starts_at);
      if (!date.value || date.value < date.min || date.value > date.max) date.value = date.min;
      renderSlots();
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
    return true;
  } catch (error) {
    $('#date-picker').hidden = true;
    $('#slots').replaceChildren(
      el('p', '', 'Available times could not be loaded. Please refresh to retry.'),
    );
    $('#bookings').replaceChildren(
      el('p', '', 'Your bookings could not be loaded. Please refresh to retry.'),
    );
    message(error.message || 'We could not load your account. Please refresh.', 'error');
    return null;
  }
}

async function book(slot, button) {
  if (
    !confirm(`Book a one-hour session for ${ukTime(slot.starts_at)}? No payment is taken online.`)
  )
    return;
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
        ? 'Booked! Your session is confirmed on Darryl’s calendar. No payment was taken online.'
        : result.error || 'Booking failed. Please refresh.',
      response.status === 202 ? 'info' : response.ok ? 'success' : 'error',
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
  const creating = $('#auth-mode').value === 'create';
  const email = $('#email').value.trim();
  const password = $('#password').value;
  const name = $('#name').value.trim();
  if (creating && !name) {
    $('#auth-error').textContent = 'Enter your name.';
    $('#name').focus();
    return;
  }
  button.disabled = true;
  $('#auth-mode').disabled = true;
  button.textContent = 'Please wait…';
  $('#auth-error').textContent = '';
  message('');
  try {
    const result = creating
      ? await auth.signUp.email(
          { email, password, name, callbackURL: `${location.origin}/account.html` },
          { timeout: 15000 },
        )
      : await auth.signIn.email({ email, password }, { timeout: 15000 });
    if (result.error) throw result.error;
    $('#password').value = '';
    message(
      creating
        ? 'Account created. You’re signed in and ready to view available times.'
        : 'Signed in successfully.',
      'success',
    );
    const signedIn = await refresh();
    if (signedIn === false) {
      $('#auth-mode').value = 'sign-in';
      updateAuthMode();
      message(
        creating
          ? 'Account created. Sign in to continue; if email verification is requested, check your inbox.'
          : 'Your session could not be saved. Allow cookies for this site, then sign in again.',
        'info',
      );
    }
  } catch (error) {
    $('#auth-error').textContent = authErrorMessage(error, creating);
  } finally {
    button.disabled = false;
    $('#auth-mode').disabled = false;
    button.textContent = $('#auth-mode').value === 'create' ? 'Create account' : 'Sign in';
  }
});

function updateAuthMode() {
  const creating = $('#auth-mode').value === 'create';
  $('#name-field').hidden = !creating;
  $('#name').required = creating;
  $('#password').autocomplete = creating ? 'new-password' : 'current-password';
  $('#auth-form button').textContent = creating ? 'Create account' : 'Sign in';
  $('#auth-error').textContent = '';
  $('#forgot-password').hidden = creating;
}
$('#auth-mode').addEventListener('change', updateAuthMode);

$('#forgot-password').addEventListener('click', async () => {
  const email = $('#email').value.trim();
  if (!$('#email').reportValidity() || !email) return;
  if (!auth) return message('Account recovery is not configured yet.', 'error');
  const button = $('#forgot-password');
  button.disabled = true;
  try {
    const result = await auth.requestPasswordReset(
      {
        email,
        redirectTo: `${location.origin}/account.html`,
      },
      { timeout: 15000 },
    );
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
    const result = await auth.resetPassword(
      {
        newPassword: $('#new-password').value,
        token: resetToken,
      },
      { timeout: 15000 },
    );
    if (result.error) throw result.error;
    location.assign('/account.html?reset=success');
  } catch {
    $('#reset-error').textContent = 'This reset link could not be used. Request a new one.';
    button.disabled = false;
  }
});

$('#sign-out').addEventListener('click', async () => {
  const button = $('#sign-out');
  button.disabled = true;
  try {
    const result = await auth.signOut({}, { timeout: 15000 });
    if (result.error) throw result.error;
    $('#member-email').textContent = '';
    $('#slots').replaceChildren();
    availableSlots = [];
    $('#date-picker').hidden = true;
    $('#bookings').replaceChildren();
    $('#auth-mode').value = 'sign-in';
    updateAuthMode();
    message('You have signed out.');
    await refresh();
  } catch {
    message('Sign-out could not be completed. Please try again.', 'error');
  } finally {
    button.disabled = false;
  }
});

if (new URLSearchParams(location.search).get('reset') === 'success')
  message('Password updated. Sign in with your new password.', 'success');
updateAuthMode();
refresh();
