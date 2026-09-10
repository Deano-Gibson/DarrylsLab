const STORAGE_KEY = 'darryls-laboratory-dashboard-v1';
const form = document.querySelector('[data-booking-form]');
const intakeForm = document.querySelector('[data-intake-form]');
const dateInput = form.elements.date;
const timeInput = form.elements.time;
const timeGrid = document.querySelector('[data-time-grid]');
const submitButton = document.querySelector('[data-submit]');
const submitText = document.querySelector('[data-submit-text]');
const selectionSummary = document.querySelector('[data-selection-summary]');
const summaryText = document.querySelector('[data-summary-text]');
const formError = document.querySelector('[data-form-error]');
const londonTimeZone = 'Europe/London';
let confirmedBooking = null;
let clientProfile = null;

const pad = (value) => String(value).padStart(2, '0');
const isoLocal = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDate = (iso) => new Date(`${iso}T12:00:00`);
const escapeText = (value) => String(value || '').trim();
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const formatDay = (iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseDate(iso));
const formatShortDay = (iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(parseDate(iso));
const formatDateNumber = (iso) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(parseDate(iso));

function getDashboardState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.clients) && Array.isArray(saved.bookings) && Array.isArray(saved.emails)) return saved;
  } catch (_) {
    // A clean demo state is created below if saved data is unreadable.
  }
  return { clients: [], bookings: [], emails: [] };
}

function bookedTimesFor(date) {
  return getDashboardState().bookings.filter((booking) => booking.date === date).map((booking) => booking.time);
}

function availableTimesFor(date) {
  const day = parseDate(date).getDay();
  if (day === 0) return [];
  const endHour = day === 6 ? 17 : 19;
  return Array.from({ length: endHour - 6 }, (_, index) => `${pad(index + 6)}:00`);
}

function setInitialDate() {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
  while (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);
  const maxDate = new Date(tomorrow);
  maxDate.setDate(maxDate.getDate() + 60);
  dateInput.min = isoLocal(tomorrow);
  dateInput.max = isoLocal(maxDate);
  dateInput.value = isoLocal(tomorrow);
  renderTimes();
}

function renderTimes() {
  timeInput.value = '';
  const date = dateInput.value;
  selectionSummary.hidden = true;
  document.querySelector('[data-selected-day]').textContent = date ? formatDay(date) : 'Choose a date to see times';

  if (!date) {
    timeGrid.innerHTML = '<div class="time-placeholder">Choose a date to see availability.</div>';
    updateSubmitState();
    return;
  }

  const times = availableTimesFor(date);
  const booked = bookedTimesFor(date);
  if (!times.length) {
    timeGrid.innerHTML = '<div class="time-placeholder">Darryl does not take bookings on Sundays. Please choose another day.</div>';
    updateSubmitState();
    return;
  }

  timeGrid.innerHTML = times.map((time) => {
    const unavailable = booked.includes(time);
    return `<button class="time-slot" type="button" data-time="${time}" ${unavailable ? 'disabled aria-label="' + time + ', unavailable"' : 'aria-label="Select ' + time + '"'}>${time}</button>`;
  }).join('');

  document.querySelectorAll('[data-time]').forEach((button) => button.addEventListener('click', () => selectTime(button.dataset.time)));
  updateSubmitState();
}

function selectTime(time) {
  timeInput.value = time;
  document.querySelectorAll('[data-time]').forEach((button) => {
    const selected = button.dataset.time === time;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  summaryText.textContent = `${formatDay(dateInput.value)} at ${time}`;
  selectionSummary.hidden = false;
  formError.textContent = '';
  updateSubmitState();
}

function updateSubmitState() {
  const ready = Boolean(dateInput.value && timeInput.value);
  submitButton.disabled = !ready;
  submitText.textContent = ready ? 'Confirm booking' : 'Select a date and time';
}

function persistBooking(data, profile) {
  const state = getDashboardState();
  const email = profile.email.toLowerCase();
  let client = state.clients.find((item) => item.email.toLowerCase() === email);
  if (!client) {
    client = {
      id: uid('c'),
      name: profile.name,
      email,
      phone: profile.phone,
      programme: 'In-person session',
      status: 'prospect',
      joined: isoLocal(new Date()),
      goal: `${profile.goal}: ${profile.outcome}`,
      experience: profile.experience,
      healthScreening: profile.screening,
      source: profile.source,
      notes: []
    };
    state.clients.push(client);
  } else {
    client.name = profile.name;
    client.phone = profile.phone;
    client.goal = `${profile.goal}: ${profile.outcome}`;
    client.experience = profile.experience;
    client.healthScreening = profile.screening;
    client.source = profile.source;
  }

  const note = profile.considerations;
  const booking = {
    id: uid('b'),
    clientId: client.id,
    date: data.get('date'),
    time: data.get('time'),
    type: 'In-person PT',
    location: 'PT studio',
    status: 'confirmed',
    note
  };
  state.bookings.push(booking);
  if (note) client.notes.push({ date: isoLocal(new Date()), text: `Booking note: ${note}` });
  client.notes.push({ date: isoLocal(new Date()), text: `Intake: ${profile.experience} · Health screening: ${profile.screening}` });
  state.emails.unshift({
    id: uid('e'),
    clientId: client.id,
    subject: 'Your training session is confirmed',
    preview: `${formatDay(booking.date)} at ${booking.time} · PT studio`,
    status: 'sent',
    date: isoLocal(new Date()),
    time: new Intl.DateTimeFormat('en-GB', { timeZone: londonTimeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return { ...booking, name: client.name, email: client.email };
}

function calendarDates(booking) {
  const compactDate = booking.date.replaceAll('-', '');
  const startHour = Number(booking.time.slice(0, 2));
  return `${compactDate}T${pad(startHour)}0000/${compactDate}T${pad(startHour + 1)}0000`;
}

function googleCalendarUrl(booking) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Personal training with DL Coaching',
    dates: calendarDates(booking),
    ctz: londonTimeZone,
    location: 'PT studio',
    details: 'Your focused 60-minute personal training session with Darryl.'
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function showSuccess(booking) {
  confirmedBooking = booking;
  document.querySelector('[data-form-view]').hidden = true;
  document.querySelector('[data-success-view]').hidden = false;
  document.querySelector('[data-success-day]').textContent = formatShortDay(booking.date);
  document.querySelector('[data-success-date]').textContent = formatDateNumber(booking.date);
  document.querySelector('[data-success-time]').textContent = booking.time;
  document.querySelector('[data-email-destination]').textContent = `For ${booking.email}`;
  document.querySelector('[data-google-calendar]').href = googleCalendarUrl(booking);
  document.querySelector('[data-success-view]').focus?.();
}

function downloadCalendarFile() {
  if (!confirmedBooking) return;
  const booking = confirmedBooking;
  const [start, end] = calendarDates(booking).split('/');
  const content = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Darryls Lab//Booking MVP//EN',
    'BEGIN:VEVENT', `UID:${booking.id}@darrylslab.com`, `DTSTART:${start}`, `DTEND:${end}`,
    'SUMMARY:Personal training with DL Coaching', 'LOCATION:PT studio',
    'DESCRIPTION:Your focused 60-minute personal training session with Darryl.',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `darryls-lab-${booking.date}-${booking.time.replace(':', '')}.ics`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Calendar file downloaded.');
}

function showToast(message) {
  const toast = document.querySelector('[data-toast]');
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2400);
}

dateInput.addEventListener('change', renderTimes);
document.querySelector('[data-change-time]').addEventListener('click', () => {
  document.querySelector('[data-time-grid]').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.querySelector('[data-time]:not(:disabled)')?.focus();
});

intakeForm.addEventListener('input', () => {
  intakeForm.classList.remove('was-validated');
  document.querySelector('[data-intake-error]').textContent = '';
});

intakeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const intakeError = document.querySelector('[data-intake-error]');
  intakeForm.classList.add('was-validated');
  if (!intakeForm.checkValidity()) {
    intakeError.textContent = 'Please complete all required questions before choosing a session.';
    intakeForm.querySelector(':invalid')?.focus();
    return;
  }
  const data = new FormData(intakeForm);
  clientProfile = {
    name: escapeText(data.get('name')),
    email: escapeText(data.get('email')),
    phone: escapeText(data.get('phone')),
    goal: data.get('goal'),
    outcome: escapeText(data.get('outcome')),
    experience: data.get('experience'),
    considerations: escapeText(data.get('considerations')),
    screening: data.get('screening'),
    source: data.get('source') || 'Not provided'
  };
  document.querySelector('[data-client-name]').textContent = clientProfile.name;
  document.querySelector('[data-client-goal]').textContent = `${clientProfile.goal} · ${clientProfile.experience}`;
  document.querySelector('[data-intake-view]').hidden = true;
  document.querySelector('[data-form-view]').hidden = false;
  document.querySelector('#booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.querySelector('[data-edit-details]').addEventListener('click', () => {
  document.querySelector('[data-form-view]').hidden = true;
  document.querySelector('[data-intake-view]').hidden = false;
  document.querySelector('#booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  formError.textContent = '';
  if (!dateInput.value || !timeInput.value) {
    formError.textContent = 'Choose an available date and time to continue.';
    return;
  }
  if (bookedTimesFor(dateInput.value).includes(timeInput.value)) {
    formError.textContent = 'That time has just been reserved. Please choose another slot.';
    renderTimes();
    return;
  }

  submitButton.classList.add('loading');
  submitButton.disabled = true;
  window.setTimeout(() => {
    const booking = persistBooking(new FormData(form), clientProfile);
    submitButton.classList.remove('loading');
    showSuccess(booking);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 650);
});

document.querySelector('[data-download-ics]').addEventListener('click', downloadCalendarFile);
document.querySelector('[data-book-another]').addEventListener('click', () => {
  form.reset();
  intakeForm.reset();
  intakeForm.classList.remove('was-validated');
  document.querySelector('[data-success-view]').hidden = true;
  document.querySelector('[data-form-view]').hidden = true;
  document.querySelector('[data-intake-view]').hidden = false;
  confirmedBooking = null;
  clientProfile = null;
  setInitialDate();
  document.querySelector('#booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

setInitialDate();
