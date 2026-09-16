import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const packs = Object.freeze({
  one: { credits: 1, pence: 4500, label: '1 session' },
  two: { credits: 2, pence: 8000, label: '2 sessions' },
  eight: { credits: 8, pence: 25000, label: '8 sessions' },
});

export function admin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
    throw new Error('Supabase server configuration is missing');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
