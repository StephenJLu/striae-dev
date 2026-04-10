/**
 * Checks whether the given email is permitted to register based on the
 * REGISTRATION_EMAILS secret (a comma-separated list of allowed entries).
 *
 * Each entry may be:
 *   - An exact email address:  user@example.com
 *   - A domain wildcard:       @example.com  (matches any email from that domain)
 *
 * If registrationEmails is empty or unset, all registrations are allowed
 * (backward-compatible — deploys without a members.emails file are unrestricted).
 */
export function isEmailAllowed(email: string, registrationEmails: string): boolean {
  if (!registrationEmails || registrationEmails.trim().length === 0) {
    return true;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const entries = registrationEmails
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  for (const entry of entries) {
    if (entry.startsWith('@')) {
      // Domain wildcard: @example.com matches user@example.com
      if (normalizedEmail.endsWith(entry)) {
        return true;
      }
    } else {
      // Exact email match
      if (normalizedEmail === entry) {
        return true;
      }
    }
  }

  return false;
}
