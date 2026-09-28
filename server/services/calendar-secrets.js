import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export function encryptionKey(value = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY) {
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error('Calendar encryption key is not configured');
  return Buffer.from(value, 'hex');
}

export function seal(value, purpose, key = encryptionKey()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`dl-calendar:v1:${purpose}`));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function unseal(value, purpose, key = encryptionKey()) {
  const [version, iv, tag, ciphertext, extra] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext || extra !== undefined)
    throw new Error('Invalid encrypted calendar credential');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(`dl-calendar:v1:${purpose}`));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export const digest = (value) => createHash('sha256').update(value).digest('base64url');
export const randomToken = () => randomBytes(32).toString('base64url');
