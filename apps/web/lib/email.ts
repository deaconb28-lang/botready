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
 * Three emails in the whole product: the fix pack is ready, monitoring has
 * started, and a monitor alert.
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
    // Both parts, every time. A text-only message from a domain with no
    // sending history reads as machine output to a filter, and these are
    // written as prose anyway — the HTML is the same words with paragraphs.
    html: htmlFrom(message.text),
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
 * The plain text as simple HTML: blank lines become paragraphs, URLs become
 * links, everything else is escaped.
 *
 * Deliberately almost no markup. A newsletter-shaped HTML mail — tables,
 * images, a tracking pixel, a button graphic — is the thing being filtered;
 * one that looks like a person typed it is not. There is one source of words
 * and the two parts cannot disagree, which is also what a filter checks.
 */
function htmlFrom(text: string): string {
  const escape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const linkify = (t: string) =>
    t.replace(/(https?:\/\/[^\s<]+)/g, (url) => `<a href="${url}">${url}</a>`);

  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 16px">${linkify(escape(block)).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return [
    '<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff">',
    '<div style="max-width:560px;font:15px/1.55 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;color:#111318">',
    paragraphs,
    '</div></body></html>',
  ].join('\n');
}

/**
 * The purchase confirmation, and the files with it.
 *
 * This landed in spam on its first send, and the reasons were all in the
 * message rather than in the DNS — botready.dev's DKIM key, SPF and DMARC
 * records all resolve. What a filter saw was a brand new domain sending a
 * text-only mail with nine attachments, one of them a zip, and five kilobytes
 * of markdown headings pasted into the body.
 *
 * So: the zip is a link now rather than an attachment, because a zip from an
 * unknown sender is the single most suspicious thing a first email can carry,
 * and the same download route already accepts the checkout session as proof.
 * The individual files stay attached — they are small, they are text, and they
 * are the thing that was bought.
 *
 * The punch list is a link too. It is attached as punch-list.md and was also
 * pasted into the body in full, which doubled the message size and made it
 * read like output rather than a note.
 *
 * What is left is short enough to read on a phone, has an HTML part, and says
 * once where to look if it did land in spam — marking it not-spam is the only
 * thing that teaches a filter otherwise.
 */
export async function sendFixpackReady(opts: {
  to: string;
  scanId: string;
  domain: string | null;
  pack?: AssembledPack | null;
  /** Lets the download link work without an account. */
  sessionId?: string | null;
}): Promise<void> {
  const link = absoluteUrl(`/scan/${opts.scanId}`);
  const site = opts.domain ?? 'your site';
  const pack = opts.pack ?? null;

  // The files, but not the zip. Nine attachments including an archive is what
  // a filter treats as a payload; eight small text files read as a delivery.
  const attachments: Attachment[] = pack ? pack.entries.map((e) => ({ filename: e.name, content: e.content })) : [];

  // The download works without an account when the checkout session travels
  // with it, which is what somebody who has just paid actually holds.
  const zipLink = opts.sessionId
    ? `${absoluteUrl(`/api/fixpack/${opts.scanId}`)}?session_id=${encodeURIComponent(opts.sessionId)}`
    : absoluteUrl(`/api/fixpack/${opts.scanId}`);

  await send({
    to: opts.to,
    // No file count and no dash. "8 files attached" in a subject line, from a
    // domain nobody has heard from, is a shape filters know.
    subject: `Your fix pack for ${site}`,
    attachments,
    text: [
      'Hi!',
      '',
      `Thanks for buying the fix pack for ${site}. Everything is ready, and it is all attached to this email.`,
      '',
      ...(pack
        ? [
            `Start with botready-fixes.md. It is a prompt, so paste it into Claude Code or Cursor in the repository that serves your site and it will apply the other ${pack.entries.length - 1} files for you, one commit at a time.`,
            '',
            `Would you rather have one download? ${zipLink}`,
            '',
            `Your result is here, and you can re-run the check as often as you like: ${link}`,
            '',
            'One tip: re-run it after each change rather than after all of them. The only proof a client can read your site is that it did.',
          ]
        : [
            'The files did not generate on our side, which is our problem and not yours. Reply to this email and we will get them to you within the day.',
            '',
            `Your result: ${link}`,
          ]),
      '',
      'If this landed in your spam folder, marking it "not spam" is the one thing that stops the next one doing the same. We are a new domain and the filters have not met us yet.',
      '',
      'Good luck with it, and tell us how it goes.',
      '',
      `— ${SITE.name}`,
    ].join('\n'),
  });
}

/**
 * Somebody has just started paying for monitoring.
 *
 * This is the only mail they get until something actually changes on their
 * site, which could be weeks. Paying five dollars a month and hearing nothing
 * at all is indistinguishable from paying five dollars a month for nothing, so
 * it says what was bought, what will arrive, and how to stop it.
 */
export async function sendMonitorStarted(opts: { to: string; domain: string }): Promise<void> {
  await send({
    to: opts.to,
    subject: `Monitoring is on for ${opts.domain}`,
    text: [
      'Hi!',
      '',
      `Thank you. Monitoring is on for ${opts.domain} from today.`,
      '',
      'From here we re-check the site every week as the same five clients, and we',
      'write to you on the day something moves: a category drops, or a client that',
      'could read the site suddenly cannot. If nothing changes you will not hear',
      'from us, which is the point.',
      '',
      `Your dashboard: ${absoluteUrl(`/app/${opts.domain}`)}`,
      `Billing and cancellation: ${absoluteUrl('/account/billing')}`,
      '',
      'If this landed in your spam folder, marking it "not spam" matters more than usual here: the next mail we send you is the one saying something broke.',
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
