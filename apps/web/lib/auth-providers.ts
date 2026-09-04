import { serverEnv } from './env';

/**
 * Which sign-in methods this Supabase project actually has switched on.
 *
 * Supabase decides this, not us, and it can be changed in a dashboard without
 * anything here being redeployed. Until we asked, the sign-in page showed a
 * Google button unconditionally — and when the provider is off, clicking it
 * sends the person to Supabase, which answers with a raw JSON body:
 *
 *   {"code":400,"error_code":"validation_failed",
 *    "msg":"Unsupported provider: provider is not enabled"}
 *
 * That is a dead end on someone else's domain, with no header, no way back and
 * nothing they can act on. A button that cannot work should not be on the page.
 *
 * Since Google is now the only way in, the answer also decides whether there is
 * a sign-in page at all — so a false positive costs someone that JSON page, and
 * a false negative costs them a sentence saying to come back shortly. Both are
 * better than the JSON.
 *
 * `/auth/v1/settings` is a public endpoint of the project and needs only the
 * publishable key, which is the key designed to be shipped to browsers.
 */

const CACHE_SECONDS = 300;

export interface AuthProviders {
  google: boolean;
}

/** Everything off, which is what we assume when we cannot ask. */
const NONE: AuthProviders = { google: false };

export async function authProviders(): Promise<AuthProviders> {
  let url: string;
  let key: string;
  try {
    url = serverEnv.supabaseUrl();
    key = serverEnv.supabaseAnonKey();
  } catch {
    return NONE;
  }

  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      // Re-asked every few minutes rather than on every render: this changes
      // about once in the life of a project, and the sign-in page should not
      // wait on a third party to paint.
      next: { revalidate: CACHE_SECONDS },
    });
    if (!response.ok) return NONE;
    const body = (await response.json()) as { external?: Record<string, unknown> };
    return { google: body.external?.google === true };
  } catch {
    // A network failure is not evidence that Google is available, and showing a
    // button that might 400 is worse than a sentence saying to come back.
    return NONE;
  }
}
