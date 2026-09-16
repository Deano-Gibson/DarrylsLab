import { admin, packs, siteOrigin, stripeClient } from '../server/platform.js';

export async function POST(request) {
  try {
    const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!bearer) return Response.json({ error: 'Please sign in first.' }, { status: 401 });
    const db = admin();
    const {
      data: { user },
      error,
    } = await db.auth.getUser(bearer);
    if (error || !user || user.is_anonymous)
      return Response.json({ error: 'Please sign in first.' }, { status: 401 });
    const { pack } = await request.json();
    if (typeof pack !== 'string' || !Object.hasOwn(packs, pack))
      return Response.json({ error: 'Invalid session pack.' }, { status: 400 });
    const chosen = packs[pack];
    const origin = siteOrigin();
    const checkout = await stripeClient().checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { pack, user_id: user.id },
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            unit_amount: chosen.pence,
            product_data: { name: `DL Coaching · ${chosen.label}` },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/account.html?payment=success`,
      cancel_url: `${origin}/account.html?payment=cancelled`,
    });
    return Response.json({ url: checkout.url });
  } catch (error) {
    console.error('Checkout failed', error);
    return Response.json(
      { error: 'Checkout is temporarily unavailable. Please try again.' },
      { status: 500 },
    );
  }
}
