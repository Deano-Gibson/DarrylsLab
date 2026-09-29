import { db } from '../platform.js';
export async function hasClientAccess(user, sql = db()) {
  if (!user?.id || user.emailVerified !== true) return false;
  const rows =
    await sql`select user_id from public.client_access where user_id=${user.id}::uuid and revoked_at is null`;
  return rows.length === 1;
}
export const accessRequired = () =>
  Response.json(
    {
      error: 'Darryl needs to approve your client access after your introductory call.',
      code: 'CLIENT_APPROVAL_REQUIRED',
    },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  );
