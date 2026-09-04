// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'jsr:@supabase/server@^1';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * POST /functions/v1/send-email
 *
 * Sends one of a fixed set of emails to the signed-in person, about their own
 * account. It exists so a person who ran a scan on a phone can put the result
 * in their inbox and act on it from a laptop.
 *
 * Two rules here are not negotiable, and between them they are most of this
 * file:
 *
 *   The recipient is the session's own address. Never a `to` in the body.
 *   The body is a template key. Never caller-supplied HTML.
 *
 * The reason is worth writing down, because the obvious version of this
 * function — read `{ to, subject, html }` from the request and forward it to
 * Resend — is an open relay wearing an auth check. Anyone who can sign in
 * could then send arbitrary markup to arbitrary strangers, from a domain we
 * have verified, and the first person to notice would use it for phishing.
 * `auth: "user"` does not help: an account here is a free magic link. The
 * domain's sending reputation is the asset, and it is the transactional mail
 * that actually matters — a fix pack that does not arrive — that would be
 * collateral.
 *
 * Deploy:  supabase functions deploy send-email
 * Secret:  supabase secrets set RESEND_API_KEY=re_...
 */

// The name of the variable, not the value of it. The original read
// Deno.env.get("re_live_…") — which asks for a variable *named* after the
// key, gets undefined, and sends `Authorization: Bearer undefined` to Resend
// on every request. The `!` is what hid it from the type checker.
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

/** Injected by the platform. No need to set these as secrets. */
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Matches apps/web/lib/email.ts. A reply is a support request; it must land. */
const FROM = 'botready.dev <team@botready.dev>';
const REPLY_TO = 'team@botready.dev';
const SITE = 'https://www.botready.dev';

/** Per person, per hour. They can only mail themselves, so this guards quota. */
const LIMIT_PER_HOUR = 5;

type TemplateKey = 'scan_result';

interface Body {
  template?: unknown;
  scanId?: unknown;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Errors state what went wrong and what to do, and never apologise. */
function problem(status: number, message: string): Response {
  return json({ error: message }, status);
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req: Request) => {
    if (req.method !== 'POST') {
      return problem(405, 'Send a POST with a JSON body.');
    }
    if (!RESEND_API_KEY) {
      // Fail closed and say so in the logs rather than sending `Bearer
      // undefined` and reporting Resend's 401 as if the caller caused it.
      console.error('[send-email] RESEND_API_KEY is not set on this function');
      return problem(503, 'Email is not configured. Nothing was sent.');
    }

    // ------------------------------------------------------------- who
    //
    // From the token, never from the body. This single line is what stops the
    // function being a relay.
    const authorization = req.headers.get('Authorization') ?? '';
    const asUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: auth, error: authError } = await asUser.auth.getUser();
    const recipient = auth?.user?.email;
    const userId = auth?.user?.id;
    if (authError || !recipient || !userId) {
      return problem(401, 'Sign in first. This sends only to your own address.');
    }

    // ------------------------------------------------------------- what
    let body: Body;
    try {
      body = await req.json();
    } catch {
      return problem(400, 'Send a JSON body.');
    }

    const template = body.template;
    if (template !== 'scan_result') {
      return problem(400, 'Unknown template. The only one is "scan_result".');
    }

    const scanId = typeof body.scanId === 'string' ? body.scanId.trim() : '';
    if (!/^[0-9a-f-]{36}$/i.test(scanId)) {
      return problem(400, 'Send the scanId of the result you want emailed.');
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // The scan has to exist, or the email is a link to a 404. Results are
    // public, so there is nothing to authorise here beyond that.
    const { data: scan } = await admin
      .from('scans')
      .select('id, url, sites(domain)')
      .eq('id', scanId)
      .maybeSingle();

    if (!scan) {
      return problem(404, 'No scan with that id.');
    }

    // ------------------------------------------------------------- how often
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('email_sends')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since);

    if ((count ?? 0) >= LIMIT_PER_HOUR) {
      return problem(429, `That is ${LIMIT_PER_HOUR} emails in an hour. Try again later.`);
    }

    // ------------------------------------------------------------- send
    const domain = (scan as { sites?: { domain?: string } | null }).sites?.domain ?? 'your site';
    const link = `${SITE}/scan/${scanId}`;
    const message = scanResult(domain, link);

    let resend: Response;
    try {
      resend = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
          // Resend deduplicates on this, so a double-clicked button sends once.
          'Idempotency-Key': `${userId}:${scanId}`,
        },
        body: JSON.stringify({
          from: FROM,
          reply_to: REPLY_TO,
          to: [recipient],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
    } catch (err) {
      console.error('[send-email] resend unreachable', err);
      return problem(502, 'The email service did not answer. Nothing was sent.');
    }

    if (!resend.ok) {
      // Log their message, return ours: a provider error body can carry the
      // recipient and the key prefix, and neither belongs in a response.
      console.error('[send-email] resend rejected', resend.status, await resend.text());
      return problem(502, 'The email could not be sent. Nothing was charged and nothing was lost.');
    }

    const sent = (await resend.json()) as { id?: string };
    await admin.from('email_sends').insert({ user_id: userId, template, provider_id: sent.id ?? null });

    // The provider's id, and nothing else it said.
    return json({ sent: true, to: recipient, id: sent.id ?? null }, 200);
  }),
};

/** The one template. Plain text is the message; the HTML is the same words. */
function scanResult(domain: string, link: string): { subject: string; text: string; html: string } {
  const subject = `Your BotReady result for ${domain}`;
  const lines = [
    `The scan of ${domain} is here:`,
    '',
    link,
    '',
    'It shows what each of the five clients got back when they asked for your page, and which checks did not pass. The diagnosis is free and the page is public, so you can send it to whoever fixes things.',
    '',
    '— botready.dev',
  ];

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#EDEBFB;font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111318">
<div style="max-width:520px;margin:0 auto;background:#fff;border:2px solid #111318;border-radius:16px;padding:28px">
<p style="margin:0 0 16px">The scan of <strong>${escapeHtml(domain)}</strong> is here:</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#4B44F5;color:#fff;font-weight:700;text-decoration:none;border:2px solid #111318;border-radius:12px;padding:13px 20px">Open the result</a></p>
<p style="margin:0 0 16px;color:#4A4A57">It shows what each of the five clients got back when they asked for your page, and which checks did not pass. The diagnosis is free and the page is public, so you can send it to whoever fixes things.</p>
<p style="margin:0;color:#6B6B7B;font:13px ui-monospace,monospace">botready.dev</p>
</div></body></html>`;

  return { subject, text: lines.join('\n'), html };
}

/** The domain comes from the database, but it started life as user input. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
