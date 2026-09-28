const button = document.querySelector('#connect-button');
const badge = document.querySelector('#connection-badge');
const notice = document.querySelector('#connection-notice');
const retry = document.querySelector('#retry-status');
const result = new URLSearchParams(location.search).get('result');
const messages = {
  connected:
    'Your calendar connection was saved. Confirmed training bookings will appear in your calendar.',
  denied:
    'Google access was not approved. Your existing connection has not changed. You can try again when you’re ready.',
  expired:
    'This connection link expired or was opened in a different browser. Start again using the button below.',
  'wrong-account':
    'This Google account is not the one registered for Darryl. Please reconnect using your registered account.',
  permissions:
    'Calendar access was not fully approved. Try again and allow both calendar permissions.',
  offline:
    'Google did not provide ongoing access. Try connecting again. If this continues, contact Dean for help.',
  calendar:
    'We could not access your calendar. Please ask Dean to check the calendar setup, then try again.',
  failed:
    'We could not save your calendar connection. Please try again. Any previously saved connection is unchanged.',
  unavailable: 'Calendar connection setup is not ready yet. Please contact Dean, then check again.',
};
// Remove the result marker from browser history; no OAuth code or token reaches this page.
if (location.search) history.replaceState(null, '', location.pathname);

function show(text, type = 'info') {
  notice.textContent = text;
  notice.dataset.type = type;
  notice.hidden = !text;
}

async function check() {
  button.disabled = true;
  button.textContent = 'Checking connection…';
  retry.hidden = true;
  try {
    const response = await fetch('/api/calendar-connect', {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    const status = await response.json();
    if (!response.ok || !status.ready) throw new Error();
    badge.textContent = status.connected ? 'Connection saved' : 'Ready to connect';
    badge.className = status.connected ? 'badge badge-success' : 'badge badge-muted';
    button.textContent = status.connected ? 'Reconnect Google Calendar' : 'Connect Google Calendar';
    button.disabled = false;
    if (result === 'connected' && !status.connected) {
      show('We could not verify the saved connection. Please connect again.', 'error');
    } else if (Object.hasOwn(messages, result)) {
      show(messages[result], result === 'connected' ? 'success' : 'info');
    } else {
      show(
        status.connected
          ? 'Your connection is saved. Reconnect if Google access has expired or been removed.'
          : '',
      );
    }
  } catch {
    badge.textContent = 'Setup unavailable';
    badge.className = 'badge badge-warning';
    button.textContent = 'Connection unavailable';
    retry.hidden = false;
    show(
      'We couldn’t check your calendar connection. Try again, or ask Dean to check the setup.',
      'error',
    );
  }
}
retry.addEventListener('click', check);
document.querySelector('#connection-form').addEventListener('submit', () => {
  button.disabled = true;
  button.textContent = 'Opening Google…';
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) check();
});
check();
