import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { generateKeyPair, SignJWT } from 'jose';
import {
  calendarOAuth,
  calendarScopes,
  verifyGoogleIdentity,
} from '../server/services/calendar-oauth.js';
import { digest, seal, unseal } from '../server/services/calendar-secrets.js';

const config = {
  origin: 'https://coaching.example',
  clientId: 'test-client',
  clientSecret: 'test-secret',
  ownerEmail: 'coach@example.com',
  calendarId: 'primary',
  key: randomBytes(32),
  redirectUri: 'https://coaching.example/api/google-calendar-callback',
};

function harness(options = {}) {
  const attempts = new Map();
  let saved = null;
  let nonce;
  const calls = [];
  const store = {
    async begin(attempt) {
      nonce = attempt.nonce;
      attempts.set(attempt.stateHash, { ...attempt, expires: Date.now() + 600000 });
    },
    async consume(state, browser) {
      const attempt = attempts.get(state);
      if (!attempt || attempt.browserHash !== browser || attempt.expires < Date.now()) return null;
      attempts.delete(state);
      return { verifier_encrypted: attempt.verifierEncrypted, nonce: attempt.nonce };
    },
    async read() {
      return saved;
    },
    async save(connection) {
      if (options.saveFailure) throw new Error('DB unavailable');
      saved = {
        client_id: connection.clientId,
        owner_email: connection.email,
        refresh_token_encrypted: connection.refreshTokenEncrypted,
        google_subject: connection.subject,
      };
    },
  };
  const handlers = calendarOAuth({
    settings: () => config,
    store,
    verifyIdentity: async () => ({
      sub: 'google-owner',
      email: config.ownerEmail,
      email_verified: true,
      nonce,
      ...options.identity,
    }),
    fetcher: async (url, request) => {
      calls.push({ url, request });
      if (options.networkFailure) throw new Error('Network timeout');
      if (url.includes('/token'))
        return Response.json({
          access_token: 'test-access',
          refresh_token: 'test-refresh',
          id_token: 'test-id',
          scope: calendarScopes.join(' '),
          ...options.tokens,
        });
      return Response.json(options.calendar || { calendars: { primary: { busy: [] } } });
    },
  });
  async function start() {
    const response = await handlers.start(
      new Request(`${config.origin}/api/calendar-connect`, {
        method: 'POST',
        headers: { origin: config.origin },
      }),
    );
    const url = new URL(response.headers.get('location'));
    const cookie = response.headers.get('set-cookie').split(';')[0];
    return { response, url, cookie };
  }
  function callback(flow, extra = {}) {
    const params = new URLSearchParams({
      state: flow.url.searchParams.get('state'),
      code: 'test-code',
      ...extra,
    });
    return handlers.callback(
      new Request(`${config.redirectUri}?${params}`, { headers: { cookie: flow.cookie } }),
    );
  }
  return {
    handlers,
    start,
    callback,
    calls,
    attempts,
    get saved() {
      return saved;
    },
  };
}
const outcome = (response) => new URL(response.headers.get('location')).searchParams.get('result');

test('secrets are encrypted with authenticated context and random nonces', () => {
  const encrypted = seal('private-refresh-token', 'refresh-token', config.key);
  assert.equal(unseal(encrypted, 'refresh-token', config.key), 'private-refresh-token');
  assert.equal(encrypted.includes('private-refresh-token'), false);
  assert.notEqual(encrypted, seal('private-refresh-token', 'refresh-token', config.key));
  assert.throws(() => unseal(encrypted, 'pkce', config.key));
  assert.throws(() => unseal(encrypted, 'refresh-token', randomBytes(32)));
  const parts = encrypted.split('.');
  parts[3] = Buffer.from('tampered').toString('base64url');
  assert.throws(() => unseal(parts.join('.'), 'refresh-token', config.key));
});

test('OAuth start enforces same origin, uses PKCE, and keeps secrets out of redirects', async () => {
  const h = harness();
  for (const origin of ['', 'https://attacker.example']) {
    const response = await h.handlers.start(
      new Request(`${config.origin}/api/calendar-connect`, { method: 'POST', headers: { origin } }),
    );
    assert.equal(response.status, 403);
  }
  assert.equal(h.attempts.size, 0);
  const { response, url } = await h.start();
  assert.match(response.headers.get('set-cookie'), /^__Host-.*HttpOnly.*SameSite=Lax.*Secure$/);
  assert.equal(url.searchParams.get('redirect_uri'), config.redirectUri);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.href.includes(config.clientSecret), false);
  assert.equal(url.href.includes(config.ownerEmail), false);
  const attempt = h.attempts.get(digest(url.searchParams.get('state')));
  assert.equal(
    digest(unseal(attempt.verifierEncrypted, 'pkce', config.key)),
    url.searchParams.get('code_challenge'),
  );
});

test('verified owner consent saves encrypted credentials and a replay does not exchange codes', async () => {
  const h = harness();
  const flow = await h.start();
  const response = await h.callback(flow);
  assert.equal(outcome(response), 'connected');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(
    unseal(h.saved.refresh_token_encrypted, 'refresh-token', config.key),
    'test-refresh',
  );
  assert.equal(h.saved.google_subject, 'google-owner');
  assert.equal(h.calls[0].request.body.get('redirect_uri'), config.redirectUri);
  assert.ok(h.calls[0].request.body.get('code_verifier'));
  assert.equal(outcome(await h.callback(flow)), 'expired');
  assert.equal(h.calls.length, 2);
  assert.deepEqual(await (await h.handlers.status()).json(), { ready: true, connected: true });
});

test('wrong browser, expired state, and tampered state cannot connect', async () => {
  for (const variation of ['browser', 'expiry', 'state']) {
    const h = harness();
    const flow = await h.start();
    if (variation === 'browser') flow.cookie = '__Host-dl-calendar=' + 'x'.repeat(43);
    if (variation === 'expiry')
      h.attempts.get(digest(flow.url.searchParams.get('state'))).expires = 0;
    if (variation === 'state') flow.url.searchParams.set('state', 'x'.repeat(43));
    assert.equal(outcome(await h.callback(flow)), 'expired');
    assert.equal(h.calls.length, 0);
    assert.equal(h.saved, null);
  }
});

test('denied consent consumes state without requesting Google tokens', async () => {
  const h = harness();
  const flow = await h.start();
  assert.equal(outcome(await h.callback(flow, { error: 'access_denied' })), 'denied');
  assert.equal(h.calls.length, 0);
  assert.equal(outcome(await h.callback(flow)), 'expired');
});

test('wrong identity, missing permission/token, and provider/storage failures never save a connection', async () => {
  const cases = [
    [{ identity: { email: 'somebody@example.com' } }, 'wrong-account'],
    [{ identity: { email_verified: false } }, 'wrong-account'],
    [{ identity: { nonce: 'wrong' } }, 'failed'],
    [{ identity: { azp: 'another-client' } }, 'failed'],
    [{ tokens: { scope: calendarScopes[0] } }, 'permissions'],
    [{ tokens: { refresh_token: undefined } }, 'offline'],
    [{ calendar: { calendars: { primary: { errors: [{ reason: 'notFound' }] } } } }, 'calendar'],
    [{ networkFailure: true }, 'failed'],
    [{ saveFailure: true }, 'failed'],
  ];
  for (const [options, expected] of cases) {
    const h = harness(options);
    assert.equal(outcome(await h.callback(await h.start())), expected);
    assert.equal(h.saved, null);
  }
});

test('Google ID tokens require a valid signature, issuer, audience, expiry and identity claims', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const claims = { sub: 'owner', email: config.ownerEmail, email_verified: true, nonce: 'nonce' };
  const sign = (
    payload = claims,
    issuer = 'https://accounts.google.com',
    audience = config.clientId,
    expiration = '5m',
  ) =>
    new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expiration)
      .sign(privateKey);
  assert.equal((await verifyGoogleIdentity(await sign(), config, publicKey)).sub, 'owner');
  await assert.rejects(
    verifyGoogleIdentity(await sign(claims, 'https://attacker.example'), config, publicKey),
  );
  await assert.rejects(
    verifyGoogleIdentity(
      await sign(claims, 'https://accounts.google.com', 'other-client'),
      config,
      publicKey,
    ),
  );
  await assert.rejects(
    verifyGoogleIdentity(
      await sign(claims, 'https://accounts.google.com', config.clientId, '-1m'),
      config,
      publicKey,
    ),
  );
  await assert.rejects(verifyGoogleIdentity(await sign({ sub: 'owner' }), config, publicKey));
  const other = await generateKeyPair('RS256');
  await assert.rejects(verifyGoogleIdentity(await sign(), config, other.publicKey));
});

test('missing server configuration fails closed without exposing settings', async () => {
  const h = calendarOAuth({
    settings() {
      throw new Error('secret config');
    },
  });
  const status = await h.status();
  assert.equal(status.status, 503);
  assert.deepEqual(await status.json(), { ready: false, connected: false });
  const response = await h.start(
    new Request(`${config.origin}/api/calendar-connect`, { method: 'POST' }),
  );
  assert.equal(response.headers.get('location'), '/connect-calendar.html?result=unavailable');
});
