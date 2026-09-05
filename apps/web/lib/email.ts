/**
 * Resend, and nothing else. This file is the only place in the product that
 * sends mail, and both callers are server-side: the Stripe webhook and the
 * monitor cron.
 *
 * There was briefly a Supabase edge function that also called Resend. It is
 * gone. Mail belongs where the key and the fix pack generator already are —
 * `packages/core` builds the pack and Deno could not import it, so the function
 * could only ever send a link to files it was unable to attach. One sender is
 * also one place to look when a customer says an email did not arrive.
 *
 * Supabase's own mailer is a separate thing and is not used: sign-in is Google
 * only, so nothing in the app asks Supabase to send anything.
 *
 * Two emails in the whole product: the fix pack is ready, and a monitor alert.
 * Neither is optional, but both degrade — if RESEND_API_KEY is unset the send
 * is logged and skipped rather than throwing, because the purchase already
 * happened and the entitlement is already granted by the time this runs.
 */

import { serverEnv } from './env';
import type { AssembledPack } from './fixpack';
import { CONTACT_EMAIL, absoluteUrl, SITE } from './site';

/** From lib/site.ts, so the address people are told to write to is the address
 *  a reply actually reaches. These were separate literals once and drifted. */
const FROM = `botready.dev <${CONTACT_EMAIL}>`;

const REPLY_TO = CONTACT_EMAIL;

interface Attachment {
  filename: string;
  content: Uint8Array | string;
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
      ? {
          attachments: message.attachments.map((a) => ({
            filename: a.filename,
            content: Buffer.from(typeof a.content === 'string' ? Buffer.from(a.content, 'utf8') : a.content),
          })),
        }
      : {}),
  });
}

/**
 * The purchase confirmation, and the whole fix pack with it.
 *
 * Three things go out, and each is here for a different reason.
 *
 * The punch list is in the body, so the email is useful before anything is
 * opened — on a phone, in a queue, wherever the receipt gets read.
 *
 * Every file is attached individually, not only zipped. A .md in an inbox can
 * be read on the spot; the same .md inside a zip cannot be read on a phone at
 * all, and the coding-agent prompt is the piece a buyer most wants to get
 * straight into an editor.
 *
 * The zip goes too, because someone at a desk wants one file and a folder.
 *
 * It used to be a link and nothing else, and the link needs a session — which
 * since sign-in became Google-only meant a buyer whose Stripe address is not a
 * Google account could pay and never reach what they bought. Nothing here needs
 * an account.
 */
export async function sendFixpackReady(opts: {
  to: string;
  scanId: string;
  domain: string | null;
  pack?: AssembledPack | null;
}): Promise<void> {
  const link = absoluteUrl(`/scan/${opts.scanId}`);
  const site = opts.domain ?? 'your site';
  const pack = opts.pack ?? null;

  const attachments: Attachment[] = pack
    ? [
        ...pack.entries.map((e) => ({ filename: e.name, content: e.content })),
        { filename: pack.filename, content: pack.archive },
      ]
    : [];

  await send({
    to: opts.to,
    subject: `Your fix pack for ${site} — ${pack ? `${pack.entries.length} files attached` : 'ready'}`,
    attachments,
    text: [
      `Thanks. Your fix pack for ${site} is attached to this email — every file on its`,
      `own, and ${pack ? pack.filename : 'a zip'} if you would rather have one download.`,
      '',
      ...(pack
        ? [
            'Start with botready-fixes.md. It is a prompt: paste it into Claude Code or',
            'Cursor in the repository that serves the site, and it applies the rest one',
            'commit at a time.',
            '',
            'ATTACHED',
            ...pack.entries.map((e) => `  ${e.name}`),
            '',
            '─────────────────────────────────────────────',
            '',
            pack.punchList.trim(),
            '',
            '─────────────────────────────────────────────',
            '',
          ]
        : [
            'The files did not generate on our side, which is our problem and not yours.',
            'Reply to this email and we will send them within the day.',
            '',
          ]),
      'The result they came from, where you can re-run the check after each change:',
      link,
      '',
      'Everything here was built from the scan itself. Re-run the check after each',
      'change rather than after all of them: the only proof a client can read your',
      'site is that it did.',
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
