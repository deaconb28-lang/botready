import { currentUser } from './auth';

/**
 * Who may see the dashboard.
 *
 * An allowlist of addresses in ADMIN_EMAILS, comma separated. Not a role column
 * on a table, because a role column is a thing an attacker who reaches the
 * database can grant themselves, and this gate guards every scan, every
 * customer address and every purchase on the platform.
 *
 * It fails closed, which is the only decision here that really matters. An
 * unset or empty ADMIN_EMAILS admits nobody, so forgetting to configure it in
 * an environment leaves the dashboard shut rather than open to whoever signs in
 * first. Every other environment variable in this codebase fails toward the
 * generous reading; this one must not, and the difference is that the others
 * degrade a feature while this one would publish the business.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/** The rule, with no request in it, so it can be tested as the rule. */
export function isAdminEmail(email: string | null | undefined, allowed: string[]): boolean {
  const target = email?.trim().toLowerCase();
  if (!target) return false;
  if (allowed.length === 0) return false;
  return allowed.includes(target);
}

/** The signed-in person, if they are on the list. Null otherwise. */
export async function currentAdmin(): Promise<{ id: string; email: string } | null> {
  const user = await currentUser();
  if (!user) return null;
  return isAdminEmail(user.email, adminEmails()) ? user : null;
}
