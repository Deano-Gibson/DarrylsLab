const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORAGE_KEY = 'darryls-laboratory-dashboard-v1';

const londonToday = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const todayISO = londonToday();
const toDate = (iso) => new Date(`${iso}T12:00:00`);
const dateISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (iso, days) => { const date = toDate(iso); date.setDate(date.getDate() + days); return dateISO(date); };
const niceDate = (iso, options = {}) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...options }).format(toDate(iso));
const longDate = (iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(toDate(iso));
const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const initials = (name) => name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase();

const seedState = () => ({
  clients: [
    { id: 'c1', name: 'Jamie Morgan', email: 'jamie@example.com', phone: '07700 900321', programme: 'Online coaching', status: 'active', joined: addDays(todayISO, -67), goal: 'Build strength and train consistently', notes: [{ date: addDays(todayISO, -2), text: 'Training is going well. Increase lower-body volume at the next review.' }] },
    { id: 'c2', name: 'Maya Patel', email: 'maya@example.com', phone: '07700 900418', programme: 'Private 1:1', status: 'active', joined: addDays(todayISO, -42), goal: 'Improve technique and confidence', notes: [{ date: addDays(todayISO, -5), text: 'Shoulder mobility improving. Keep overhead work controlled.' }] },
    { id: 'c3', name: 'Tom Williams', email: 'tom@example.com', phone: '07700 900572', programme: '8-week reset', status: 'active', joined: addDays(todayISO, -19), goal: 'Rebuild routine and improve energy', notes: [{ date: addDays(todayISO, -1), text: 'Week three check-in complete. Sleep target is the priority this week.' }] },
    { id: 'c4', name: 'Nina Clarke', email: 'nina@example.com', phone: '07700 900662', programme: 'Consultation', status: 'lead', joined: addDays(todayISO, -4), goal: 'Explore online coaching options', notes: [] },
    { id: 'c5', name: 'Lewis Grant', email: 'lewis@example.com', phone: '07700 900790', programme: 'Online coaching', status: 'active', joined: addDays(todayISO, -93), goal: 'Prepare for first half marathon', notes: [{ date: addDays(todayISO, -10), text: 'Add a lighter deload week after the next long run.' }] },
    { id: 'c6', name: 'Sophie Reed', email: 'sophie@example.com', phone: '07700 900844', programme: 'Consultation', status: 'lead', joined: addDays(todayISO, -1), goal: 'Return to training after a long break', notes: [] }
  ],
  bookings: [
    { id: 'b1', clientId: 'c2', date: todayISO, time: '09:00', type: 'Private coaching', location: 'Portsmouth gym', status: 'confirmed' },
    { id: 'b2', clientId: 'c4', date: todayISO, time: '11:30', type: 'Consultation call', location: 'Online', status: 'confirmed' },
    { id: 'b3', clientId: 'c1', date: todayISO, time: '14:00', type: 'Online check-in', location: 'Online', status: 'confirmed' },
    { id: 'b4', clientId: 'c3', date: addDays(todayISO, 1), time: '10:00', type: 'Progress review', location: 'Online', status: 'confirmed' },
    { id: 'b5', clientId: 'c5', date: addDays(todayISO, 2), time: '08:30', type: 'Online check-in', location: 'Online', status: 'pending' },
    { id: 'b6', clientId: 'c2', date: addDays(todayISO, 5), time: '09:00', type: 'Private coaching', location: 'Portsmouth gym', status: 'confirmed' },
    { id: 'b7', clientId: 'c6', date: addDays(todayISO, 7), time: '12:30', type: 'Consultation call', location: 'Online', status: 'pending' }
  ],
  emails: [
    { id: 'e1', clientId: 'c2', subject: 'Your session is confirmed', preview: 'Your private coaching session is booked.', status: 'opened', date: addDays(todayISO, -1), time: '16:42' },
    { id: 'e2', clientId: 'c1', subject: 'Weekly coaching check-in', preview: 'How has training felt this week?', status: 'needs-reply', date: addDays(todayISO, -2), time: '09:15' },
    { id: 'e3', clientId: 'c4', subject: 'Before our coaching call', preview: 'A few details before we speak.', status: 'sent', date: addDays(todayISO, -1), time: '12:08' },
    { id: 'e4', clientId: 'c3', subject: 'Your progress review reminder', preview: 'A reminder for tomorrow’s review.', status: 'scheduled', date: todayISO, time: '18:00' },
    { id: 'e5', clientId: 'c5', subject: 'Checking in on your programme', preview: 'Let me know how the last long run felt.', status: 'needs-reply', date: addDays(todayISO, -4), time: '10:34' },
    { id: 'e6', clientId: 'c6', subject: 'Thanks for your enquiry', preview: 'Here is what happens next.', status: 'needs-reply', date: addDays(todayISO, -1), time: '15:51' }
  ]
});

let state;
try { state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedState(); } catch { state = seedState(); }
let selectedDate = todayISO;
let calendarMonth = new Date(`${todayISO.slice(0, 7)}-01T12:00:00`);
let selectedClientId = state.clients[0]?.id;
let emailFilter = 'all';
let toastTimer;

const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const clientFor = (id) => state.clients.find((client) => client.id === id);
const bookingsFor = (iso) => state.bookings.filter((booking) => booking.date === iso).sort((a, b) => a.time.localeCompare(b.time));
const typeClass = (type) => type.includes('Online') ? 'online' : type.includes('review') ? 'review' : '';
const showToast = (message) => { const toast = $('[data-toast]'); $('span', toast).textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2800); };

function navigate(view) {
  $$('.view').forEach((section) => { const active = section.dataset.view === view; section.classList.toggle('active', active); section.hidden = !active; });
  $$('.nav-item[data-view-target]').forEach((button) => button.classList.toggle('active', button.dataset.viewTarget === view));
  $('[data-view-title]').textContent = view[0].toUpperCase() + view.slice(1);
  document.body.classList.remove('menu-open');
  if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  if (view === 'calendar') renderCalendar();
  if (view === 'clients') renderClients();
  if (view === 'email') renderEmails();
}

function renderOverview() {
  const nowHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(new Date()));
  $('[data-greeting]').textContent = `${nowHour < 12 ? 'Good morning' : nowHour < 18 ? 'Good afternoon' : 'Good evening'}, Darryl`;
  $('[data-today-label]').textContent = longDate(todayISO);
  const todays = bookingsFor(todayISO);
  const followups = state.emails.filter((email) => email.status === 'needs-reply');
  const weekEnd = addDays(todayISO, 7);
  const weekBookings = state.bookings.filter((booking) => booking.date >= todayISO && booking.date <= weekEnd).length;
  const activeClients = state.clients.filter((client) => client.status === 'active').length;
  $('[data-metrics]').innerHTML = [
    ['Today’s bookings', todays.length, 'Your Portsmouth and online diary', 'calendar', true],
    ['Active clients', activeClients, `${state.clients.length - activeClients} prospective clients`, 'users'],
    ['Follow-ups due', followups.length, 'Clients waiting for a check-in', 'mail'],
    ['Next 7 days', weekBookings, 'Sessions and consultation calls', 'clock']
  ].map(([label, value, meta, icon, accent]) => `<article class="metric${accent ? ' accent' : ''}"><p>${label}</p><strong>${value}</strong><small>${meta}</small><span><svg><use href="#i-${icon}"/></svg></span></article>`).join('');
  $('[data-today-bookings]').innerHTML = todays.length ? todays.map((booking) => {
    const client = clientFor(booking.clientId);
    return `<article class="schedule-item"><time><strong>${booking.time}</strong><span>45 min</span></time><i class="type-line ${typeClass(booking.type)}"></i><div class="person"><span class="avatar">${initials(client.name)}</span><div><strong>${escapeHTML(client.name)}</strong><span>${escapeHTML(booking.type)} · ${escapeHTML(booking.location)}</span></div></div><span class="status ${booking.status}">${booking.status}</span></article>`;
  }).join('') : '<div class="empty"><p><strong>No bookings today.</strong><br>Your diary is clear.</p></div>';
  $('[data-followups]').innerHTML = followups.length ? followups.slice(0, 4).map((email) => {
    const client = clientFor(email.clientId);
    return `<article class="followup"><span class="avatar">${initials(client.name)}</span><div><strong>${escapeHTML(client.name)}</strong><p>${escapeHTML(email.subject)}</p></div><button class="mini-btn" data-followup-client="${client.id}">Follow up</button></article>`;
  }).join('') : '<div class="empty"><p><strong>You’re all caught up.</strong><br>No follow-ups are waiting.</p></div>';
  const activity = [
    ['mail', 'Maya opened an email', 'Session confirmation · yesterday'],
    ['note', 'Note added for Tom', 'Weekly check-in · yesterday'],
    ['calendar', 'Sophie booked a call', 'New consultation · yesterday'],
    ['users', 'Jamie completed a check-in', 'Online coaching · 2 days ago']
  ];
  $('[data-activity]').innerHTML = activity.map(([icon, title, meta]) => `<article class="activity"><span><svg><use href="#i-${icon}"/></svg></span><strong>${title}</strong><p>${meta}</p></article>`).join('');
  $$('[data-followup-count]').forEach((element) => element.textContent = followups.length);
  $$('[data-booking-count]').forEach((element) => element.textContent = weekBookings);
}

function renderCalendar() {
  $('[data-calendar-title]').textContent = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(calendarMonth);
  $('[data-selected-date]').textContent = niceDate(selectedDate, { weekday: 'short' });
  const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first); start.setDate(first.getDate() - offset);
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let html = weekdays.map((day) => `<div class="weekday">${day}</div>`).join('');
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start); date.setDate(start.getDate() + i);
    const iso = dateISO(date); const bookings = bookingsFor(iso);
    html += `<button class="calendar-day${date.getMonth() !== calendarMonth.getMonth() ? ' outside' : ''}${iso === todayISO ? ' today' : ''}${iso === selectedDate ? ' selected' : ''}" data-select-date="${iso}"><span class="day-number">${date.getDate()}</span>${bookings.slice(0, 2).map((booking) => `<span class="cal-event ${typeClass(booking.type)}">${booking.time} ${escapeHTML(clientFor(booking.clientId).name)}</span>`).join('')}${bookings.length > 2 ? `<span class="event-more">+${bookings.length - 2} more</span>` : ''}</button>`;
  }
  $('[data-month-calendar]').innerHTML = html;
  const chosen = bookingsFor(selectedDate);
  $('[data-selected-bookings]').innerHTML = chosen.length ? chosen.map((booking) => `<article class="selected-booking"><time>${booking.time} · 45 min</time><strong>${escapeHTML(clientFor(booking.clientId).name)}</strong><p>${escapeHTML(booking.type)} · ${escapeHTML(booking.location)}</p><span class="status ${booking.status}">${booking.status}</span></article>`).join('') : '<div class="empty"><p><strong>No bookings.</strong><br>This day is available.</p></div>';
  const monthPrefix = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`;
  const groups = [...new Set(state.bookings.filter((booking) => booking.date.startsWith(monthPrefix)).map((booking) => booking.date))].sort();
  $('[data-agenda-calendar]').innerHTML = groups.length ? groups.map((iso) => `<section class="agenda-group"><div class="agenda-date"><strong>${niceDate(iso, { weekday: 'short' })}</strong><span>${bookingsFor(iso).length} booking${bookingsFor(iso).length === 1 ? '' : 's'}</span></div><div class="agenda-events">${bookingsFor(iso).map((booking) => `<article class="agenda-event"><span>${booking.time}</span><div><strong>${escapeHTML(clientFor(booking.clientId).name)}</strong><span>${escapeHTML(booking.type)} · ${escapeHTML(booking.location)}</span></div><span class="status ${booking.status}">${booking.status}</span></article>`).join('')}</div></section>`).join('') : '<div class="empty"><p><strong>No bookings this month.</strong></p></div>';
  $$('[data-select-date]').forEach((button) => button.addEventListener('click', () => { selectedDate = button.dataset.selectDate; renderCalendar(); }));
}

function nextBookingFor(clientId) { return state.bookings.filter((booking) => booking.clientId === clientId && booking.date >= todayISO).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0]; }
function renderClients() {
  const query = ($('[data-client-search]').value || '').toLowerCase();
  const matches = state.clients.filter((client) => `${client.name} ${client.email} ${client.programme}`.toLowerCase().includes(query));
  if (!matches.some((client) => client.id === selectedClientId)) selectedClientId = matches[0]?.id || state.clients[0]?.id;
  $('[data-client-list]').innerHTML = matches.length ? matches.map((client) => {
    const next = nextBookingFor(client.id);
    return `<button class="client-row${client.id === selectedClientId ? ' active' : ''}" data-client-id="${client.id}"><span class="person"><span class="avatar">${initials(client.name)}</span><span><strong>${escapeHTML(client.name)}</strong><small>${escapeHTML(client.email)}</small></span></span><span><strong>${escapeHTML(client.programme)}</strong><small class="status ${client.status}">${client.status}</small></span><span><strong>${next ? niceDate(next.date) : 'Not booked'}</strong><small>${next ? next.time : '—'}</small></span></button>`;
  }).join('') : '<div class="empty"><p><strong>No clients found.</strong><br>Try another search.</p></div>';
  renderClientDetail();
  $$('[data-client-id]').forEach((button) => button.addEventListener('click', () => { selectedClientId = button.dataset.clientId; renderClients(); }));
}

function renderClientDetail() {
  const client = clientFor(selectedClientId); if (!client) return;
  const next = nextBookingFor(client.id);
  const clientEmails = state.emails.filter((email) => email.clientId === client.id);
  $('[data-client-detail]').innerHTML = `<header class="client-hero"><span class="avatar">${initials(client.name)}</span><div><h3>${escapeHTML(client.name)}</h3><p>Client since ${niceDate(client.joined, { year: 'numeric' })}</p></div><span class="status ${client.status}">${client.status}</span></header><div class="client-actions"><button class="button primary" data-client-booking>Book session</button><button class="button secondary" data-client-email>Email client</button></div><div class="client-meta"><div><span>Programme</span><strong>${escapeHTML(client.programme)}</strong></div><div><span>Next session</span><strong>${next ? `${niceDate(next.date)} · ${next.time}` : 'Not booked'}</strong></div><div><span>Goal</span><strong>${escapeHTML(client.goal)}</strong></div><div><span>Email history</span><strong>${clientEmails.length} message${clientEmails.length === 1 ? '' : 's'}</strong></div></div><section class="notes"><h4>Client notes</h4><form class="note-form" data-note-form><label class="sr-only" for="new-note">Add client note</label><input id="new-note" name="note" required placeholder="Add a private note…"><button aria-label="Save note"><svg><use href="#i-plus"/></svg></button></form><div>${client.notes.length ? [...client.notes].reverse().map((note) => `<article class="note"><time>${niceDate(note.date, { year: 'numeric' })}</time><p>${escapeHTML(note.text)}</p></article>`).join('') : '<p class="empty">No notes yet.</p>'}</div></section>`;
  $('[data-client-booking]').addEventListener('click', () => openBooking(client.id));
  $('[data-client-email]').addEventListener('click', () => openCompose(client.id));
  $('[data-note-form]').addEventListener('submit', (event) => { event.preventDefault(); const text = new FormData(event.currentTarget).get('note').trim(); if (!text) return; client.notes.push({ date: todayISO, text }); save(); renderClients(); renderOverview(); showToast(`Note added for ${client.name}.`); });
}

function renderEmails() {
  const query = ($('[data-email-search]').value || '').toLowerCase();
  const needs = state.emails.filter((email) => email.status === 'needs-reply').length;
  const scheduled = state.emails.filter((email) => email.status === 'scheduled').length;
  const opened = state.emails.filter((email) => ['opened', 'replied'].includes(email.status)).length;
  $('[data-email-summary]').innerHTML = [[state.emails.length, 'Emails tracked', 'mail'], [needs, 'Need follow-up', 'clock'], [opened, 'Opened or replied', 'check']].map(([value, label, icon]) => `<article class="email-stat"><span><svg><use href="#i-${icon}"/></svg></span><div><strong>${value}</strong><small>${label}</small></div></article>`).join('');
  const emails = state.emails.filter((email) => (emailFilter === 'all' || (emailFilter === 'sent' ? ['sent', 'opened', 'replied'].includes(email.status) : email.status === emailFilter)) && `${clientFor(email.clientId)?.name} ${email.subject} ${email.preview}`.toLowerCase().includes(query)).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  $('[data-email-list]').innerHTML = emails.length ? emails.map((email) => { const client = clientFor(email.clientId); return `<article class="email-row"><div class="email-recipient"><span class="avatar">${initials(client.name)}</span><div><strong>${escapeHTML(client.name)}</strong><small>${escapeHTML(client.email)}</small></div></div><div class="email-subject"><strong>${escapeHTML(email.subject)}</strong><span>${escapeHTML(email.preview)}</span></div><span class="status ${email.status}">${email.status === 'needs-reply' ? 'Follow-up due' : email.status}</span><time class="email-time">${email.date === todayISO ? 'Today' : niceDate(email.date)} · ${email.time}</time><div class="email-actions">${email.status === 'needs-reply' ? `<button class="mini-btn" data-followup-client="${client.id}">Follow up</button>` : ''}</div></article>`; }).join('') : '<div class="empty"><p><strong>No matching emails.</strong><br>Try another filter or search.</p></div>';
  $$('[data-followup-client]').forEach((button) => button.addEventListener('click', () => openCompose(button.dataset.followupClient)));
}

function populateClientSelects() {
  const options = state.clients.map((client) => `<option value="${client.id}">${escapeHTML(client.name)} — ${escapeHTML(client.programme)}</option>`).join('');
  $('[data-booking-client]').innerHTML = options; $('[data-compose-client]').innerHTML = options;
}
function openBooking(clientId) { populateClientSelects(); const form = $('[data-booking-form]'); form.elements.date.value = selectedDate; if (clientId) form.elements.clientId.value = clientId; $('[data-booking-dialog]').showModal(); }
function openCompose(clientId) { populateClientSelects(); const form = $('[data-compose-form]'); if (clientId) form.elements.clientId.value = clientId; $('[data-compose-dialog]').showModal(); }
function addEmail(status) {
  const form = $('[data-compose-form]'); if (!form.reportValidity()) return;
  const data = new FormData(form); const client = clientFor(data.get('clientId'));
  state.emails.unshift({ id: uid('e'), clientId: client.id, subject: data.get('subject'), preview: data.get('body').trim().replace(/\s+/g, ' ').slice(0, 90), status, date: todayISO, time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()) });
  state.emails.filter((email) => email.clientId === client.id && email.status === 'needs-reply').forEach((email) => { if (email.id !== state.emails[0].id) email.status = 'sent'; });
  save(); $('[data-compose-dialog]').close(); renderAll(); showToast(status === 'scheduled' ? `Email scheduled for ${client.name}.` : `Email logged as sent to ${client.name}.`);
}

$$('[data-view-target]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.viewTarget)));
$$('[data-go-to]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.goTo)));
$$('[data-open-booking]').forEach((button) => button.addEventListener('click', () => openBooking()));
$('[data-open-compose]').addEventListener('click', () => openCompose());
$('[data-menu-open]').addEventListener('click', () => document.body.classList.add('menu-open'));
$$('[data-menu-close]').forEach((element) => element.addEventListener('click', () => document.body.classList.remove('menu-open')));
$('[data-month-prev]').addEventListener('click', () => { calendarMonth.setMonth(calendarMonth.getMonth() - 1); renderCalendar(); });
$('[data-month-next]').addEventListener('click', () => { calendarMonth.setMonth(calendarMonth.getMonth() + 1); renderCalendar(); });
$('[data-month-today]').addEventListener('click', () => { calendarMonth = new Date(`${todayISO.slice(0, 7)}-01T12:00:00`); selectedDate = todayISO; renderCalendar(); });
$$('[data-calendar-mode]').forEach((button) => button.addEventListener('click', () => { $$('[data-calendar-mode]').forEach((item) => item.classList.toggle('active', item === button)); const agenda = button.dataset.calendarMode === 'agenda'; $('[data-month-calendar]').hidden = agenda; $('[data-agenda-calendar]').hidden = !agenda; }));
$('[data-client-search]').addEventListener('input', renderClients);
$('[data-email-search]').addEventListener('input', renderEmails);
$$('[data-email-filter]').forEach((button) => button.addEventListener('click', () => { emailFilter = button.dataset.emailFilter; $$('[data-email-filter]').forEach((item) => item.classList.toggle('active', item === button)); renderEmails(); }));
$('[data-booking-form]').addEventListener('submit', (event) => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return; const data = new FormData(form); const client = clientFor(data.get('clientId'));
  state.bookings.push({ id: uid('b'), clientId: client.id, date: data.get('date'), time: data.get('time'), type: data.get('type'), location: data.get('location'), status: 'confirmed', note: data.get('note') });
  if (data.get('note')) client.notes.push({ date: todayISO, text: `Booking note: ${data.get('note')}` });
  if (data.get('confirmation')) state.emails.unshift({ id: uid('e'), clientId: client.id, subject: 'Your booking is confirmed', preview: `${data.get('type')} on ${longDate(data.get('date'))} at ${data.get('time')}.`, status: 'sent', date: todayISO, time: data.get('time') });
  selectedDate = data.get('date'); calendarMonth = new Date(`${selectedDate.slice(0, 7)}-01T12:00:00`); save(); $('[data-booking-dialog]').close(); form.reset(); renderAll(); navigate('calendar'); showToast(`Booking created for ${client.name}.`);
});
$('[data-compose-form]').addEventListener('submit', (event) => { if (event.submitter?.value === 'cancel') return; event.preventDefault(); addEmail('sent'); });
$('[data-schedule-email]').addEventListener('click', () => addEmail('scheduled'));
$('[data-reset-demo]').addEventListener('click', () => { state = seedState(); save(); selectedClientId = state.clients[0].id; selectedDate = todayISO; renderAll(); showToast('Demo data has been reset.'); });
$$('.modal').forEach((dialog) => dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }));

function renderAll() { populateClientSelects(); renderOverview(); renderCalendar(); renderClients(); renderEmails(); }
renderAll();
const initialView = location.hash.slice(1); navigate(['overview', 'calendar', 'clients', 'email', 'settings'].includes(initialView) ? initialView : 'overview');
