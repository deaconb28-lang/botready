import { describe, expect, it } from 'vitest';

import { isAllowed, parseRobots, productToken } from './robots';
import { ROBOTS_TOKEN, USER_AGENT } from './version';

describe('productToken', () => {
  it('reduces our own user agent string to the token a publisher would write', () => {
    expect(productToken(USER_AGENT)).toBe('botreadybot');
    expect(productToken(USER_AGENT)).toBe(ROBOTS_TOKEN.toLowerCase());
  });
});

describe('parseRobots', () => {
  it('groups consecutive user-agent lines and closes the run on a rule', () => {
    const parsed = parseRobots(
      ['User-agent: a', 'User-agent: b', 'Disallow: /x', 'User-agent: c', 'Allow: /'].join('\n'),
    );
    expect(parsed.groups).toHaveLength(2);
    expect(parsed.groups[0]?.agents).toEqual(['a', 'b']);
    expect(parsed.groups[1]?.agents).toEqual(['c']);
  });

  it('collects sitemap lines and strips comments', () => {
    const parsed = parseRobots(
      ['# a comment', 'Sitemap: https://example.com/sitemap.xml  # trailing', 'User-agent: *'].join(
        '\n',
      ),
    );
    expect(parsed.sitemaps).toEqual(['https://example.com/sitemap.xml']);
  });

  it('reports a line with no field name as a parse error rather than swallowing it', () => {
    const parsed = parseRobots('User-agent: *\nthis is not a directive\nDisallow: /');
    expect(parsed.parseErrors).toHaveLength(1);
    expect(parsed.parseErrors[0]).toContain('line 2');
  });

  it('distinguishes an empty file from one with directives', () => {
    expect(parseRobots('').empty).toBe(true);
    expect(parseRobots('# only a comment').empty).toBe(true);
    expect(parseRobots('User-agent: *').empty).toBe(false);
  });
});

describe('isAllowed', () => {
  const check = (robots: string, path: string, token = ROBOTS_TOKEN) =>
    isAllowed(parseRobots(robots), token, path);

  it('allows everything when there is no robots.txt to speak of', () => {
    expect(check('', '/').allowed).toBe(true);
  });

  it('obeys a blanket disallow aimed at us by name', () => {
    const verdict = check('User-agent: BotreadyBot\nDisallow: /', '/pricing');
    expect(verdict.allowed).toBe(false);
    expect(verdict.matchedRule).toBe('Disallow: /');
    expect(verdict.matchedAgent).toBe('botreadybot');
  });

  it('obeys a blanket disallow aimed at everyone', () => {
    expect(check('User-agent: *\nDisallow: /', '/').allowed).toBe(false);
  });

  it('prefers the group that names us over the wildcard group', () => {
    const robots = [
      'User-agent: *',
      'Disallow: /',
      '',
      'User-agent: BotreadyBot',
      'Allow: /',
    ].join('\n');
    expect(check(robots, '/pricing').allowed).toBe(true);
  });

  it('obeys a disallow aimed at us even when the wildcard group is permissive', () => {
    const robots = [
      'User-agent: *',
      'Allow: /',
      '',
      'User-agent: BotreadyBot',
      'Disallow: /',
    ].join('\n');
    expect(check(robots, '/').allowed).toBe(false);
  });

  it('lets the longest matching path rule win', () => {
    const robots = ['User-agent: *', 'Disallow: /docs', 'Allow: /docs/public'].join('\n');
    expect(check(robots, '/docs/internal').allowed).toBe(false);
    expect(check(robots, '/docs/public/guide').allowed).toBe(true);
  });

  it('gives allow the tie on an equal-length match', () => {
    const robots = ['User-agent: *', 'Disallow: /x', 'Allow: /x'].join('\n');
    expect(check(robots, '/x').allowed).toBe(true);
  });

  it('reads an empty disallow value as allowing everything', () => {
    expect(check('User-agent: *\nDisallow:', '/anything').allowed).toBe(true);
  });

  it('honours a wildcard in the middle of a pattern', () => {
    const robots = 'User-agent: *\nDisallow: /*/private';
    expect(check(robots, '/team/private/notes').allowed).toBe(false);
    expect(check(robots, '/team/public').allowed).toBe(true);
  });

  it('honours the end anchor', () => {
    const robots = 'User-agent: *\nDisallow: /*.pdf$';
    expect(check(robots, '/files/report.pdf').allowed).toBe(false);
    expect(check(robots, '/files/report.pdf?v=2').allowed).toBe(true);
  });

  it('reads Disallow: /$ as the root only', () => {
    const robots = 'User-agent: *\nDisallow: /$';
    expect(check(robots, '/').allowed).toBe(false);
    expect(check(robots, '/pricing').allowed).toBe(true);
  });

  it('matches a user-agent value as a prefix of the product token', () => {
    // How publishers expect `User-agent: Google` to catch Googlebot.
    expect(isAllowed(parseRobots('User-agent: Google\nDisallow: /'), 'Googlebot', '/').allowed).toBe(
      false,
    );
  });

  it('merges rules a publisher split across two blocks for the same agent', () => {
    const robots = [
      'User-agent: BotreadyBot',
      'Disallow: /admin',
      '',
      'User-agent: BotreadyBot',
      'Disallow: /internal',
    ].join('\n');
    expect(check(robots, '/admin').allowed).toBe(false);
    expect(check(robots, '/internal').allowed).toBe(false);
    expect(check(robots, '/pricing').allowed).toBe(true);
  });

  it('does not apply another agent group to us', () => {
    const robots = 'User-agent: GPTBot\nDisallow: /';
    expect(check(robots, '/').allowed).toBe(true);
  });

  it('answers the same question about a site as it does about us', () => {
    // The second job this parser does: reporting what the file says about the
    // agents the product is actually about.
    const robots = ['User-agent: ClaudeBot', 'Disallow: /', '', 'User-agent: *', 'Allow: /'].join(
      '\n',
    );
    const parsed = parseRobots(robots);
    expect(isAllowed(parsed, 'ClaudeBot/1.0', '/').allowed).toBe(false);
    expect(isAllowed(parsed, 'Googlebot', '/').allowed).toBe(true);
  });
});
