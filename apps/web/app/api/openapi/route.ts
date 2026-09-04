import { NextResponse } from 'next/server';

import { httpDate, newestUpdate } from '@/lib/content';
import { LIMITS, SITE, absoluteUrl } from '@/lib/site';

/**
 * The public API, described. Two endpoints, both of which anyone can call
 * without a key, and both of which already exist — this file is written by
 * hand from the routes rather than generated, and a test calls the endpoints it
 * describes so a drift is a failure rather than a discovery.
 */
export const dynamic = 'force-static';

export function GET() {
  const document = {
    openapi: '3.1.0',
    info: {
      title: `${SITE.name} scan API`,
      version: '1.0.0',
      description:
        'Start a scan of a URL and read the result. No key, no account. A result less than 24 hours old is returned rather than crawled again.',
      contact: { name: 'botready.dev', url: absoluteUrl('/docs') },
    },
    servers: [{ url: SITE.origin }],
    paths: {
      '/api/scan': {
        post: {
          operationId: 'startScan',
          summary: 'Start a scan, or return a recent one.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['url'],
                  properties: {
                    url: { type: 'string', format: 'uri', description: 'The page to scan. https only.' },
                    force: {
                      type: 'boolean',
                      description: `Crawl again inside the ${LIMITS.cacheHours}-hour window. Honoured only for the person who has claimed the domain.`,
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Queued, or answered from a recent scan.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['scanId', 'cached', 'domain'],
                    properties: {
                      scanId: { type: 'string', format: 'uuid' },
                      cached: { type: 'boolean' },
                      domain: { type: 'string' },
                    },
                  },
                },
              },
            },
            '400': { description: 'The URL was not one we will open.' },
            '429': {
              description: `Rate limited. ${LIMITS.anonymousScansPerHour} an hour anonymously, ${LIMITS.signedInScansPerHour} signed in.`,
            },
          },
        },
      },
      '/api/scan/{scanId}': {
        get: {
          operationId: 'readScan',
          summary: 'Read a scan, whether or not it has finished.',
          parameters: [
            { name: 'scanId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'The scan. `settled` is false while checks are still landing.',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Scan' } } },
            },
            '404': { description: 'No scan with that id.' },
          },
        },
      },
    },
    components: {
      schemas: {
        Scan: {
          type: 'object',
          required: ['scanId', 'status', 'settled', 'scannerVersion'],
          properties: {
            scanId: { type: 'string', format: 'uuid' },
            domain: { type: ['string', 'null'] },
            url: { type: 'string', format: 'uri' },
            status: { type: 'string', enum: ['queued', 'running', 'complete', 'error'] },
            settled: { type: 'boolean' },
            scannerVersion: { type: 'string' },
            pagesCrawled: { type: 'integer' },
            errorMessage: { type: ['string', 'null'] },
            startedAt: { type: ['string', 'null'], format: 'date-time' },
            finishedAt: { type: ['string', 'null'], format: 'date-time' },
            checksComplete: { type: 'integer' },
            progress: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  status: { type: 'string', enum: ['pass', 'warn', 'fail', 'error', 'skip'] },
                },
              },
            },
            score: { $ref: '#/components/schemas/Score' },
          },
        },
        Score: {
          type: ['object', 'null'],
          required: ['total', 'grade', 'scoringVersion'],
          properties: {
            total: { type: 'integer', minimum: 0, maximum: 100 },
            grade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] },
            scoringVersion: { type: 'string' },
            categoryScores: { type: 'object', additionalProperties: { type: 'number' } },
            failedChecks: { type: 'array', items: { type: 'string' } },
            erroredChecks: { type: 'array', items: { type: 'string' } },
            skippedChecks: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  };

  return NextResponse.json(document, {
    headers: {
      'last-modified': httpDate(newestUpdate()),
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
