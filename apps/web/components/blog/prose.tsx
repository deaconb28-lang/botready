import Link from 'next/link';
import type { ReactNode } from 'react';

import type { Block } from '@/lib/blog';
import { cx } from '@/components/ui';

/**
 * A post's blocks, rendered.
 *
 * The same structure the markdown representation is generated from, so the two
 * cannot drift. That is the whole reason a post is data rather than JSX: this
 * site fails other sites for serving words only inside a rendered document,
 * and a blog of ours that could only be read by a browser would be an odd thing
 * to publish under that check.
 *
 * The inline grammar is deliberately three things — a link, a code span and
 * bold — rather than a markdown parser. A parser would be a dependency, a
 * sanitiser and a class of injection bug, in exchange for syntax nobody writing
 * these posts has asked for.
 */

const INLINE = /(\[[^\]]+\]\([^)\s]+\)|`[^`]+`|\*\*[^*]+\*\*)/g;

/**
 * An inline link inside body copy is underlined.
 *
 * The site's reset leaves `a` undecorated, which is fine for a nav item and
 * not fine mid-sentence: violet on grey body text is a 1.0:1 difference in
 * luminance, so colour alone does not distinguish it and WCAG 1.4.1 is not
 * met. Exported because the pages around a post make the same links.
 */
export const PROSE_LINK = 'underline decoration-[1.5px] underline-offset-[3px]';

export function inline(text: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link as unknown as [string, string, string];
      // Internal links go through next/link so a reader moving between posts
      // does not pay for a document load. External ones are plain anchors.
      return href.startsWith('/') ? (
        <Link key={i} href={href} className={PROSE_LINK}>
          {label}
        </Link>
      ) : (
        <a key={i} href={href} rel="noreferrer" className={PROSE_LINK}>
          {label}
        </a>
      );
    }
    const code = /^`([^`]+)`$/.exec(part);
    if (code) {
      return (
        <code key={i} className="rounded-[6px] border border-hairline-3 bg-surface-alt px-[5px] py-[1px] font-mono text-[0.88em] text-ink">
          {code[1]}
        </code>
      );
    }
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold) return <strong key={i} className="font-semibold text-ink">{bold[1]}</strong>;
    return <span key={i}>{part}</span>;
  });
}

export function PostBody({ body }: { body: Block[] }) {
  return (
    <div className="mt-8">
      {body.map((block, i) => (
        <BlockView key={i} block={block} first={i === 0} />
      ))}
    </div>
  );
}

function BlockView({ block, first }: { block: Block; first: boolean }) {
  switch (block.kind) {
    case 'h2':
      return (
        <h2 className="display-tight mt-11 text-[clamp(22px,2.6vw,29px)] first:mt-0">{block.text}</h2>
      );

    case 'p':
      return (
        <p
          className={cx(
            'mt-5 max-w-[68ch] text-[16.5px] leading-[1.68] text-body',
            // The opening paragraph carries the weight of a lede without
            // being a separate field to write.
            first && 'mt-0 text-[18px] leading-[1.62] text-ink',
          )}
        >
          {inline(block.text)}
        </p>
      );

    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List
          className={cx(
            'm-0 mt-5 grid max-w-[68ch] list-none gap-[11px] p-0',
            block.ordered && '[counter-reset:step]',
          )}
        >
          {block.items.map((item, i) => (
            <li key={i} className="grid grid-cols-[auto_1fr] items-baseline gap-[11px] text-[16px] leading-[1.62] text-body">
              <span
                aria-hidden
                className={cx(
                  'font-mono text-[12.5px] tabular-nums',
                  block.ordered ? 'text-violet' : 'text-placeholder',
                )}
              >
                {block.ordered ? String(i + 1).padStart(2, '0') : '—'}
              </span>
              <span>{inline(item)}</span>
            </li>
          ))}
        </List>
      );
    }

    case 'code':
      // Scrolls rather than wraps. A wrapped shell command is a command that
      // cannot be copied and run, which is the only thing it is here for.
      return (
        <div className="edge mt-6 overflow-hidden rounded-[14px] bg-ink shadow-hard-3">
          {/* tabIndex, because a region that scrolls has to be reachable
              without a pointer — a keyboard user cannot read past the edge of
              a long command otherwise. */}
          <pre
            tabIndex={0}
            className="m-0 overflow-x-auto p-[18px] font-mono text-[12.5px] leading-[1.65] text-on-ink"
          >
            <code>{block.text}</code>
          </pre>
        </div>
      );

    case 'note':
      return (
        <aside className="edge mt-7 max-w-[68ch] rounded-[16px] bg-violet-tint p-5 shadow-hard-3">
          <p className="m-0 text-[16px] leading-[1.6] text-ink">{inline(block.text)}</p>
        </aside>
      );

    case 'stats':
      return (
        <div className="edge mt-7 grid grid-cols-2 gap-x-6 gap-y-6 rounded-[16px] bg-surface p-6 shadow-hard-4 sm:grid-cols-4">
          {block.items.map((item, i) => (
            <div key={i}>
              <div className="display text-[clamp(22px,2.8vw,32px)] leading-none tracking-[-0.03em] text-ink">
                {item.n}
              </div>
              <div className="mt-[7px] text-[12.5px] leading-[1.4] text-muted">{item.label}</div>
            </div>
          ))}
        </div>
      );
  }
}
