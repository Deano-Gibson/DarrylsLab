// Payments are paused. Keep checkout closed even if Stripe keys are configured.
export async function POST() {
  return Response.json(
    { error: 'Online payments are currently unavailable. You can book without paying online.' },
    { status: 403 },
  );
}
