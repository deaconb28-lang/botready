import type { Metadata } from 'next';
import Link from 'next/link';

import { PostCard } from '@/components/blog/PostCard';
import { BlogIndexStructuredData } from '@/components/site/StructuredData';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Card, Container, Eyebrow, PageTitle } from '@/components/ui';
import { blogPath, postsByDate } from '@/lib/blog';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata('/blog');

/**
 * The writing.
 *
 * A grid of cards, newest first, with the first one wide. Static: every post
 * is in the repo, so there is nothing here to fetch and nothing to revalidate.
 *
 * The posts that quote figures link to /stats for the live version of the same
 * number rather than being edited every time the corpus moves. A post is dated
 * and its figures are dated separately, because those are two different facts
 * and printing one date for both is how a number quietly goes stale.
 */
export default function BlogIndexPage() {
  const posts = postsByDate();
  const [feature, ...rest] = posts;

  return (
    <div className="min-h-dvh bg-canvas">
      <BlogIndexStructuredData
        posts={posts.map((p) => ({ path: blogPath(p), title: p.title, dek: p.dek, published: p.published }))}
      />
      <SiteHeader />
      <main id="main">
        <Container width={1120} className="pb-24 pt-11">
          <PageTitle
            eyebrow="Writing"
            size="xl"
            lede="What we found measuring how legible websites are to AI agents, and how the measuring works. Every figure in here is one we took over sites we scanned, with the date and the count beside it."
          >
            Notes from the scanner
          </PageTitle>

          <ul className="m-0 mt-10 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {feature ? <PostCard post={feature} feature /> : null}
            {rest.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </ul>

          <Card surface="violet" radius="panel-lg" shadow={6} className="mt-10 p-7 sm:p-9">
            <Eyebrow tone="on-violet">Or skip the reading</Eyebrow>
            <h2 className="display-tight mt-3 max-w-[24ch] text-[clamp(24px,3.2vw,36px)] text-white">
              Find out what your own site answers ClaudeBot.
            </h2>
            <p className="mt-4 max-w-[58ch] text-[16px] leading-[1.6] text-on-violet">
              Five clients, the same URL, one second apart. The diagnosis is free and nothing about it is blurred.
            </p>
            <p className="mt-6 flex flex-wrap gap-[10px]">
              <Link
                href="/scan"
                className="edge inline-block rounded-[12px] bg-lime px-5 py-[11px] font-body text-[15px] font-semibold text-ink no-underline shadow-hard-3"
              >
                Scan a site
              </Link>
              <Link
                href="/stats"
                className="edge inline-block rounded-[12px] bg-white px-5 py-[11px] font-body text-[15px] font-semibold text-ink no-underline shadow-hard-3"
              >
                See what we have measured
              </Link>
            </p>
          </Card>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
