const form = document.querySelector('#enquiry-form');
let requestId = crypto.randomUUID();
let previousPayload;
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  const error = document.querySelector('#form-error');
  const data = Object.fromEntries(new FormData(form));
  data.confirmation = form.elements.confirmation.checked;
  data.consent = form.elements.consent.checked;
  const payload = JSON.stringify(data);
  if (previousPayload && previousPayload !== payload) requestId = crypto.randomUUID();
  previousPayload = payload;
  button.disabled = true;
  button.textContent = 'Sending…';
  error.textContent = '';
  try {
    const response = await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, requestId }),
      signal: AbortSignal.timeout(55000),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || 'Your enquiry could not be sent. Please try again.');
    form.hidden = true;
    const success = document.querySelector('#enquiry-success');
    success.hidden = false;
    document.querySelector('#email-status').textContent = result.emailSent
      ? 'A confirmation email is on its way. Please check your junk folder too.'
      : 'Email confirmations are currently unavailable. You do not need to submit again. You can also contact me using the link on this page.';
    success.focus();
  } catch (issue) {
    error.textContent =
      issue.name === 'TimeoutError' || issue instanceof TypeError
        ? 'I couldn’t confirm receipt. Please retry with the same details; this will not create a duplicate enquiry.'
        : issue.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Send my enquiry →';
  }
});
