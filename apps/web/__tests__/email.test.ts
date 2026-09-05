/**
 * Who the mail is from, and that a purchase produces one.
 *
 * The from address is the kind of thing that drifts quietly — it lived as its
 * own literal once and stopped matching the address the site tells people to
 * write to. And a plan that sends nothing looks exactly like a plan that is
 * not working, which is what happened to monitoring.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sent = vi.fn(async () => ({ data: { id: 'msg_1' }, error: null }));

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
    const message = sent.mock.calls[0]?.[0] as unknown as { from: string; replyTo: string };
    expect(message.from).toBe('botready.dev <team@botready.dev>');
    expect(message.replyTo).toBe('team@botready.dev');
  });

  it('goes to the address that paid', async () => {
    await sendMonitorStarted({ to: 'buyer@example.com', domain: 'example.com' });
    expect((sent.mock.calls[0]?.[0] as unknown as { to: string }).to).toBe('buyer@example.com');
  });
});

describe('monitoring', () => {
  it('sends a welcome naming the domain, the dashboard and how to cancel', async () => {
    await sendMonitorStarted({ to: 'buyer@example.com', domain: 'example.com' });
    const message = sent.mock.calls[0]?.[0] as unknown as { subject: string; text: string };
    expect(message.subject).toContain('example.com');
    expect(message.text).toContain('/app/example.com');
    // Somebody paying every month must be able to find the way out of it.
    expect(message.text).toContain('/account/billing');
  });
});

describe('the fix pack', () => {
  it('attaches every file individually and the zip, so nothing needs an account to open', async () => {
    await sendFixpackReady({
      to: 'buyer@example.com',
      scanId: 'scan-1',
      domain: 'example.com',
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
    const message = sent.mock.calls[0]?.[0] as unknown as { attachments: Array<{ filename: string }> };
    expect(message.attachments.map((a) => a.filename)).toEqual([
      'robots.txt',
      'llms.txt',
      'botready-example.com.zip',
    ]);
  });

  it('still sends when the pack could not be built, because they paid', async () => {
    await sendFixpackReady({ to: 'buyer@example.com', scanId: 'scan-1', domain: 'example.com', pack: null });
    expect(sent).toHaveBeenCalledTimes(1);
    const message = sent.mock.calls[0]?.[0] as unknown as { attachments?: unknown[] };
    expect(message.attachments ?? []).toHaveLength(0);
  });
});
