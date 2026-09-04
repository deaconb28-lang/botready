import { PanelSkeleton } from '@/components/Skeleton';

/**
 * Every view under a claimed property. It sits below app/[domain]/layout.tsx,
 * so the sidebar stays painted and only the panel is replaced — which is the
 * whole reason this file is here rather than one level up, where /account
 * keeps its shell inside the page and a skeleton would flash a bare screen.
 */
export default function Loading() {
  return <PanelSkeleton cards={4} />;
}
