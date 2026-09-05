import type { ReactNode } from 'react';

import { COPY, type MarketingCopy } from '@/lib/copy';

/**
 * Two readers over the marketing dictionary.
 *
 * These used to pick between a plain and a technical register and so had to be
 * client components. There is one register now, so they are plain server
 * components that read a constant — which is also why the home page no longer
 * ships a context provider to render its own copy.
 */

/** Render a key from the marketing dictionary. */
export function Copy({ k }: { k: keyof MarketingCopy }): ReactNode {
  const value = COPY[k];
  return <>{Array.isArray(value) ? value.join(' ') : value}</>;
}

/** One item of a list-valued key, such as the three step bodies. */
export function CopyItem({ k, i }: { k: 'whyPoints' | 'steps'; i: 0 | 1 | 2 }): ReactNode {
  return <>{COPY[k][i]}</>;
}
