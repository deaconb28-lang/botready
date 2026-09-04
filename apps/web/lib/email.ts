/**
 * Resend. Two emails in the whole product: the fix pack is ready, and a monitor
 * alert. Neither is optional, but both degrade: if RESEND_API_KEY is unset the
 * send is logged and skipped rather than throwing, because the purchase already
 * happened and the entitlement is already granted by the time this runs.
 */

import { serverEnv } from './env';
import { CONTACT_EMAIL, absoluteUrl, SITE } from './site';

/** From lib/site.ts, so the address people are told to write to is the address
 *  a reply actually reaches. These were separate literals once and drifted. */
const FROM = `botready.dev <${CONTACT_EMAIL}>`;

const REPLY_TO = CONTACT_EMAIL;

interface Attachment {
  filename: string;
  content: Uint8Array;
}

async function send(message: {
  to: string;
  subject: string;
  text: string;
  attachments?: Attachment[];
}): Promise<void> {
  const key = serverEnv.resendApiKey();
  if (!key) {
    console.warn(`[email] RESEND_API_KEY unset; would have sent "${message.subject}" to ${message.to}`);
    return;
  }
  const { Resend } = await import('resend');
  const resend = new Resend(key);
  await resend.emails.send({
    from: FROM,
    replyTo: REPLY_TO,
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.attachments?.length
      ? { attachments: message.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content) })) }
      : {}),
  });
}

/**
 * The purchase email, with the files attached.
 *
 * It used to send a link and nothing else, and the link needs a session — which
 * since sign-in became Google-only means a buyer whose Stripe address is not a
 * Google account could pay us and never reach what they bought. Attaching the
 * pack removes the account from the path entirely: the thing they paid for is
 * in the message.
 *
 * The link stays, because a zip in an inbox is easy to lose and the result page
 * is where re-running the check lives. It is the second way in now rather than
 * the only one.
 *
 * The attachment is best effort in one direction only: if the pack cannot be
 * built we still send the email, because a purchase confirmation that never
 * arrives is worse than one without its files.
 */
export async function sendFixpackReady(opts: {
  to: string;
  scanId: string;
  domain: string | null;
  pack?: { filename: string; archive: Uint8Array; names: string[] } | null;
}): Promise<void> {
  const link = absoluteUrl(`/scan/${opts.scanId}`);
  const site = opts.domain ?? 'your site';
  const pack = opts.pack ?? null;

  await send({
    to: opts.to,
    subject: `Your fix pack for ${site} is ready`,
    attachments: pack ? [{ filename: pack.filename, content: pack.archive }] : [],
    text: [
      `Thanks. The fix pack for ${site} is attached to this email.`,
      '',
      ...(pack
        ? [`${pack.filename} contains:`, '', ...pack.names.map((n) => `  ${n}`), '']
        : [
            'The files did not generate on our side, which is our problem and not yours.',
            'Reply to this email and we will send them within the day.',
            '',
          ]),
      'The result it came from, where you can re-run the check after each change:',
      link,
      '',
      'Everything in the pack was built from the scan itself. Re-run the check after',
      'each change rather than after all of them: the only proof a client can read',
      'your site is that it did.',
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
