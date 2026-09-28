import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthClient } from '@neondatabase/auth';
import { accountToken, authErrorMessage } from '../src/lib/account-auth.js';

test('the installed Neon SDK supplies the session JWT without calling an unsupported token method', async (t) => {
  const paths = [];
  const token = 'signed.session.jwt';
  t.mock.method(globalThis, 'fetch', async (url) => {
    paths.push(new URL(url).pathname);
    return Response.json(
      { user: { id: 'test-user' }, session: { token: 'opaque-cookie-token' } },
      { headers: { 'set-auth-jwt': token } },
    );
  });
  const auth = createAuthClient('https://auth.example.com/neondb/auth');
  assert.equal(await accountToken(auth), token);
  assert.deepEqual(paths, ['/neondb/auth/get-session']);
});

test('missing sessions and provider failures never become bearer tokens', async () => {
  await assert.rejects(
    () => accountToken({ getSession: async () => ({ data: null }) }),
    /sign in again/,
  );
  const error = { code: 'INVALID_ORIGIN' };
  await assert.rejects(
    () => accountToken({ getSession: async () => ({ error }) }),
    (e) => e === error,
  );
});

test('signup failures explain recovery without exposing raw provider errors', () => {
  assert.match(authErrorMessage({ code: 'user_already_exists' }, true), /Sign in/);
  assert.match(authErrorMessage({ code: 'weak_password' }, true), /8 and 128/);
  assert.match(authErrorMessage({ code: 'invalid_credentials' }), /incorrect/);
  assert.match(authErrorMessage({ body: { code: 'INVALID_ORIGIN' } }), /website address/);
  assert.match(authErrorMessage({ status: 429 }), /wait/);
  assert.doesNotMatch(authErrorMessage({ message: 'SECRET_PROVIDER_PAYLOAD' }, true), /SECRET/);
});
