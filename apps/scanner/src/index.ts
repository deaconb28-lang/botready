/**
 * The worker's HTTP surface. Three routes and nothing else:
 *
 *   GET  /health   liveness, unauthenticated, so Railway can use it
 *   GET  /version  what this build is, unauthenticated, useful in an incident
 *   POST /scan     run a scan. Authenticated twice over: the shared secret
 *                  header, and the QStash signature when one is present.
 *
 * Two locks rather than one because they defend different things. The shared
 * secret stops anyone who finds the Railway URL. The QStash signature stops
 * anyone who learns the shared secret from queueing work on our infrastructure,
 * which is the failure that actually costs money.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

import { env, requireQstashVerification } from './env';
import { SCANNER_VERSION, USER_AGENT } from './version';
import { queue } from './queue';
import { runScan, type ScanJob } from './scan';
import { log } from './log';

const MAX_REQUEST_BYTES = 64 * 1024;

const server = createServer((req, res) => {
  handle(req, res).catch((err: unknown) => {
    log.error('unhandled request failure', { err: describe(err) });
    if (!res.headersSent) json(res, 500, { error: 'The worker failed to handle the request.' });
    else res.end();
  });
});

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://worker.invalid');
  const route = `${req.method ?? 'GET'} ${url.pathname.replace(/\/+$/, '') || '/'}`;

  switch (route) {
    case 'GET /health':
      return json(res, 200, {
        status: 'ok',
        scannerVersion: SCANNER_VERSION,
        // The gate's limit, so SCANNER_CONCURRENCY can be confirmed from
        // outside rather than inferred from a deploy having happened. It is
        // read at boot, and the only way to see what the running process
        // actually got is to ask the running process.
        concurrency: queue.limit,
        inFlight: queue.inFlight,
        queued: queue.waiting,
        uptimeSeconds: Math.round(process.uptime()),
      });

    case 'GET /version':
      return json(res, 200, { scannerVersion: SCANNER_VERSION, userAgent: USER_AGENT });

    case 'POST /scan':
      return scanRoute(req, res);

    default:
      return json(res, 404, { error: `No route for ${route}.` });
  }
}

async function scanRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Lock one: the shared secret. Checked before the body is read, so an
  // unauthenticated caller cannot make us buffer anything.
  const presented = header(req, 'x-botready-secret');
  if (!presented || !constantTimeEqual(presented, env.sharedSecret)) {
    return json(res, 401, {
      error: 'This endpoint needs the x-botready-secret header.',
    });
  }

  let raw: string;
  try {
    raw = await readBody(req);
  } catch (err) {
    return json(res, 413, { error: describe(err) });
  }

  // Lock two: the QStash signature, over the exact bytes we just read.
  const signature = header(req, 'upstash-signature');
  if (signature) {
    const ok = await verifyQstash(signature, raw);
    if (!ok) {
      return json(res, 401, { error: 'The Upstash-Signature header did not verify.' });
    }
  } else if (requireQstashVerification()) {
    return json(res, 401, {
      error: 'This endpoint only accepts signed QStash deliveries in production.',
    });
  }

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json(res, 400, { error: 'The request body is not JSON.' });
  }

  const job = parseJob(body);
  if ('error' in job) return json(res, 400, { error: job.error });

  // Accept now, work later. QStash gets its 2xx inside its delivery timeout
  // whatever the scan does, and the result page polls for the outcome.
  json(res, 202, { accepted: true, scanId: job.scanId, scannerVersion: SCANNER_VERSION });

  queue
    .run(job.scanId, () => runScan(job))
    .catch((err: unknown) => {
      log.error('scan failed outside its own error handling', {
        scanId: job.scanId,
        err: describe(err),
      });
    });
}

function parseJob(body: unknown): ScanJob | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Expected a JSON object.' };
  const b = body as Record<string, unknown>;
  if (typeof b.scanId !== 'string' || !b.scanId) return { error: 'scanId is required.' };
  if (typeof b.url !== 'string' || !b.url) return { error: 'url is required.' };
  return { scanId: b.scanId, url: b.url };
}

/**
 * Verified with the official receiver so key rotation is handled for us: QStash
 * publishes a current and a next key and either may sign a given delivery.
 */
async function verifyQstash(signature: string, body: string): Promise<boolean> {
  if (!env.qstashCurrentSigningKey || !env.qstashNextSigningKey) {
    log.warn('a signed delivery arrived but no QStash signing keys are configured');
    return false;
  }
  const { Receiver } = await import('@upstash/qstash');
  const receiver = new Receiver({
    currentSigningKey: env.qstashCurrentSigningKey,
    nextSigningKey: env.qstashNextSigningKey,
  });
  try {
    return await receiver.verify({
      signature,
      body,
      ...(env.publicUrl ? { url: new URL('/scan', env.publicUrl).toString() } : {}),
    });
  } catch (err) {
    log.warn('QStash signature verification threw', { err: describe(err) });
    return false;
  }
}

// ------------------------------------------------------------------ plumbing

function header(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        req.destroy();
        reject(new Error(`The request body is larger than ${MAX_REQUEST_BYTES} bytes.`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ------------------------------------------------------------------ lifecycle

server.listen(env.port, () => {
  log.info('worker listening', {
    port: env.port,
    scannerVersion: SCANNER_VERSION,
    userAgent: USER_AGENT,
    concurrency: env.concurrency,
    qstashVerification: requireQstashVerification() ? 'required' : 'optional',
  });
});

let shuttingDown = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info('shutting down', { signal, inFlight: queue.inFlight });
    server.close();
    // Let in-flight scans finish rather than leaving half-written scan rows.
    void queue.drain(25_000).then(async () => {
      const { closeBrowser } = await import('./passes/render');
      await closeBrowser();
      const { closeDb } = await import('./db');
      await closeDb();
      process.exit(0);
    });
  });
}
