/**
 * Who the mail is from, and that a purchase produces one.
 *
 * The from address is the kind of thing that drifts quietly — it lived as its
 * own literal once and stopped matching the address the site tells people to
 * write to. And a plan that sends nothing looks exactly like a plan that is
 * not working, which is what happened to monitoring.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Typed so `sent.mock.calls[0][0]` is a value tsc will let the tests read. */
interface SentMessage {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{ filename: string }>;
}

const sent = vi.fn(async (_message: SentMessage) => ({ data: { id: 'msg_1' }, error: null }));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sent };
  },
}));

process.env.RESEND_API_KEY ??= 're_test_key';
process.env.NEXT_PUBLIC_SITE_ORIGIN ??= 'https://botready.dev';

const { sendFixpackReady, sendMonitorStarted } = await import('../lib/email');

beforeEach(() => sent.mockClear());
afterEach(() => vi.clearAllMocks());

describe('every email we send', () => {
  it('comes from team@botready.dev, and replies reach the same address', async () => {
    await sendMonitorStarted({ to: 'buyer@example.com', domain: 'example.com' });
    const message = sent.mock.calls[0]?.[0];
    expect(message?.from).toBe('botready.dev <team@botready.dev>');
    expect(message?.replyTo).toBe('team@botready.dev');
  });

  it('goes to the address that paid', async () => {
    await sendMonitorStarted({ to: 'buyer@example.com', domain: 'example.com' });
    expect(sent.mock.calls[0]?.[0]?.to).toBe('buyer@example.com');
  });
});

describe('monitoring', () => {
  it('sends a welcome naming the domain, the dashboard and how to cancel', async () => {
    await sendMonitorStarted({ to: 'buyer@example.com', domain: 'example.com' });
    const message = sent.mock.calls[0]?.[0];
    expect(message?.subject).toContain('example.com');
    expect(message?.text).toContain('/app/example.com');
    // Somebody paying every month must be able to find the way out of it.
    expect(message?.text).toContain('/account/billing');
  });
});

describe('the fix pack', () => {
  it('attaches every file individually, and links the zip rather than attaching it', async () => {
    await sendFixpackReady({
      to: 'buyer@example.com',
      scanId: 'scan-1',
      domain: 'example.com',
      sessionId: 'cs_test_1',
      pack: {
        domain: 'example.com',
        filename: 'botready-example.com.zip',
        archive: new Uint8Array([1, 2, 3]),
        entries: [
          { name: 'robots.txt', content: 'User-agent: *' },
          { name: 'llms.txt', content: '# example.com' },
        ],
        names: ['robots.txt', 'llms.txt'],
        agentPrompt: 'do the thing',
        // Markdown, not a list: assembleFixPack renders it before it gets here.
        punchList: '- [ ] Fix the robots rules',
      } as never,
    });
    const message = sent.mock.calls[0]?.[0];
    // The files, and not the archive. A zip from a sender with no history is
    // the single most spam-triggering thing a first email can carry.
    expect(message?.attachments?.map((a) => a.filename)).toEqual(['robots.txt', 'llms.txt']);
    expect(message?.attachments?.some((a) => a.filename.endsWith('.zip'))).toBe(false);
    // It is still one click away, and the checkout session travels with the
    // link so it opens without an account.
    expect(message?.text).toContain('/api/fixpack/scan-1?session_id=cs_test_1');
  });

  it('does not paste the punch list into the body; it is attached', async () => {
    await sendFixpackReady({
      to: 'buyer@example.com',
      scanId: 'scan-1',
      domain: 'example.com',
      sessionId: 'cs_test_1',
      pack: {
        domain: 'example.com',
        filename: 'botready-example.com.zip',
        archive: new Uint8Array([1]),
        entries: [{ name: 'punch-list.md', content: '# What to fix' }],
        names: ['punch-list.md'],
        agentPrompt: 'do the thing',
        punchList: '# What to fix on example.com\n\n### Replace the robots.txt rules',
      } as never,
    });
    const message = sent.mock.calls[0]?.[0];
    expect(message?.text).not.toContain('### Replace the robots.txt rules');
  });

  it('sends both a text and an HTML part, from the same words', async () => {
    await sendMonitorStarted({ to: 'buyer@example.com', domain: 'example.com' });
    const message = sent.mock.calls[0]?.[0];
    expect(message?.html).toContain('<p style=');
    expect(message?.html).toContain('example.com');
    // The HTML is generated from the text, so they cannot drift apart.
    expect(message?.html).not.toContain('<table');
  });

  it('opens with a greeting rather than a transaction', async () => {
    await sendFixpackReady({ to: 'a@b.com', scanId: 'scan-1', domain: 'x.com', pack: null });
    // Somebody has just handed us money; the first line should read like a
    // person wrote it, not like a receipt printer.
    expect(sent.mock.calls[0]?.[0]?.text.startsWith('Hi!')).toBe(true);
  });

  it('says what to do if it landed in spam', async () => {
    await sendMonitorStarted({ to: 'buyer@example.com', domain: 'example.com' });
    expect(sent.mock.calls[0]?.[0]?.text).toContain('not spam');
  });

  it('still sends when the pack could not be built, because they paid', async () => {
    await sendFixpackReady({ to: 'buyer@example.com', scanId: 'scan-1', domain: 'example.com', pack: null });
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent.mock.calls[0]?.[0]?.attachments ?? []).toHaveLength(0);
  });
});
