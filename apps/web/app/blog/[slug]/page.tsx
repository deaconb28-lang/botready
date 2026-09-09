import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PROSE_LINK, PostBody } from '@/components/blog/prose';
import { BlogPostStructuredData } from '@/components/site/StructuredData';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Card, Container, Eyebrow } from '@/components/ui';
import { BLOG_POSTS, blogPath, longDate, postBySlug, readingMinutes, type BlogPost } from '@/lib/blog';
import { pageMetadata } from '@/lib/metadata';

/**
 * One post.
 *
 * Every slug is known at build time, so all ten are prerendered and there is
 * no dynamic segment to serve. An unknown slug 404s rather than rendering an
 * empty article.
 */
export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) return {};
  // The head comes from the same registry entry as the sitemap and the
  // markdown, so a post cannot be described three different ways.
  return pageMetadata(blogPath(post), {
    openGraph: {
      type: 'article',
      publishedTime: post.published,
      modifiedTime: post.updated,
      section: post.category,
      title: post.title,
      description: post.dek,
    },
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) notFound();

  const related = (post.related ?? []).map(postBySlug).filter((p): p is BlogPost => Boolean(p));

  return (
    <div className="min-h-dvh bg-canvas">
      <BlogPostStructuredData
        path={blogPath(post)}
        headline={post.title}
        description={post.dek}
        published={post.published}
        updated={post.updated}
        section={post.category}
      />
      <SiteHeader />
      <main id="main">
        <Container width={860} className="pb-24 pt-11">
          <p className="m-0 font-mono text-[11.5px] uppercase tracking-[0.12em]">
            <Link href="/blog" className="text-subtle-2 no-underline hover:text-ink">
              ← All writing
            </Link>
          </p>

          <article className="mt-7">
            <Eyebrow>{post.category}</Eyebrow>
            <h1 className="display-tight mt-3 max-w-[22ch] text-[clamp(32px,4.6vw,52px)]">{post.title}</h1>
            <p className="mt-5 max-w-[58ch] text-[18px] leading-[1.58] text-muted">{post.dek}</p>

            <p className="mt-6 flex flex-wrap items-baseline gap-x-[14px] gap-y-1 border-t-2 border-hairline-4 pt-5 font-mono text-[11.5px] text-subtle-2">
              <time dateTime={post.published}>{longDate(post.published)}</time>
              <span className="text-placeholder">·</span>
              <span>{readingMinutes(post)} min read</span>
              {post.updated !== post.published ? (
                <>
                  <span className="text-placeholder">·</span>
                  <span>updated {longDate(post.updated)}</span>
                </>
              ) : null}
            </p>

            {/* A dated figure and a dated post are different facts. Saying so
                here is the difference between a number a reader can weigh and
                a number that quietly went stale eight months ago. */}
            {post.figures ? (
              <p className="edge mt-5 rounded-[12px] bg-surface-alt px-4 py-3 text-[13.5px] leading-[1.55] text-muted">
                Figures as of {post.figures.asOf}, taken over {post.figures.corpus}. They move as scans arrive —{' '}
                <Link href="/stats" className={PROSE_LINK}>
                  the live version is here
                </Link>
                .
              </p>
            ) : null}

            <PostBody body={post.body} />
          </article>

          <Card radius="panel" shadow={4} className="mt-12 p-6 sm:p-7">
            <Eyebrow>Read this on your own site</Eyebrow>
            <p className="mt-3 max-w-[54ch] text-[16px] leading-[1.6] text-body">
              A scan requests your page as five clients, one second apart, and shows you what each one got back. Free,
              no account, nothing blurred.
            </p>
            <p className="mt-5">
              <Link
                href="/scan"
                className="edge inline-block rounded-[12px] bg-violet px-5 py-[11px] font-body text-[15px] font-semibold text-white no-underline shadow-hard-3"
              >
                Scan a site
              </Link>
            </p>
          </Card>

          {related.length > 0 ? (
            <section className="mt-12" aria-labelledby="related">
              <h2 id="related" className="display text-[19px]">
                Related
              </h2>
              <ul className="m-0 mt-4 grid list-none gap-[10px] p-0">
                {related.map((r) => (
                  <li key={r.slug} className="border-t-2 border-hairline-4 pt-4">
                    <Link href={blogPath(r)} className="font-body text-[16.5px] font-semibold text-ink no-underline hover:text-violet">
                      {r.title}
                    </Link>
                    <p className="mt-1 max-w-[64ch] text-[14px] leading-[1.55] text-muted">{r.dek}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
