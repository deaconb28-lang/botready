/**
 * Handing a scan to the worker.
 *
 * QStash by preference, because it owns the retries and because the worker
 * verifies its signature, which is what stops anyone who learns the shared
 * secret from queueing work on our infrastructure. When QSTASH_TOKEN is absent
 * — local development — the job is posted straight to the worker with the
 * shared secret, which the worker accepts outside production only.
 */

import { serverEnv } from './env';

export interface QueuedScan {
  scanId: string;
  url: string;
}

export type QueueMode = 'qstash' | 'direct';

export interface QueueOutcome {
  mode: QueueMode;
  messageId?: string;
}

export interface QueueOptions {
  /**
   * Seconds to hold the message before delivery. The nightly index run spreads
   * two hundred scans across an hour with this rather than dropping them all
   * on the worker at once: the worker's own gate would cope, but a queue of
   * 198 accepted jobs waiting in one process is a worse failure mode than a
   * queue of 198 messages waiting in QStash.
   */
  delaySeconds?: number;
}

export async function enqueueScan(job: QueuedScan, options: QueueOptions = {}): Promise<QueueOutcome> {
  const token = serverEnv.qstashToken();
  const target = new URL('/scan', serverEnv.scannerUrl()).toString();

  if (token) {
    const { Client } = await import('@upstash/qstash');
    const qstash = new Client({ token });
    const message = await qstash.publishJSON({
      url: target,
      body: job,
      headers: { 'x-botready-secret': serverEnv.scannerSharedSecret() },
      // The worker answers 202 immediately and works afterwards, so a retry
      // means the delivery failed rather than the scan being slow.
      retries: 2,
      timeout: '30s',
      ...(options.delaySeconds ? { delay: options.delaySeconds } : {}),
      // One scan per id, even if the cron and a person race for the same site.
      deduplicationId: `scan:${job.scanId}`,
    });
    return { mode: 'qstash', messageId: message.messageId };
  }

  // Local: no queue, so a delay is honoured in-process and the caller waits.
  if (options.delaySeconds) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(options.delaySeconds ?? 0, 5) * 1000));
  }

  const response = await fetch(target, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-botready-secret': serverEnv.scannerSharedSecret(),
    },
    body: JSON.stringify(job),
  });

  if (!response.ok) {
    throw new Error(
      `The worker refused the job: HTTP ${response.status} ${await response.text().catch(() => '')}`.trim(),
    );
  }

  return { mode: 'direct' };
}
