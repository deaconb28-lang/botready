/**
 * A robots.txt parser, used for two different jobs that must not be confused:
 *
 *   1. Deciding whether we are allowed to fetch a path. We obey this. Our
 *      product is partly about robots.txt, which makes complying with it a
 *      credibility requirement rather than a nicety, and CI asserts it.
 *
 *   2. Reporting what the file says about ClaudeBot, GPTBot and the rest. That
 *      is an observation about the site, not a rule about us.
 *
 * Follows the Google/RFC 9309 reading of the format, which is what publishers
 * actually write against:
 *   - group by consecutive User-agent lines
 *   - the most specific matching group wins, by user-agent token length
 *   - within a group, the longest matching path rule wins
 *   - Allow beats Disallow on an equal-length tie
 *   - an empty Disallow value allows everything
 *   - * matches any run of characters, $ anchors the end
 */

export interface RobotsRule {
  type: 'allow' | 'disallow';
  path: string;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
  crawlDelay: Map<string, number>;
  /** Lines we could not make sense of, reported as an observation. */
  parseErrors: string[];
  /** True when the file had no directives at all, which is not the same as absent. */
  empty: boolean;
}

export function parseRobots(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  const crawlDelay = new Map<string, number>();
  const parseErrors: string[] = [];

  let current: RobotsGroup | null = null;
  // Consecutive User-agent lines share one group. A rule line closes the run.
  let collectingAgents = false;
  let directives = 0;

  const lines = text.split(/\r\n|\r|\n/);

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;

    const colon = line.indexOf(':');
    if (colon < 1) {
      parseErrors.push(`line ${index + 1}: no field name in ${truncate(rawLine)}`);
      continue;
    }

    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    switch (field) {
      case 'user-agent': {
        if (!value) {
          parseErrors.push(`line ${index + 1}: empty user-agent`);
          break;
        }
        if (!collectingAgents || !current) {
          current = { agents: [], rules: [] };
          groups.push(current);
          collectingAgents = true;
        }
        current.agents.push(value.toLowerCase());
        directives += 1;
        break;
      }

      case 'allow':
      case 'disallow': {
        collectingAgents = false;
        directives += 1;
        if (!current) {
          // Rules before any User-agent line. Google treats these as applying
          // to nobody; we record it rather than guessing at the intent.
          parseErrors.push(`line ${index + 1}: ${field} before any user-agent line`);
          break;
        }
        current.rules.push({ type: field, path: value });
        break;
      }

      case 'sitemap': {
        collectingAgents = false;
        directives += 1;
        if (value) sitemaps.push(value);
        break;
      }

      case 'crawl-delay': {
        collectingAgents = false;
        directives += 1;
        const seconds = Number(value);
        if (!Number.isFinite(seconds) || seconds < 0) {
          parseErrors.push(`line ${index + 1}: crawl-delay is not a number: ${truncate(value)}`);
          break;
        }
        for (const agent of current?.agents ?? ['*']) crawlDelay.set(agent, seconds);
        break;
      }

      default:
        // Unknown fields are legal and ignorable per RFC 9309. Not an error.
        break;
    }
  }

  return { groups, sitemaps, crawlDelay, parseErrors, empty: directives === 0 };
}

export interface RobotsVerdict {
  allowed: boolean;
  /**
   * The rule that decided it, printed the way it appears in the file, so the
   * result page can quote the line rather than paraphrase it. Empty when
   * nothing matched, which means allowed by default.
   */
  matchedRule: string;
  /** The user-agent token whose group applied, or '' when none did. */
  matchedAgent: string;
}

/**
 * Whether `token` may fetch `path`. `path` is a path with its query, not a URL.
 *
 * The default is allowed. An absent or unparseable robots.txt does not make a
 * site off-limits, and treating a 404 as a blanket disallow would make us
 * refuse most of the internet.
 */
export function isAllowed(robots: ParsedRobots, token: string, path: string): RobotsVerdict {
  const group = groupFor(robots, token);
  if (!group) return { allowed: true, matchedRule: '', matchedAgent: '' };

  const target = path.startsWith('/') ? path : `/${path}`;

  let best: { rule: RobotsRule; length: number } | null = null;

  for (const rule of group.rules) {
    // An empty Disallow value is the documented way to allow everything. It
    // matches nothing here, so the default-allow at the end takes over.
    if (rule.path === '') continue;
    if (!pathMatches(rule.path, target)) continue;

    const length = effectiveLength(rule.path);
    if (
      !best ||
      length > best.length ||
      // Allow wins an equal-length tie, per RFC 9309.
      (length === best.length && rule.type === 'allow' && best.rule.type === 'disallow')
    ) {
      best = { rule, length };
    }
  }

  if (!best) {
    return { allowed: true, matchedRule: '', matchedAgent: group.matchedAgent };
  }

  return {
    allowed: best.rule.type === 'allow',
    matchedRule: `${best.rule.type === 'allow' ? 'Allow' : 'Disallow'}: ${best.rule.path}`,
    matchedAgent: group.matchedAgent,
  };
}

/**
 * The most specific group that names this token. Specificity is the length of
 * the matching user-agent token, so `ClaudeBot` beats `*` and `ClaudeBot-User`
 * beats `ClaudeBot` for a client calling itself ClaudeBot-User.
 *
 * Matching is a case-insensitive prefix on the product token, which is how
 * publishers expect `User-agent: Google` to catch `Googlebot`.
 */
function groupFor(
  robots: ParsedRobots,
  token: string,
): (RobotsGroup & { matchedAgent: string }) | null {
  const needle = productToken(token);
  let best: { group: RobotsGroup; agent: string; length: number } | null = null;

  for (const group of robots.groups) {
    for (const agent of group.agents) {
      const specific = agent !== '*' && needle.startsWith(agent);
      const wildcard = agent === '*';
      if (!specific && !wildcard) continue;

      const length = wildcard ? 0 : agent.length;
      if (!best || length > best.length) best = { group, agent, length };
    }
  }

  if (!best) return null;
  const winner = best.agent;
  // Merge every group naming the same winning token: publishers split rules
  // across repeated blocks more often than the spec would suggest.
  const rules = robots.groups
    .filter((g) => g.agents.includes(winner))
    .flatMap((g) => g.rules);
  return { agents: [winner], rules, matchedAgent: winner };
}

/** `BotreadyBot/1.0 (+https://…)` -> `botreadybot`. */
export function productToken(userAgent: string): string {
  return (userAgent.split('/')[0] ?? userAgent).trim().toLowerCase();
}

/** `*` matches any run, `$` anchors the end, everything else is literal. */
function pathMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;

  const segments = body.split('*');
  let cursor = 0;

  for (const [i, segment] of segments.entries()) {
    if (segment === '') {
      if (i === 0) continue;
      continue;
    }
    const found = i === 0 ? (path.startsWith(segment) ? 0 : -1) : path.indexOf(segment, cursor);
    if (found === -1) return false;
    cursor = found + segment.length;
  }

  if (anchored) {
    const tail = segments[segments.length - 1] ?? '';
    // With a trailing $ the last literal must land exactly at the end.
    if (tail === '') return segments.length > 1 ? true : path.length === cursor;
    return cursor === path.length;
  }

  return true;
}

/** `*` and `$` do not add specificity, so they do not count toward length. */
function effectiveLength(pattern: string): number {
  return pattern.replace(/[*$]/g, '').length;
}

function truncate(s: string): string {
  const t = s.trim();
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}
