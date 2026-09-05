import { cx } from '@/components/ui';

/**
 * What happens after the card goes through, said before it does.
 *
 * Two things a buyer needs to know at the moment they click, and the order
 * matters: the files open in the browser, and the email is only a copy. Our
 * mail lands in Gmail's spam folder often enough that somebody who thinks the
 * email *is* the delivery will sit waiting for something that arrived on their
 * screen a minute ago.
 *
 * `on` matches the ground: `violet` inside the fix pack panel, `light` on white.
 */
export function DeliveryNote({ on = 'light', className = '' }: { on?: 'light' | 'violet'; className?: string }) {
  return (
    <p className={cx('text-[12.5px] leading-[1.5]', on === 'violet' ? 'text-on-violet-2' : 'text-subtle-2', className)}>
      Your files open here in the browser the second you pay. We email a copy too, so check your spam folder for it: we are a
      new domain and filters have not met us yet.
    </p>
  );
}
