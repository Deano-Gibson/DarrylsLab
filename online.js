const ONLINE_STORAGE_KEY = 'darryls-laboratory-dashboard-v1';
const onlineForm = document.querySelector('[data-online-form]');
const onlineError = document.querySelector('[data-online-error]');
const onlineSubmit = document.querySelector('[data-online-submit]');

const onlinePad = (value) => String(value).padStart(2, '0');
const onlineDate = () => { const date = new Date(); return `${date.getFullYear()}-${onlinePad(date.getMonth() + 1)}-${onlinePad(date.getDate())}`; };
const onlineUid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clean = (value) => String(value || '').trim();

function readWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem(ONLINE_STORAGE_KEY));
    if (saved && Array.isArray(saved.clients) && Array.isArray(saved.bookings) && Array.isArray(saved.emails)) return saved;
  } catch (_) {
    // Start with a safe empty demo workspace if local data cannot be read.
  }
  return { clients: [], bookings: [], emails: [] };
}

function saveProfile(profile) {
  const state = readWorkspace();
  const email = profile.email.toLowerCase();
  let client = state.clients.find((item) => item.email.toLowerCase() === email);
  const intakeNotes = [
    `Online intake: ${profile.experience} · Trains at ${profile.location} · Wants to start ${profile.start.toLowerCase()}.`,
    `Support requested: ${profile.support}.`,
    profile.notes ? `Additional context: ${profile.notes}` : ''
  ].filter(Boolean).map((text) => ({ date: onlineDate(), text }));

  if (!client) {
    client = {
      id: onlineUid('c'), name: profile.name, email, phone: profile.phone,
      programme: 'Online coaching', status: 'lead', joined: onlineDate(),
      goal: `${profile.goal}: ${profile.outcome}`, source: profile.source, notes: intakeNotes
    };
    state.clients.push(client);
  } else {
    Object.assign(client, { name: profile.name, phone: profile.phone, programme: 'Online coaching', status: 'lead', goal: `${profile.goal}: ${profile.outcome}`, source: profile.source });
    client.notes = [...(client.notes || []), ...intakeNotes];
  }

  state.emails.unshift({
    id: onlineUid('e'), clientId: client.id, subject: 'Welcome to DL Coaching',
    preview: 'Your online coaching profile has been created and is ready for review.',
    status: 'sent', date: onlineDate(), time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  });
  localStorage.setItem(ONLINE_STORAGE_KEY, JSON.stringify(state));
  return client;
}

function showProfileSuccess(client, profile) {
  document.querySelector('[data-online-form-view]').hidden = true;
  document.querySelector('[data-online-success]').hidden = false;
  document.querySelector('[data-profile-initials]').textContent = client.name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase();
  document.querySelector('[data-profile-name]').textContent = client.name;
  document.querySelector('[data-profile-goal]').textContent = `${profile.goal} · ${profile.experience}`;
  document.querySelector('[data-online-email]').textContent = `For ${client.email}`;
  document.querySelector('#online-profile').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onlineForm.addEventListener('input', () => {
  onlineForm.classList.remove('was-validated');
  onlineError.textContent = '';
});

onlineForm.addEventListener('submit', (event) => {
  event.preventDefault();
  onlineForm.classList.add('was-validated');
  if (!onlineForm.checkValidity()) {
    onlineError.textContent = 'Please complete all required fields to create your coaching profile.';
    onlineForm.querySelector(':invalid')?.focus();
    return;
  }

  const data = new FormData(onlineForm);
  const profile = {
    name: clean(data.get('name')), email: clean(data.get('email')), phone: clean(data.get('phone')),
    goal: data.get('goal'), outcome: clean(data.get('outcome')), experience: data.get('experience'),
    location: data.get('location'), start: data.get('start'), support: data.get('support'),
    notes: clean(data.get('notes')), source: data.get('source') || 'Not provided'
  };

  onlineSubmit.classList.add('loading');
  onlineSubmit.disabled = true;
  window.setTimeout(() => showProfileSuccess(saveProfile(profile), profile), 650);
});

document.querySelector('[data-reset-profile]').addEventListener('click', () => {
  onlineForm.reset();
  onlineForm.classList.remove('was-validated');
  onlineSubmit.classList.remove('loading');
  onlineSubmit.disabled = false;
  document.querySelector('[data-online-success]').hidden = true;
  document.querySelector('[data-online-form-view]').hidden = false;
  document.querySelector('#online-profile').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
