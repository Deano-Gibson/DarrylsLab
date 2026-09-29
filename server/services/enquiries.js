import { createHash, createHmac } from 'node:crypto';
import { db, siteOrigin } from '../platform.js';
import { enquiryMessages, deliverEnquiryEmails } from './enquiry-mail.js';

export function validateEnquiry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Check the form and try again.');
  const fields = {
    name: [2, 100],
    email: [3, 254],
    phone: [5, 40],
    goals: [5, 600],
    availability: [0, 300],
    message: [0, 1200],
  };
  const data = {};
  for (const [key, [min, max]] of Object.entries(fields)) {
    const value = input[key] ?? '';
    if (
      typeof value !== 'string' ||
      value.trim().length < min ||
      value.length > max ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)
    )
      throw new Error(
        `Please check the ${key === 'availability' ? 'preferred days and times' : key} field.`,
      );
    data[key] = value.trim();
  }

  const options = {
    mainGoal: [
      'Lose body fat',
      'Build muscle',
      'Get stronger',
      'Improve fitness',
      'Improve confidence',
      'Get back into training',
      'General health & wellbeing',
      'Other',
    ],
    experience: ['Complete beginner', 'Beginner', 'Intermediate', 'Experienced'],
    screening: ['Yes', 'No', "I'm a new client and need to complete it"],
    referral: ['', 'Instagram', 'Facebook', 'Google', 'Recommendation', 'Existing client', 'Other'],
  };
  for (const [field, allowed] of Object.entries(options)) {
    const value = input[field] ?? '';
    if (!allowed.includes(value))
      throw new Error(
        'Please select a valid answer for ' +
          {
            mainGoal: 'your main goal',
            experience: 'training experience',
            screening: 'health screening',
            referral: 'how you heard about me',
          }[field] +
          '.',
      );
    data[field] = value;
  }
  if (input.confirmation !== true)
    throw new Error(
      'Please confirm that your information is accurate and your booking is subject to the terms and conditions.',
    );
  data.confirmation = true;
  data.termsVersion = 'enquiry-2026-09-28-v2';
  data.consentVersion = 'intake-v3';
  data.email = data.email.toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email) || /[\r\n]/.test(data.name + data.phone))
    throw new Error('Please enter valid contact details.');
  if (input.consent !== true)
    throw new Error('Please agree to being contacted about your enquiry.');
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.requestId || '',
    )
  )
    throw new Error('Please refresh the page and try again.');
  return data;
}

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export function createEnquiryHandler({
  getSql = db,
  origin = siteOrigin,
  deliver = deliverEnquiryEmails,
} = {}) {
  return async function POST(request) {
    try {
      if (
        ![origin(), 'https://www.darrylslab.com', 'https://darrylslab.com'].includes(
          request.headers.get('origin'),
        )
      )
        return json({ error: 'Please submit the form from this website.' }, 403);
      if (!request.headers.get('content-type')?.startsWith('application/json'))
        return json({ error: 'Invalid form submission.' }, 415);
      if (Number(request.headers.get('content-length')) > 12000)
        return json({ error: 'Your message is too long.' }, 413);
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 12000) return json({ error: 'Your message is too long.' }, 413);
      let input, data;
      try {
        input = JSON.parse(raw);
        if (input?.website) return json({ ok: true, emailSent: false });
        data = validateEnquiry(input);
      } catch (error) {
        return json(
          { error: error instanceof SyntaxError ? 'Invalid form submission.' : error.message },
          400,
        );
      }
      const coach = process.env.GMAIL_USER || process.env.GOOGLE_OWNER_EMAIL;
      const key = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
      if (!coach || !key)
        return json(
          { error: 'Enquiries are temporarily unavailable. Please try again later.' },
          503,
        );
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const ipHash = createHmac('sha256', key)
        .update('enquiry-ip:' + ip)
        .digest('hex');
      const fingerprint = createHash('sha256').update(JSON.stringify(data)).digest('hex');
      const sql = getSql();
      const rows =
        await sql`select public.submit_coaching_enquiry(${input.requestId}::uuid,${fingerprint},${JSON.stringify(data)}::jsonb,${ipHash},${JSON.stringify(enquiryMessages(data, coach))}::jsonb) as id`;
      let emailSent = false;
      try {
        emailSent = await deliver(rows[0].id);
      } catch {
        console.error('Enquiry saved; mail processing requires attention', rows[0].id);
      }
      return json({ ok: true, emailSent });
    } catch (error) {
      if (error.message?.includes('ENQUIRY_RATE_LIMIT'))
        return json(
          { error: 'We have received your recent enquiries. Please wait before sending another.' },
          429,
        );
      if (error.message?.includes('REQUEST_CONFLICT'))
        return json(
          { error: 'This form was already submitted. Refresh to send a new enquiry.' },
          409,
        );
      console.error('Enquiry could not be saved', error.code || 'unknown');
      return json({ error: 'We could not save your enquiry. Please try again.' }, 503);
    }
  };
}
