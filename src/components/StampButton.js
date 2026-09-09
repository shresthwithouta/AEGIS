'use client';

/**
 * Hold to stamp.
 *
 * Approval is the one irreversible act in this system, so it is the one act
 * that asks for a deliberate physical gesture rather than a click. Holding
 * fills the rule; releasing early abandons it; completing it lands an
 * impression on the sheet. A keyboard user holds Enter or Space, which is the
 * same gesture, and the countdown is announced.
 *
 * This is not friction for its own sake — an officer who clicks approve by
 * reflex has not approved anything, and the register would record that they had.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';

const HOLD_MS = 750;

export default function StampButton({ onComplete, label = 'Hold to stamp', tone = 'stamp', disabled, hint }) {
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const raf = useRef(null);
  const start = useRef(0);
  const fired = useRef(false);

  const stop = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setHeld(false);
    setProgress(0);
  }, []);

  const tick = useCallback(() => {
    const elapsed = performance.now() - start.current;
    const p = Math.min(1, elapsed / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      if (!fired.current) {
        fired.current = true;
        stop();
        onComplete?.();
      }
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }, [onComplete, stop]);

  const begin = useCallback(() => {
    if (disabled) return;
    fired.current = false;
    start.current = performance.now();
    setHeld(true);
    raf.current = requestAnimationFrame(tick);
  }, [disabled, tick]);

  useEffect(() => () => stop(), [stop]);

  // Reduced motion: the hold is a motion-free affordance, so honour it by
  // completing on a single press instead of a timed fill.
  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const colour = tone === 'danger' ? 'var(--tape)' : 'var(--stamp)';

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={disabled}
        className="btn relative overflow-hidden"
        data-tone={tone === 'danger' ? 'danger' : 'stamp'}
        onPointerDown={reduced ? undefined : begin}
        onPointerUp={reduced ? undefined : stop}
        onPointerLeave={reduced ? undefined : stop}
        onPointerCancel={reduced ? undefined : stop}
        onClick={reduced ? () => onComplete?.() : undefined}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !held && !reduced) {
            e.preventDefault();
            begin();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' || e.key === ' ') stop();
        }}
        aria-describedby={hint ? 'stamp-hint' : undefined}
      >
        {/* scaleX rather than width: this runs every frame of the hold, and a
            width animation would relayout the button on each one. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 block origin-left"
          style={{
            height: 2,
            background: colour,
            transform: `scaleX(${progress})`,
            transition: held ? 'none' : 'transform 140ms ease-out',
          }}
        />
        <Icon name="stamp" size={13} />
        {held ? `${Math.round(progress * 100)}%` : label}
      </button>
      {hint ? (
        <span id="stamp-hint" className="rail">
          {hint}
        </span>
      ) : null}
    </span>
  );
}
