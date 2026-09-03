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

export async function enqueueScan(job: QueuedScan): Promise<QueueOutcome> {
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
      // A queued scan that has not started in five minutes is not going to.
      timeout: '30s',
    });
    return { mode: 'qstash', messageId: message.messageId };
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
