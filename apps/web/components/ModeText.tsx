'use client';

import type { ReactNode } from 'react';

import { useMode } from '@/lib/mode';
import { COPY, type MarketingCopy } from '@/lib/copy';

/** Render one of two strings depending on the register. */
export function ModeText({ plain, tech }: { plain: ReactNode; tech: ReactNode }) {
  const { mode } = useMode();
  return <>{mode === 'tech' ? tech : plain}</>;
}

/** Render a key from the marketing dictionary in the current register. */
export function Copy({ k }: { k: keyof MarketingCopy }) {
  const { mode } = useMode();
  const value = COPY[mode][k];
  return <>{Array.isArray(value) ? value.join(' ') : value}</>;
}

/** One item of a list-valued key, such as the three step bodies. */
export function CopyItem({ k, i }: { k: 'whyPoints' | 'steps'; i: 0 | 1 | 2 }) {
  const { mode } = useMode();
  return <>{COPY[mode][k][i]}</>;
}
