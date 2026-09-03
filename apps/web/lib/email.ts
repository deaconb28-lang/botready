/**
 * Resend. Two emails in the whole product: the fix pack is ready, and a monitor
 * alert. Neither is optional, but both degrade: if RESEND_API_KEY is unset the
 * send is logged and skipped rather than throwing, because the purchase already
 * happened and the entitlement is already granted by the time this runs.
 */

import { serverEnv } from './env';
import { absoluteUrl, SITE } from './site';

const FROM = `botready.dev <hello@botready.dev>`;

async function send(message: { to: string; subject: string; text: string }): Promise<void> {
  const key = serverEnv.resendApiKey();
  if (!key) {
    console.warn(`[email] RESEND_API_KEY unset; would have sent "${message.subject}" to ${message.to}`);
    return;
  }
  const { Resend } = await import('resend');
  const resend = new Resend(key);
  await resend.emails.send({ from: FROM, to: message.to, subject: message.subject, text: message.text });
}

export async function sendFixpackReady(opts: {
  to: string;
  scanId: string;
  domain: string | null;
}): Promise<void> {
  const link = absoluteUrl(`/sign-in?next=${encodeURIComponent(`/scan/${opts.scanId}`)}`);
  await send({
    to: opts.to,
    subject: `Your fix pack for ${opts.domain ?? 'your site'} is ready`,
    text: [
      `Thanks. The fix pack for ${opts.domain ?? 'your scan'} is generated and waiting.`,
      '',
      'Sign in with this address to download it:',
      link,
      '',
      'The link sends you a one-time sign-in email. There is no password.',
      '',
      `Everything in the pack was built from the scan itself. Re-run the check after each change rather than after all of them: the only proof a client can read your site is that it did.`,
      '',
      `— ${SITE.name}`,
    ].join('\n'),
  });
}

export async function sendMonitorAlert(opts: {
  to: string;
  domain: string;
  scanId: string;
  headline: string;
  detail: string;
}): Promise<void> {
  await send({
    to: opts.to,
    subject: `${opts.domain}: ${opts.headline}`,
    text: [
      opts.headline,
      '',
      opts.detail,
      '',
      `The full result: ${absoluteUrl(`/scan/${opts.scanId}`)}`,
      '',
      `— ${SITE.name}`,
    ].join('\n'),
  });
}
