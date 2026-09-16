import { createClient } from '@supabase/supabase-js';

const $ = (selector) => document.querySelector(selector);
const authPanel = $('#auth-panel');
const member = $('#member');
const notice = $('#notice');
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key) : null;
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
let currentUser = null;

function message(text, type = 'info') {
  notice.textContent = text;
  notice.dataset.type = type;
  notice.hidden = !text;
}

async function refresh() {
  if (!supabase) {
    message('Account setup is not complete yet. Please contact Darryl.', 'error');
    return;
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  currentUser = error ? null : user;
  authPanel.hidden = !!currentUser;
  member.hidden = !currentUser;
  if (!currentUser) return;
  $('#member-email').textContent = currentUser.email || '';
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const [balance, slots, bookings] = await Promise.all([
    supabase.from('session_accounts').select('credits').eq('user_id', currentUser.id).maybeSingle(),
    fetch('/api/availability', {
      headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      cache: 'no-store',
    })
      .then(async (response) =>
        response.ok ? { data: (await response.json()).slots } : { error: true },
      )
      .catch(() => ({ error: true })),
    supabase
      .from('session_bookings')
      .select('id,calendar_status,training_slots(starts_at)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  if (balance.error || bookings.error) {
    message('We could not load your account. Please refresh and try again.', 'error');
    return;
  }
  if (slots.error)
    message(
      'Darryl’s calendar cannot be checked right now. Booking is temporarily unavailable.',
      'error',
    );
  const credits = balance.data?.credits || 0;
  $('#credit-count').textContent = credits;
  const slotList = $('#slots');
  slotList.replaceChildren();
  if (slots.error)
    slotList.append(
      el('p', '', 'Availability is temporarily unavailable. Please try again later.'),
    );
  else if (!slots.data?.length)
    slotList.append(el('p', '', 'No times are published right now. Please check back soon.'));
  for (const slot of slots.data || []) {
    const button = el(
      'button',
      'btn btn-primary btn-sm',
      credits ? 'Book · 1 credit' : 'Buy credits to book',
    );
    button.type = 'button';
    button.disabled = !credits;
    button.addEventListener('click', () => book(slot, button));
    const row = el('div', 'slot');
    row.append(el('span', '', ukTime(slot.starts_at)), button);
    slotList.append(row);
  }
  const booked = $('#bookings');
  booked.replaceChildren();
  if (!bookings.data?.length)
    booked.append(el('p', '', 'No bookings yet. Choose a time above when you are ready.'));
  for (const item of bookings.data || []) {
    const start = item.training_slots?.starts_at;
    if (!start) continue;
    const confirmed = item.calendar_status === 'confirmed';
    const row = el('div', 'booking');
    row.append(
      el('span', '', ukTime(start)),
      el(
        'span',
        confirmed ? 'badge badge-success' : 'badge badge-warning',
        confirmed ? 'Confirmed' : 'Pending calendar confirmation',
      ),
    );
    booked.append(row);
  }
}

function el(tag, className, text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

async function book(slot, button) {
  if (!confirm(`Use one credit to book ${ukTime(slot.starts_at)}?`)) return;
  button.disabled = true;
  button.textContent = 'Booking…';
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const response = await fetch('/api/book', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({ slotId: slot.id }),
    });
    const result = await response.json();
    message(
      response.status === 202
        ? result.error
        : response.ok
          ? 'Booked! Your session is on Darryl’s calendar and one credit was used.'
          : result.error || 'Booking failed. Please refresh.',
      response.ok || response.status === 202 ? 'success' : 'error',
    );
  } catch {
    message(
      'Booking could not be completed. Please refresh your account before trying again.',
      'error',
    );
  }
  await refresh();
}

$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabase) return message('Account setup is not complete yet.', 'error');
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  button.textContent = 'Sending…';
  $('#auth-error').textContent = '';
  const { error } = await supabase.auth.signInWithOtp({
    email: $('#email').value.trim(),
    options: { emailRedirectTo: `${location.origin}/account.html` },
  });
  $('#auth-error').textContent = error
    ? 'We could not send your sign-in link. Please try again shortly.'
    : '';
  if (!error) message('Check your inbox for your secure sign-in link.', 'success');
  button.disabled = false;
  button.textContent = 'Email me a sign-in link';
});

document.querySelectorAll('[data-pack]').forEach((button) =>
  button.addEventListener('click', async () => {
    button.disabled = true;
    const old = button.textContent;
    button.textContent = 'Opening checkout…';
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Signed out');
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pack: button.dataset.pack }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || 'Checkout unavailable');
      location.assign(result.url);
    } catch {
      message('Checkout could not open. Please refresh and try again.', 'error');
      button.disabled = false;
      button.textContent = old;
    }
  }),
);

$('#sign-out').addEventListener('click', async () => {
  await supabase.auth.signOut();
  message('You have signed out.');
  await refresh();
});
const payment = new URLSearchParams(location.search).get('payment');
if (payment === 'success')
  message(
    'You have returned from checkout. Credits appear after Stripe confirms payment; refresh in a moment.',
    'success',
  );
if (payment === 'cancelled') message('Checkout was cancelled. You have not been charged.');
supabase?.auth.onAuthStateChange(() => {
  setTimeout(refresh, 0);
});
refresh();
