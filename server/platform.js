import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import Stripe from 'stripe';

export const packs = Object.freeze({
  one: { credits: 1, pence: 4500, label: '1 session' },
  two: { credits: 2, pence: 8000, label: '2 sessions' },
  eight: { credits: 8, pence: 25000, label: '8 sessions' },
});

let database;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
  database ||= neon(process.env.DATABASE_URL);
  return database;
}

let jwks;
export async function customer(request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token || !process.env.NEON_AUTH_JWKS_URL || !process.env.NEON_AUTH_URL) return null;
  try {
    jwks ||= createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));
    const { payload } = await jwtVerify(token, jwks, { issuer: process.env.NEON_AUTH_URL });
    if (!payload.sub || !/^[0-9a-f-]{36}$/i.test(payload.sub)) return null;
    const rows = await db()`select id, email, "emailVerified" from neon_auth."user"
      where id = ${payload.sub}::uuid and banned is not true limit 1`;
    const user = rows[0];
    return user?.email ? user : null;
  } catch {
    return null;
  }
}

export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe server configuration is missing');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export function siteOrigin() {
  const value = process.env.PUBLIC_SITE_URL;
  if (!value) throw new Error('PUBLIC_SITE_URL is missing');
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost')
    throw new Error('PUBLIC_SITE_URL must use HTTPS');
  return url.origin;
}
