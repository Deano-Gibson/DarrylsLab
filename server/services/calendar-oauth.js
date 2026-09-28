import { createRemoteJWKSet, jwtVerify } from 'jose';
import { siteOrigin } from '../platform.js';
import { digest, encryptionKey, randomToken, seal, unseal } from './calendar-secrets.js';
import { calendarStore } from './calendar-store.js';

export const calendarScopes = [
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/calendar.events.freebusy',
];
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const safeHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

export function oauthSettings() {
  const origin = siteOrigin();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const ownerEmail = process.env.GOOGLE_OWNER_EMAIL?.trim().toLowerCase();
  if (!clientId || !clientSecret || !ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail))
    throw new Error('Calendar connection is not configured');
  return {
    origin,
    clientId,
    clientSecret,
    ownerEmail,
    key: encryptionKey(),
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    redirectUri: `${origin}/api/google-calendar-callback`,
  };
}

export async function verifyGoogleIdentity(token, config, keys = googleKeys) {
  const { payload } = await jwtVerify(token, keys, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: config.clientId,
    algorithms: ['RS256'],
    requiredClaims: ['sub', 'exp', 'iat', 'nonce', 'email', 'email_verified'],
  });
  return payload;
}

function cookieName(config) {
  return config.origin.startsWith('https:') ? '__Host-dl-calendar' : 'dl-calendar';
}
function cookie(config, value, maxAge = 600) {
  return `${cookieName(config)}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${config.origin.startsWith('https:') ? '; Secure' : ''}`;
}
function browserToken(request, config) {
  return request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName(config)}=`))
    ?.split('=')[1];
}
const validToken = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

// Dependencies are injectable so failure/replay paths can be tested without real consent.
export function calendarOAuth({
  store = calendarStore,
  settings = oauthSettings,
  fetcher = fetch,
  verifyIdentity = verifyGoogleIdentity,
} = {}) {
  function result(config, status) {
    return new Response(null, {
      status: 303,
      headers: {
        ...safeHeaders,
        Location: `${config.origin}/connect-calendar.html?result=${status}`,
        'Set-Cookie': cookie(config, '', 0),
      },
    });
  }
  return {
    async status() {
      try {
        const config = settings();
        const stored = await store.read();
        const connected =
          !!stored &&
          stored.client_id === config.clientId &&
          stored.owner_email === config.ownerEmail;
        if (connected) unseal(stored.refresh_token_encrypted, 'refresh-token', config.key);
        return Response.json({ ready: true, connected }, { headers: safeHeaders });
      } catch {
        return Response.json(
          { ready: false, connected: false },
          { status: 503, headers: safeHeaders },
        );
      }
    },
    async start(request) {
      let config;
      try {
        config = settings();
      } catch {
        return new Response(null, {
          status: 303,
          headers: { ...safeHeaders, Location: '/connect-calendar.html?result=unavailable' },
        });
      }
      if (request.headers.get('origin') !== config.origin)
        return Response.json(
          { error: 'Open the connection page on the website first.' },
          { status: 403, headers: safeHeaders },
        );
      try {
        const state = randomToken();
        const browser = validToken(browserToken(request, config))
          ? browserToken(request, config)
          : randomToken();
        const verifier = randomToken();
        const nonce = randomToken();
        await store.begin({
          stateHash: digest(state),
          browserHash: digest(browser),
          verifierEncrypted: seal(verifier, 'pkce', config.key),
          nonce,
        });
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.search = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          response_type: 'code',
          scope: ['openid', 'email', ...calendarScopes].join(' '),
          access_type: 'offline',
          prompt: 'consent select_account',
          state,
          nonce,
          code_challenge: digest(verifier),
          code_challenge_method: 'S256',
        }).toString();
        return new Response(null, {
          status: 303,
          headers: { ...safeHeaders, Location: url.href, 'Set-Cookie': cookie(config, browser) },
        });
      } catch {
        return result(config, 'unavailable');
      }
    },
    async callback(request) {
      let config;
      try {
        config = settings();
      } catch {
        return new Response(null, {
          status: 303,
          headers: { ...safeHeaders, Location: '/connect-calendar.html?result=unavailable' },
        });
      }
      try {
        const params = new URL(request.url).searchParams;
        const state = params.get('state');
        const browser = browserToken(request, config);
        if (!validToken(state) || !validToken(browser)) return result(config, 'expired');
        // Atomic delete consumes state once, only for its originating browser and TTL.
        const attempt = await store.consume(digest(state), digest(browser));
        if (!attempt) return result(config, 'expired');
        if (params.has('error')) return result(config, 'denied');
        const code = params.get('code');
        if (!code || code.length > 4096) return result(config, 'failed');
        const response = await fetcher('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code',
            code_verifier: unseal(attempt.verifier_encrypted, 'pkce', config.key),
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return result(config, 'failed');
        const tokens = await response.json();
        const identity = await verifyIdentity(tokens.id_token, config);
        if (
          identity.nonce !== attempt.nonce ||
          !identity.sub ||
          (identity.azp && identity.azp !== config.clientId)
        )
          return result(config, 'failed');
        if (identity.email_verified !== true || identity.email?.toLowerCase() !== config.ownerEmail)
          return result(config, 'wrong-account');
        const granted = new Set((tokens.scope || '').split(' '));
        if (!calendarScopes.every((scope) => granted.has(scope)))
          return result(config, 'permissions');
        // Do not report success or overwrite a working connection without offline access.
        if (
          typeof tokens.refresh_token !== 'string' ||
          !tokens.refresh_token ||
          !tokens.access_token
        )
          return result(config, 'offline');
        const check = await fetcher('https://www.googleapis.com/calendar/v3/freeBusy', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeMin: new Date().toISOString(),
            timeMax: new Date(Date.now() + 3600000).toISOString(),
            timeZone: 'Europe/London',
            items: [{ id: config.calendarId }],
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!check.ok) return result(config, 'calendar');
        const calendar = (await check.json()).calendars?.[config.calendarId];
        if (!calendar || calendar.errors?.length) return result(config, 'calendar');
        await store.save({
          clientId: config.clientId,
          subject: identity.sub,
          email: config.ownerEmail,
          calendarId: config.calendarId,
          refreshTokenEncrypted: seal(tokens.refresh_token, 'refresh-token', config.key),
        });
        return result(config, 'connected');
      } catch {
        // Never log OAuth payloads, codes, tokens, or errors that may contain them.
        return result(config, 'failed');
      }
    },
  };
}
