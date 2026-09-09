/**
 * The writing, as data.
 *
 * Same rule as lib/content.ts and for the same reason: a post is a structure,
 * and the page, the markdown representation, the sitemap entry and the JSON-LD
 * are all generated from it. The alternative is an MDX file plus a hand-kept
 * front-matter block plus a second copy of the words in llms-full.txt, which is
 * three things to keep true and two that go stale silently.
 *
 * There is no CMS and there is not going to be one. Ten posts do not need a
 * database, and a post that lives in the repo gets typechecked, reviewed and
 * deployed like everything else.
 *
 * Every post that quotes a number carries `figures`, which prints the date and
 * the corpus the number was taken over. That is not politeness. This whole
 * product argues that the category publishes round figures with no method
 * attached, and a blog of ours doing the same would be the fastest way to lose
 * the argument. A figure that moves gets a date on it and a link to the live
 * one at /stats.
 */

import { BLOG_POSTS } from './blog-posts';

export type BlogCategory = 'Findings' | 'Data' | 'Method' | 'How-to' | 'Standards';

/** A paragraph, a heading, a list, a code block, a pull note, or a metric row. */
export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'code'; lang?: string; text: string }
  | { kind: 'note'; text: string }
  | { kind: 'stats'; items: Array<{ n: string; label: string }> };

export interface BlogPost {
  slug: string;
  title: string;
  /** The card's second line, the meta description, and the markdown lede. */
  dek: string;
  category: BlogCategory;
  /** ISO date, no time. When it first went up. */
  published: string;
  /** ISO date. When the words last changed, which is what lastmod means. */
  updated: string;
  /** Set on any post that quotes a measured figure. Printed under the title. */
  figures?: { asOf: string; corpus: string };
  body: Block[];
  /** Slugs, in the order they should appear at the foot of the post. */
  related?: string[];
}

export { BLOG_POSTS };

/**
 * Newest first, which is the order the index shows them in.
 *
 * Returns 0 on equal dates rather than falling through to -1. Ten posts that
 * went up the same day is the normal state for a launch, and a comparator that
 * never says "equal" is not a comparator: V8 handed back the array reversed,
 * so the index led with the last thing written. With 0 the sort is stable and
 * ties keep the order they are declared in, which is the editorial one.
 */
export function postsByDate(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => (a.published === b.published ? 0 : a.published < b.published ? 1 : -1));
}

export function postBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function blogPath(post: BlogPost | string): string {
  return `/blog/${typeof post === 'string' ? post : post.slug}`;
}

/**
 * Minutes, at 220 words. Rounded up, never zero.
 *
 * Counted over the words rather than declared per post, because a declared
 * number is one more thing to forget when a paragraph is added.
 */
export function readingMinutes(post: BlogPost): number {
  const words = blockText(post).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Every word in a post's body, with the markup stripped. */
function blockText(post: BlogPost): string {
  const parts: string[] = [post.dek];
  for (const b of post.body) {
    if (b.kind === 'p' || b.kind === 'h2' || b.kind === 'note') parts.push(b.text);
    else if (b.kind === 'list') parts.push(b.items.join(' '));
    else if (b.kind === 'stats') parts.push(b.items.map((i) => `${i.n} ${i.label}`).join(' '));
  }
  return parts.join(' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '');
}

/** "9 September 2026". The date form used everywhere a post is dated. */
export function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * A post as markdown.
 *
 * The same blocks the page renders, so the two cannot disagree — which is the
 * point of `markdown_alternate` and the reason we fail sites that only serve
 * the words inside a rendered document.
 */
export function postMarkdown(post: BlogPost): string {
  const lines: string[] = [
    `# ${post.title}`,
    '',
    post.dek,
    '',
    `Published: ${post.published}`,
    ...(post.updated !== post.published ? [`Updated: ${post.updated}`] : []),
    `Category: ${post.category}`,
    ...(post.figures ? [`Figures as of ${post.figures.asOf}, from ${post.figures.corpus}.`] : []),
    '',
  ];

  for (const b of post.body) {
    if (b.kind === 'h2') lines.push(`## ${b.text}`, '');
    else if (b.kind === 'p') lines.push(b.text, '');
    else if (b.kind === 'note') lines.push(`> ${b.text}`, '');
    else if (b.kind === 'list') {
      lines.push(...b.items.map((item, i) => `${b.ordered ? `${i + 1}.` : '-'} ${item}`), '');
    } else if (b.kind === 'code') {
      lines.push('```' + (b.lang ?? ''), b.text, '```', '');
    } else if (b.kind === 'stats') {
      lines.push(...b.items.map((i) => `- **${i.n}** — ${i.label}`), '');
    }
  }

  const related = (post.related ?? []).map(postBySlug).filter((p): p is BlogPost => Boolean(p));
  if (related.length > 0) {
    lines.push('## Related', '', ...related.map((p) => `- [${p.title}](${blogPath(p)}): ${p.dek}`), '');
  }
  return lines.join('\n');
}
