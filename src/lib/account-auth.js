export async function accountSession(auth) {
  const result = await auth.getSession({ fetchOptions: { timeout: 15000 } });
  if (result.error) throw result.error;
  return result.data;
}

export async function accountToken(auth) {
  // Neon replaces the session token with the signed JWT returned by set-auth-jwt.
  // createAuthClient exposes Better Auth methods, not the internal getJWTToken helper.
  const session = await accountSession(auth);
  if (!session?.user || !session.session?.token) throw new Error('Please sign in again.');
  return session.session.token;
}

export function authErrorMessage(error, creating = false) {
  const code = String(error?.body?.code || error?.code || '').toUpperCase();
  if (
    ['USER_ALREADY_EXISTS', 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'EMAIL_EXISTS'].includes(code)
  )
    return 'An account already uses this email. Choose Sign in or reset your password.';
  if (['INVALID_EMAIL_OR_PASSWORD', 'INVALID_CREDENTIALS', 'USER_NOT_FOUND'].includes(code))
    return 'The email or password is incorrect. Try again or reset your password.';
  if (['PASSWORD_TOO_SHORT', 'PASSWORD_TOO_LONG', 'WEAK_PASSWORD'].includes(code))
    return 'Use a password between 8 and 128 characters.';
  if (['INVALID_EMAIL', 'EMAIL_ADDRESS_INVALID'].includes(code))
    return 'Enter a valid email address.';
  if (['EMAIL_NOT_VERIFIED', 'EMAIL_NOT_CONFIRMED'].includes(code))
    return 'Verify your email address before signing in. Check your inbox.';
  if (code === 'INVALID_ORIGIN' || code === 'INVALID_CALLBACK_URL')
    return 'Account access is not configured for this website address. Please contact Darryl.';
  if (error?.status === 429 || code.includes('RATE_LIMIT'))
    return 'Too many attempts. Please wait a few minutes before trying again.';
  return creating
    ? 'We could not finish creating your account. Try again, or choose Sign in if you already registered.'
    : 'We could not sign you in. Check your connection and try again.';
}
