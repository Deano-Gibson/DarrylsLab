// Run locally by Darryl. Never commit or paste the resulting refresh token.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';

try {
  loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.');
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
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok || !data.refresh_token)
      throw new Error(
        'Google did not return a refresh token; check OAuth client and consent settings.',
      );
    const existing = await readFile('.env', 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return '';
      throw error;
    });
    const entry = `GOOGLE_REFRESH_TOKEN=${data.refresh_token}`;
    const updated = /^GOOGLE_REFRESH_TOKEN=.*$/m.test(existing)
      ? existing.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, () => entry)
      : `${existing.trimEnd()}\n${entry}\n`;
    await writeFile('.env', updated, { mode: 0o600 });
    res
      .writeHead(200, { 'Content-Type': 'text/plain' })
      .end('Calendar authorization complete. Return to your terminal.');
    console.log('Calendar connected. GOOGLE_REFRESH_TOKEN was saved to the ignored .env file.');
    console.log('Add the Google variables to your deployment secrets before deploying.');
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
