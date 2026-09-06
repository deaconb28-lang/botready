import { cx } from '@/components/ui';

/**
 * The bot, pointing at the fix pack.
 *
 * Everything else in this panel argues from arithmetic: four of twelve
 * findings covered, seven files, 423 lines. All true, none of it warm. This is
 * the one thing on the panel that is only pleased for you, and that is its
 * whole job — the pack is the good news on a page that has spent the last
 * screenful listing what is wrong.
 *
 * Same anatomy as the scenes on /bot: 2.5px ink outline, 7px round-capped
 * limbs, coral bulb, lime eyes. Two things are drawn differently and both are
 * because it stands on violet rather than paper — the torso is lime instead of
 * indigo, which would vanish into the panel it sits on, and there is no card
 * behind it.
 *
 * The arm is the drawing, and the thing that governs it is length. The limbs
 * on /bot run 28 to 36 units against a 52-tall torso; a first pass here had a
 * single 64-unit arm against a 32-tall torso, roughly three times the house
 * ratio, and beside an 18-unit left arm it stopped reading as a pair of arms
 * at all — it read as a pole. Both arms are now the same limb: a short upper
 * arm out to an elbow, then a forearm up. The bend is what buys the height
 * without the length, and it puts the hand above the head, which is where a
 * raised hand goes.
 *
 * Decorative. The button it points at says what it is, and a screen reader
 * meeting "a happy robot points at the download button" learns nothing it
 * cannot already read.
 */

const INK = '#111318';
const WHITE = '#FFFFFF';
const LIME = '#C6F53C';
const CORAL = '#FF6B5A';

export function PackBot({ size = 112, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      // br-bob-soft is the standing scenes' breath, reused rather than
      // redeclared: globals.css holds every animation in one place so the
      // prefers-reduced-motion block cannot miss one, and this inherits that.
      className={cx('block br-fx br-bob-soft', className)}
      style={{ width: size }}
    >
      <svg viewBox="0 0 90 114" width={size} height={Math.round((size * 114) / 90)} fill="none">
        <path d="M38 30V20" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <circle cx="38" cy="14" r="5.5" fill={CORAL} stroke={INK} strokeWidth="2.5" />

        {/* Limbs first: they read as behind the body, which is what stops the
            shoulder joint needing to be drawn at all. */}
        <path d="M28 98v11M48 98v11" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        <path d="M17 74l-12 14" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        <path
          d="M59 76l11 3 8-32"
          stroke={INK}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <rect x="17" y="66" width="42" height="32" rx="11" fill={LIME} stroke={INK} strokeWidth="2.5" />
        <rect x="28" y="76" width="20" height="10" rx="3" fill={WHITE} stroke={INK} strokeWidth="2" />

        <rect x="16" y="30" width="44" height="36" rx="12" fill={WHITE} stroke={INK} strokeWidth="2.5" />
        <circle cx="29" cy="47" r="4.8" fill={LIME} stroke={INK} strokeWidth="2.5" />
        <circle cx="47" cy="47" r="4.8" fill={LIME} stroke={INK} strokeWidth="2.5" />
        <path d="M30 55q8 7 16 0" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
