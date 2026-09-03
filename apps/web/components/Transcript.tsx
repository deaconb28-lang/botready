/**
 * The signature element: the same request, twice, as it went over the wire.
 *
 * Left, as a browser. Right, as a reading agent. Both columns are literal HTTP
 * transcripts — request line, headers, status line, the body's readable text —
 * because the product's whole argument is a disagreement between two responses
 * and the most convincing way to show a disagreement is to print both.
 *
 * On the landing page the lines land one after another, request first, then
 * the responses, then the left body fills while the right stays empty. Under
 * prefers-reduced-motion every line is simply there.
 *
 * On the result page it is fed a scan's real numbers and does not animate.
 */

import { REASON, statusOnPaper } from './primitives';

export interface TranscriptSide {
  /** Short name for the column heading. */
  client: string;
  /** The user agent, as sent. */
  userAgent: string;
  status: number;
  /** Response headers worth showing, in order. */
  headers: Array<[string, string]>;
  /** Readable text, or the lines of it, that came back. Empty for a refusal. */
  body: string[];
  /** Characters of readable text, for the caption. */
  chars: number;
}

export function Transcript({
  path = '/',
  host,
  left,
  right,
  animate = false,
  example = false,
}: {
  path?: string;
  host: string;
  left: TranscriptSide;
  right: TranscriptSide;
  animate?: boolean;
  example?: boolean;
}) {
  return (
    <figure className="m-0">
      <div className="grid grid-cols-1 border-y border-ink md:grid-cols-2">
        <Column side={left} host={host} path={path} animate={animate} offset={0} />
        <div className="border-t border-ink md:border-l md:border-t-0">
          <Column side={right} host={host} path={path} animate={animate} offset={1} />
        </div>
      </div>
      {example ? (
        <figcaption className="mono mt-3 text-[12px] text-ink-60">
          Drawn from a real scan of a client-rendered site. Run a check to see your own.
        </figcaption>
      ) : null}
    </figure>
  );
}

function Column({
  side,
  host,
  path,
  animate,
  offset,
}: {
  side: TranscriptSide;
  host: string;
  path: string;
  animate: boolean;
  offset: 0 | 1;
}) {
  const refused = side.status >= 400 || side.status === 0;
  // Request lines land first on both sides, then the responses, then bodies.
  // `offset` staggers the right column half a beat behind the left.
  let i = offset * 0.5;
  const line = (className = '') => {
    const style = animate ? { ['--i' as string]: i } : undefined;
    i += 1;
    return { className: `${animate ? 'br-land' : ''} ${className}`.trim(), style };
  };

  return (
    <div className="px-5 py-5 sm:px-7">
      <p className="label text-ink-60">{side.client}</p>

      <pre className="wire-line mt-3 m-0">
        <span {...line('block')}>
          <span className="font-bold">GET</span> {path} HTTP/1.1
        </span>
        <span {...line('block')}>Host: {host}</span>
        <span {...line('block text-ink-60')}>User-Agent: {side.userAgent}</span>
        <span {...line('block text-ink-60')}>Accept: text/html</span>
        <span {...line('block')}> </span>
        <span {...line('block')}>
          <span className="text-ink-60">HTTP/1.1 </span>
          <span className={`font-bold ${statusOnPaper(side.status)}`}>
            {side.status === 0 ? 'no response' : `${side.status} ${REASON[side.status] ?? ''}`}
          </span>
        </span>
        {side.headers.map(([k, v]) => (
          <span key={k} {...line(`block ${refused && k.toLowerCase().startsWith('cf-') ? 'text-fail' : 'text-ink-60'}`)}>
            {k}: {v}
          </span>
        ))}
        <span {...line('block')}> </span>
        {side.body.length > 0 ? (
          side.body.map((text, n) => (
            <span key={n} {...line('block')}>
              {text}
            </span>
          ))
        ) : (
          <span {...line(`block ${refused ? 'text-fail' : 'text-ink-60'}`)}>
            {refused ? '(nothing readable)' : '(empty)'}
          </span>
        )}
      </pre>

      <p
        className={`mono mt-4 border-t border-dashed border-rule pt-3 text-[12px] font-bold ${
          refused ? 'text-fail' : 'text-pass'
        }`}
      >
        {side.chars.toLocaleString('en-US')} readable characters
      </p>
    </div>
  );
}
