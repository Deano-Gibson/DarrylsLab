import { db, fulfillmentPacks as packs, stripeClient } from '../server/platform.js';

export async function POST(request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET)
    return Response.json({ error: 'Missing webhook signature configuration' }, { status: 400 });
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object;
    if (session.payment_status !== 'paid') return Response.json({ received: true });
    const userId = session.client_reference_id;
    const pack = session.metadata?.pack;
    if (
      !userId ||
      !pack ||
      !Object.hasOwn(packs, pack) ||
      session.metadata?.user_id !== userId ||
      session.amount_total !== packs[pack].pence ||
      session.currency !== 'gbp'
    ) {
      console.error('Invalid paid checkout metadata', session.id);
      return Response.json({ error: 'Invalid checkout metadata' }, { status: 500 });
    }
    try {
      await db()`select public.credit_paid_pack(${session.id}, ${userId}::uuid, ${pack})`;
    } catch (error) {
      console.error('Credit fulfillment failed', session.id, error);
      return Response.json({ error: 'Fulfillment failed; retry required' }, { status: 500 });
    }
  }
  return Response.json({ received: true });
}
