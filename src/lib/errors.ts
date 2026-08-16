/**
 * Turns raw Supabase / fetch errors into a friendly message. When the device
 * is offline or on a weak connection, the underlying error is something
 * cryptic like "Network request failed" or "Failed to fetch" — users should
 * just be told to check their connection.
 */
const NETWORK_HINTS = [
  'network request failed',
  'failed to fetch',
  'network error',
  'fetch failed',
  'timeout',
  'timed out',
  'econnaborted',
  'unable to resolve host',
  'the internet connection appears to be offline',
  'load failed',
];

export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message)
          : '';

  const lower = raw.toLowerCase();
  if (NETWORK_HINTS.some((hint) => lower.includes(hint))) {
    return 'Please check your internet connection and try again.';
  }

  // Common Supabase auth messages, reworded so they actually help the user.
  if (lower.includes('invalid login credentials')) {
    return 'The email or password you entered is incorrect. Please try again.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email first. Check your inbox for the confirmation link.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Please log in instead.';
  }
  if (lower.includes('password should be at least') || lower.includes('password is too short')) {
    return 'Your password is too short. Please use a longer one.';
  }
  if (lower.includes('unable to validate email') || lower.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }
  if (lower.includes('email rate limit') || lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (lower.includes('for security purposes') && lower.includes('seconds')) {
    return 'Please wait a few seconds before trying again.';
  }

  return raw || fallback;
}
