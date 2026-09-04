'use client';

import { cx } from './ui';

/**
 * The 56×32 pill toggle: lime when on, a 24px white knob that slides across
 * in .2s. A real button with the switch role, so a screen reader announces it
 * as one.
 */
export function Toggle({
  on,
  onChange,
  label,
  disabled = false,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx(
        'edge flex h-8 w-14 flex-none cursor-pointer items-center rounded-full p-[2px] transition-colors duration-200 ease-in-out disabled:cursor-progress',
        on ? 'justify-end bg-lime' : 'justify-start bg-canvas',
      )}
    >
      <span aria-hidden="true" className="edge block h-6 w-6 rounded-full bg-white transition-all duration-200 ease-in-out" />
    </button>
  );
}
