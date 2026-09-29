import nodemailer from 'nodemailer';
import { db } from '../platform.js';

export function enquiryMessages(data, coach) {
  return {
    customer: {
      to: data.email,
      replyTo: coach,
      subject: 'Thanks for your enquiry — DL Coaching',
      text: 'Thanks for getting in touch with DL Coaching.\n\nI’ll contact you soon to discuss your goals and arrange an introductory call.\n\nNo session has been booked and no payment has been taken. If you would like to add anything, simply reply to this email.\n\nDarryl\nDL Coaching',
    },
    coach: {
      to: coach,
      replyTo: data.email,
      subject: 'New in-person coaching enquiry — DL Coaching',
      text: `A new enquiry has been saved. Reply to this email to contact the customer and arrange a call.\n\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || 'Not supplied'}\n\nTraining goals:\n${data.goals}\n\nMain goal: ${data.mainGoal}\nTraining experience: ${data.experience}\nHealth screening: ${data.screening}\nHeard about me: ${data.referral || 'Not supplied'}\n\nMessage:\n${data.message || 'Not supplied'}\n\nThey confirmed their information is accurate, acknowledged booking terms, and consented to storing their answers and being contacted. No booking or portal access has been granted.`,
    },
  };
}

export function gmailTransport() {
  const user = process.env.GMAIL_USER || process.env.GOOGLE_OWNER_EMAIL;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

export async function deliverEnquiryEmails(
  enquiryId,
  { sql = db(), transport = gmailTransport() } = {},
) {
  if (!transport) return false;
  const rows = await sql`update public.enquiry_emails set state='sending', attempted_at=now()
    where enquiry_id=${enquiryId}::uuid and state in ('pending','failed') returning id,payload`;
  for (const row of rows) {
    try {
      const result = await transport.sendMail({
        ...row.payload,
        from: {
          name: 'Darryl | DL Coaching',
          address: process.env.GMAIL_USER || process.env.GOOGLE_OWNER_EMAIL,
        },
        messageId: `<${row.id}@dl-coaching.enquiries>`,
      });
      if (!result.accepted?.length) throw new Error('Email not accepted');
      await sql`update public.enquiry_emails set state='sent',sent_at=now() where id=${row.id}::uuid`;
    } catch (error) {
      // SMTP has no idempotency key. Ambiguous sends need operator review, not blind retries.
      const state = ['EAUTH', 'ECONNECTION', 'EDNS'].includes(error.code) ? 'failed' : 'uncertain';
      await sql`update public.enquiry_emails set state=${state} where id=${row.id}::uuid`;
      console.error('Enquiry email requires attention', row.id, state);
    }
  }
  const pending = await sql`select count(*)::int as count from public.enquiry_emails
    where enquiry_id=${enquiryId}::uuid and state <> 'sent'`;
  return pending[0].count === 0;
}
