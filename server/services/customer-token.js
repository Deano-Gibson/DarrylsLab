import { jwtVerify } from 'jose';

export async function verifyCustomerToken(token, keys, authUrl) {
  // Neon issues tokens for the Auth host, without the database/API path.
  const origin = new URL(authUrl).origin;
  const { payload } = await jwtVerify(token, keys, {
    issuer: origin,
    audience: origin,
    requiredClaims: ['sub', 'exp', 'iat'],
  });
  return payload;
}
