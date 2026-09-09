import Link from 'next/link';

import { blogPath, longDate, readingMinutes, type BlogCategory, type BlogPost } from '@/lib/blog';
import { Card, cx } from '@/components/ui';

/**
 * A post on the index.
 *
 * The category chip is the only colour on the card, and it is the same
 * semantic palette as everywhere else rather than a decorative one: a post
 * about what we found is coral, a post about how we measure is lime. Nothing
 * here rests on colour alone — the category is also its own word.
 */
const CATEGORY_CHIP: Record<BlogCategory, string> = {
  Findings: 'bg-coral text-ink',
  Data: 'bg-violet text-white',
  Method: 'bg-lime text-ink',
  'How-to': 'bg-amber text-ink',
  Standards: 'bg-teal text-ink',
};

export function PostCard({ post, feature = false }: { post: BlogPost; feature?: boolean }) {
  return (
    <Card
      as="li"
      radius={feature ? 'panel-lg' : 'panel'}
      shadow={feature ? 5 : 4}
      lift
      className={cx('relative flex flex-col p-6 sm:p-7', feature && 'sm:col-span-2 sm:p-8')}
    >
      <div className="flex flex-wrap items-center gap-[10px]">
        <span
          className={cx(
            'edge rounded-[99px] px-[10px] py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.12em]',
            CATEGORY_CHIP[post.category],
          )}
        >
          {post.category}
        </span>
        <span className="font-mono text-[11px] text-placeholder">{readingMinutes(post)} min read</span>
      </div>

      <h2
        className={cx(
          'display-tight mt-4',
          feature ? 'text-[clamp(24px,3.4vw,36px)]' : 'text-[clamp(19px,2.2vw,23px)]',
        )}
      >
        {/* The whole card is the target. Stretching the link off the heading
            keeps one link per card, which is what a reader tabbing through
            wants and what a crawler reads as one destination. */}
        <Link href={blogPath(post)} className="text-ink no-underline after:absolute after:inset-0 after:content-['']">
          {post.title}
        </Link>
      </h2>

      <p
        className={cx(
          'mt-3 text-[14.5px] leading-[1.6] text-muted',
          feature ? 'max-w-[62ch] text-[16px]' : '',
        )}
      >
        {post.dek}
      </p>

      <div className="mt-auto flex items-baseline gap-[10px] pt-6 font-mono text-[11.5px] text-subtle-2">
        <time dateTime={post.published}>{longDate(post.published)}</time>
        {post.figures ? <span className="text-placeholder">· measured</span> : null}
      </div>
    </Card>
  );
}
