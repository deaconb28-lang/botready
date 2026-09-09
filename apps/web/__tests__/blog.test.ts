/**
 * The writing, checked against the rules the writing argues for.
 *
 * Two of these are the point. A post that quotes a figure has to carry the
 * date and corpus that figure came from, because the product's whole argument
 * is that this category publishes round numbers with no method attached. And
 * every internal link a post makes has to go somewhere this app serves, because
 * a post full of dead links is the thing we fail other sites for.
 */

import { describe, expect, it } from 'vitest';

import { BLOG_POSTS, blogPath, postBySlug, postMarkdown, postsByDate, readingMinutes } from '../lib/blog';
import { PUBLIC_PAGES, pageFor } from '../lib/content';
import { markdownFor } from '../lib/markdown';

/** Paths outside the page list that a post may link to. */
const OTHER_LINKABLE = new Set(['/scan']);

const ALL_TEXT = BLOG_POSTS.flatMap((post) =>
  post.body.flatMap((b) => {
    if (b.kind === 'p' || b.kind === 'note' || b.kind === 'h2') return [b.text];
    if (b.kind === 'list') return b.items;
    return [];
  }),
);

describe('the posts', () => {
  it('has ten of them, each with a distinct slug', () => {
    expect(BLOG_POSTS.length).toBe(10);
    expect(new Set(BLOG_POSTS.map((p) => p.slug)).size).toBe(10);
  });

  it('registers every post as a public page', () => {
    // Which is what puts it in the sitemap, in llms.txt, in the markdown
    // negotiation and in the Last-Modified header. Missing here means a post
    // that exists and that nothing can find.
    for (const post of BLOG_POSTS) {
      const page = pageFor(blogPath(post));
      expect(page, `${post.slug} is not a registered page`).toBeTruthy();
      expect(page?.title).toBe(post.title);
      expect(page?.updated).toBe(post.updated);
    }
    expect(pageFor('/blog')).toBeTruthy();
  });

  it('gives every post a markdown representation with the same words', () => {
    for (const post of BLOG_POSTS) {
      const md = markdownFor(blogPath(post));
      expect(md, `no markdown for ${post.slug}`).toBeTruthy();
      expect(md).toContain(`# ${post.title}`);
      // A paragraph the page renders is a paragraph the markdown carries.
      const firstParagraph = post.body.find((b) => b.kind === 'p');
      if (firstParagraph && firstParagraph.kind === 'p') expect(md).toContain(firstParagraph.text);
    }
  });

  it('dates every post in the past and never modified before published', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const post of BLOG_POSTS) {
      expect(post.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(post.published <= today, `${post.slug} is dated in the future`).toBe(true);
      expect(post.updated >= post.published, `${post.slug} was updated before it was published`).toBe(true);
    }
  });

  it('dates the figures separately from the post', () => {
    // A post is not rewritten when a number moves — it links to the live one.
    // So the figure's date is a different fact from the post's, and a post
    // that quotes one without saying when it was taken is the exact thing
    // this site exists to complain about.
    for (const post of BLOG_POSTS) {
      const quotesAPercentage = post.body.some(
        (b) => (b.kind === 'p' || b.kind === 'note') && /\d+ ?(%|per cent)/.test(b.text),
      );
      if (quotesAPercentage) {
        expect(post.figures, `${post.slug} quotes a rate with no figures date`).toBeTruthy();
      }
    }
  });

  it('links only to paths this app serves', () => {
    const links = ALL_TEXT.flatMap((text) => [...text.matchAll(/\]\((\/[^)\s#]*)/g)].map((m) => m[1]!));
    expect(links.length).toBeGreaterThan(10);
    for (const href of links) {
      const known = OTHER_LINKABLE.has(href) || PUBLIC_PAGES.some((p) => p.path === href);
      expect(known, `${href} is not a path this app serves`).toBe(true);
    }
  });

  it('points every related slug at a post that exists', () => {
    for (const post of BLOG_POSTS) {
      for (const slug of post.related ?? []) {
        expect(postBySlug(slug), `${post.slug} relates to missing ${slug}`).toBeTruthy();
        expect(slug, `${post.slug} relates to itself`).not.toBe(post.slug);
      }
    }
  });

  it('orders the index newest first', () => {
    const dates = postsByDate().map((p) => p.published);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('counts reading time from the words rather than declaring it', () => {
    for (const post of BLOG_POSTS) {
      const minutes = readingMinutes(post);
      expect(minutes).toBeGreaterThan(0);
      expect(minutes).toBeLessThan(30);
    }
  });

  it('renders a list, a code block and a note into markdown', () => {
    const md = postMarkdown(BLOG_POSTS.find((p) => p.slug === 'six-pages-one-second-apart')!);
    expect(md).toContain('## What it never does');
    expect(md).toContain('- Spoof a browser user-agent to get past a block.');
    expect(md).toContain('User-agent: BotreadyBot');
    expect(md).toContain('> A block is the finding');
  });

  it('names the source of every number it prints', () => {
    // The corpus and the date, not "studies show".
    for (const post of BLOG_POSTS.filter((p) => p.figures)) {
      expect(post.figures!.corpus).toMatch(/\d/);
      expect(post.figures!.asOf).toMatch(/\d{4}$/);
    }
  });
});

describe('the index order', () => {
  it('leads with the first post declared when every date is the same', () => {
    // Ten posts published on one day is the normal state for a launch, and a
    // comparator that never returns 0 is not a comparator: the array came
    // back reversed and the index led with the last thing written.
    const same = postsByDate().map((p) => p.slug);
    expect(same[0]).toBe(BLOG_POSTS[0]!.slug);
    expect(same).toEqual(BLOG_POSTS.map((p) => p.slug));
  });
});
