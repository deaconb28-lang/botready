import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { scoreDetail, type CheckResult } from '@botready/core';

import { alertCopy, diff, shouldAlert, type ScanSnapshot } from '../lib/monitor-diff';

function fixture(name: string): CheckResult[] {
  const path = fileURLToPath(
    new URL(`../../../packages/core/__fixtures__/${name}.json`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, 'utf8')) as CheckResult[];
}

function snapshot(name: string, scanId: string, finishedAt: string): ScanSnapshot {
  const results = fixture(name);
  const detail = scoreDetail(results);
  return { scanId, total: detail.total, categoryScores: detail.categoryScores, results, finishedAt };
}

describe('diff', () => {
  it('sees nothing when nothing changed', () => {
    const a = snapshot('reference-a', 's1', '2026-08-21T06:00:00Z');
    const b = snapshot('reference-a', 's2', '2026-08-28T06:00:00Z');
    const delta = diff(a, b);
    expect(delta.total).toBe(0);
    expect(delta.categoryDrops).toEqual([]);
    expect(delta.newlyRefused).toEqual([]);
    expect(shouldAlert(delta)).toBe(false);
  });

  it('catches the day a WAF rule starts refusing clients that could read the site', () => {
    // Last week everything passed; this week the archetype: four clients 403.
    const before = snapshot('reference-a', 's1', '2026-08-21T06:00:00Z');
    const after = snapshot('waf-blocked-spa', 's2', '2026-08-28T06:00:00Z');
    const delta = diff(before, after);

    expect(delta.newlyRefused.map((r) => r.id).sort()).toEqual(['claudebot', 'googleext', 'gptbot', 'perplexity']);
    expect(delta.newlyRefused[0]?.from).toBe(200);
    expect(delta.newlyRefused[0]?.to).toBe(403);
    expect(delta.categoryDrops[0]?.category).toBe('retrievability');
    expect(delta.total).toBe(50 - 100);
    expect(shouldAlert(delta)).toBe(true);
  });

  it('does not alert on an improvement', () => {
    const before = snapshot('waf-blocked-spa', 's1', '2026-08-21T06:00:00Z');
    const after = snapshot('reference-a', 's2', '2026-08-28T06:00:00Z');
    const delta = diff(before, after);
    expect(delta.total).toBe(50);
    expect(delta.categoryDrops).toEqual([]);
    expect(delta.newlyRefused).toEqual([]);
    expect(shouldAlert(delta)).toBe(false);
  });

  it('ignores a category wobble under five points', () => {
    const a = snapshot('reference-a', 's1', '2026-08-21T06:00:00Z');
    const b = { ...a, scanId: 's2', categoryScores: { ...a.categoryScores, freshness: a.categoryScores.freshness - 4 } };
    expect(shouldAlert(diff(a, b))).toBe(false);
    const c = { ...a, scanId: 's3', categoryScores: { ...a.categoryScores, freshness: a.categoryScores.freshness - 5 } };
    expect(shouldAlert(diff(a, c))).toBe(true);
  });
});

describe('alertCopy', () => {
  it('names the client and the day, in the product\'s voice', () => {
    const before = snapshot('reference-a', 's1', '2026-08-21T06:00:00Z');
    const after = snapshot('waf-blocked-spa', 's2', '2026-08-28T06:00:00Z');
    const copy = alertCopy('linear.app', diff(before, after), '2026-08-28T06:00:00Z');

    expect(copy.headline).toBe('4 clients started being refused on 28 August');
    expect(copy.detail).toMatch(/could read the site last week and cannot now/);
    expect(copy.detail).toMatch(/Retrievability dropped \d+ points overnight/);
    expect(copy.detail).toMatch(/WAF rule was tightened rather than a deploy/);
    expect(`${copy.headline} ${copy.detail}`).not.toMatch(/sorry|apolog/i);
  });

  it('handles a single client, with its name and status', () => {
    const before = snapshot('reference-a', 's1', '2026-08-21T06:00:00Z');
    const after = snapshot('reference-a', 's2', '2026-08-28T06:00:00Z');
    const parity = after.results.find((r) => r.key === 'agent_status_parity');
    if (!parity) throw new Error('no parity');
    const claudebot = (parity.observed.per_agent as Record<string, { status: number }>).claudebot;
    if (!claudebot) throw new Error('no claudebot in fixture');
    claudebot.status = 403;

    const copy = alertCopy('linear.app', diff(before, after), '2026-08-28T06:00:00Z');
    expect(copy.headline).toBe('ClaudeBot started getting 403 on 28 August');
  });
});
