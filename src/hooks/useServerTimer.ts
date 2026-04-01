import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * High-precision countdown timer that derives remaining time from
 * an absolute deadline (phase_deadline) rather than client-side decrement.
 *
 * Uses requestAnimationFrame for smooth, drift-free updates.
 * Updates the displayed integer only when it actually changes (no re-renders on sub-second ticks).
 */
export function useServerTimer(
  deadline: string | null,
  enabled: boolean,
  onExpire?: () => void,
) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const rafRef = useRef(0);
  const expiredRef = useRef(false);
  const lastSecRef = useRef(-1);

  // Reset expired flag when deadline changes
  useEffect(() => {
    expiredRef.current = false;
    lastSecRef.current = -1;
  }, [deadline]);

  useEffect(() => {
    if (!enabled || !deadline) {
      setSecondsLeft(0);
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const deadlineMs = new Date(deadline).getTime();

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));

      // Only update state when the displayed second changes
      if (remaining !== lastSecRef.current) {
        lastSecRef.current = remaining;
        setSecondsLeft(remaining);
      }

      if (remaining <= 0) {
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpire?.();
        }
        return; // stop RAF loop
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [deadline, enabled, onExpire]);

  return secondsLeft;
}

/**
 * Simple local countdown timer (no server deadline) using RAF for accuracy.
 * Used in single-player / computer mode.
 */
export function useLocalTimer(
  durationSec: number,
  enabled: boolean,
  resetKey: unknown, // changes trigger reset
  onExpire?: () => void,
) {
  const [secondsLeft, setSecondsLeft] = useState(durationSec);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const expiredRef = useRef(false);
  const lastSecRef = useRef(-1);

  // Reset on key change
  useEffect(() => {
    startRef.current = Date.now();
    expiredRef.current = false;
    lastSecRef.current = -1;
    setSecondsLeft(durationSec);
  }, [resetKey, durationSec]);

  useEffect(() => {
    if (!enabled) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    startRef.current = Date.now();
    expiredRef.current = false;

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, Math.ceil((durationSec * 1000 - elapsed) / 1000));

      if (remaining !== lastSecRef.current) {
        lastSecRef.current = remaining;
        setSecondsLeft(remaining);
      }

      if (remaining <= 0) {
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpire?.();
        }
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [enabled, durationSec, onExpire]);

  return secondsLeft;
}
