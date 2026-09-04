import { Card, Container, cx } from '@/components/ui';

/**
 * What a page looks like while the server is still reading the database.
 *
 * Every page under /scan, /r, /index, /app and /account is force-dynamic and
 * waits on Supabase, and until now a click on any of them showed the previous
 * page until the new one arrived whole. These are the `loading.tsx` bodies for
 * those segments: the same cards in the same places, so the layout does not
 * jump when the real thing lands.
 *
 * They are a shape, not a guess at the content. Nothing here shows a number, a
 * grade or a domain, because inventing one for 400ms and then replacing it is
 * how a page ends up saying something untrue.
 */

export function Line({ w = '100%', h = 12, className = '' }: { w?: string | number; h?: number; className?: string }) {
  return <span className={cx('skeleton block', className)} style={{ width: w, height: h }} />;
}

function Block({ w = '100%', h = 12, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return <span className="skeleton block" style={{ width: w, height: h, borderRadius: r }} />;
}

/** /scan/[id] and /r/[domain]. */
export function ReportSkeleton() {
  return (
    <Container as="section" width={1120} className="pb-24 pt-11">
      <span className="sr-only" role="status">
        Loading the result
      </span>
      <Line w={260} h={13} />

      <div className="edge mt-[18px] overflow-hidden rounded-[24px] bg-white">
        <div className="flex flex-wrap items-center gap-8 border-b border-hairline px-6 py-[30px] sm:px-8">
          <Block w={132} h={62} r={12} />
          <div className="grid min-w-[200px] flex-1 gap-[10px]">
            <Block w={190} h={26} r={99} />
            <Line w="min(46ch, 100%)" h={13} />
            <Line w="min(34ch, 100%)" h={13} />
          </div>
          <Block w={230} h={52} r={12} />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="grid gap-[10px] border-b border-r border-hairline px-6 py-5">
              <Line w={92} h={11} />
              <Line w={58} h={22} />
              <Block h={7} r={99} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-[34px] grid grid-cols-1 items-start gap-[26px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4">
          <Line w={300} h={28} />
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i} radius="card" shadow={3} className="grid gap-3 px-[22px] py-5">
              <Line w={`${52 - i * 6}%`} h={17} />
              <Line h={12} />
              <Line w="72%" h={12} />
            </Card>
          ))}
        </div>
        <Card radius="card-lg" shadow={4} className="grid gap-4 p-5">
          <Line w={150} h={11} />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Line w={96} h={13} />
              <Line w={70} h={13} className="ml-auto" />
              <Block w={44} h={24} r={7} />
            </div>
          ))}
        </Card>
      </div>
    </Container>
  );
}

/** /index/[segment]. */
export function IndexSkeleton() {
  return (
    <Container as="main" width={1080} className="pb-24 pt-14">
      <span className="sr-only" role="status">
        Loading the ranking
      </span>
      <div className="grid justify-items-center gap-4">
        <Line w={180} h={11} />
        <Line w="min(520px, 90%)" h={54} />
        <Line w="min(420px, 90%)" h={14} />
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Block key={i} w={104} h={38} r={99} />
        ))}
      </div>
      <Card radius="card-lg" shadow={4} className="mt-8 overflow-hidden">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-hairline-2 px-[22px] py-[15px] last:border-b-0">
            <Line w={22} h={13} />
            <Line w={`${34 - (i % 4) * 5}%`} h={15} />
            <Line w={60} h={13} className="ml-auto" />
            <Block w={46} h={28} r={9} />
          </div>
        ))}
      </Card>
    </Container>
  );
}

/** /app and /account: a heading and a stack of cards, whatever the view. */
export function PanelSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <Container as="section" width={1120} className="pb-24 pt-11">
      <span className="sr-only" role="status">
        Loading
      </span>
      <div className="grid gap-3">
        <Line w={150} h={11} />
        <Line w="min(420px, 80%)" h={36} />
      </div>
      <div className="mt-7 grid gap-4">
        {Array.from({ length: cards }, (_, i) => (
          <Card key={i} radius="card-lg" shadow={4} className="grid gap-3 p-6">
            <Line w={`${44 - i * 5}%`} h={18} />
            <Line h={12} />
            <Line w="64%" h={12} />
          </Card>
        ))}
      </div>
    </Container>
  );
}
