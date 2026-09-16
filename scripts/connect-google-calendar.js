// Run locally by Darryl. Never commit or paste the resulting refresh token.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your terminal first.');
  process.exit(1);
}
const redirect = 'http://localhost:8765/callback';
const state = randomBytes(24).toString('hex');
const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
auth.search = new URLSearchParams({
  client_id: GOOGLE_CLIENT_ID,
  redirect_uri: redirect,
  response_type: 'code',
  scope:
    'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.events.freebusy',
  access_type: 'offline',
  prompt: 'consent',
  state,
}).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, redirect);
  if (
    url.pathname !== '/callback' ||
    url.searchParams.get('state') !== state ||
    !url.searchParams.get('code')
  ) {
    res.writeHead(400).end('Authorization failed. Check the terminal and try again.');
    server.close();
    return;
  }
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: url.searchParams.get('code'),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect,
        grant_type: 'authorization_code',
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.refresh_token)
      throw new Error(
        'Google did not return a refresh token; check OAuth client and consent settings.',
      );
    res
      .writeHead(200, { 'Content-Type': 'text/plain' })
      .end('Calendar authorization complete. Return to your terminal.');
    console.log(
      '\nStore this as GOOGLE_REFRESH_TOKEN in your server deployment secrets. Never commit it:\n',
    );
    console.log(data.refresh_token);
  } catch (error) {
    res.writeHead(500).end('Could not complete authorization.');
    console.error(error.message);
  } finally {
    server.close();
  }
});
server.listen(8765, '127.0.0.1', () =>
  console.log(`Open this Google authorization URL in your browser:\n${auth.href}\n`),
);
