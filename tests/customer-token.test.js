import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { verifyCustomerToken } from '../server/services/customer-token.js';

test('Neon host issuer and audience are accepted, while wrong/expired/unsigned tokens are rejected', async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const origin = 'https://example.neonauth.neon.tech';
  const authUrl = `${origin}/neondb/auth`;
  const subject = '348e0bfd-8d03-4be5-98ac-9dd2ecbcf9e5';
  const sign = (issuer = origin, audience = origin, expiration = '5m') =>
    new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject(subject)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expiration)
      .sign(privateKey);
  assert.equal((await verifyCustomerToken(await sign(), publicKey, authUrl)).sub, subject);
  await assert.rejects(() => verifyCustomerToken('not-a-jwt', publicKey, authUrl));
  for (const token of [
    await sign(authUrl),
    await sign(origin, 'https://other.example'),
    await sign(origin, origin, '-1s'),
  ]) {
    await assert.rejects(() => verifyCustomerToken(token, publicKey, authUrl));
  }
  const other = await generateKeyPair('ES256');
  const validToken = await sign();
  await assert.rejects(() => verifyCustomerToken(validToken, other.publicKey, authUrl));
});
