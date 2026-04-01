import { useState, useEffect, useRef, useCallback } from 'react';

interface AfkConfig {
  enabled: boolean;
  matchId: string | null;
  isMyTurn: boolean;
  isBiddingPhase: boolean;
  gameStarted: boolean;
  winner: string | null;
  matchWinner: string | null;
}

interface AfkState {
  consecutiveAutoBids: number;
  isAway: boolean;
  recoveryCountdown: number | null;
}

const MAX_AUTO_BIDS_BEFORE_AWAY = 3;
const RECOVERY_SECONDS = 60;

/**
 * Tracks consecutive auto-bids/auto-moves. After 3, marks player "away"
 * and starts a 60s recovery countdown. If player doesn't interact before
 * countdown ends, triggers forfeit.
 */
export function useAfkDetection(
  config: AfkConfig,
  onForfeit: () => void,
) {
  const [state, setState] = useState<AfkState>({
    consecutiveAutoBids: 0,
    isAway: false,
    recoveryCountdown: null,
  });

  const recoveryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const forfeitCalledRef = useRef(false);

  // Clear any running timer
  const clearTimer = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearInterval(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  // Reset when match changes or game ends
  useEffect(() => {
    setState({ consecutiveAutoBids: 0, isAway: false, recoveryCountdown: null });
    clearTimer();
    forfeitCalledRef.current = false;
  }, [config.matchId, config.matchWinner, clearTimer]);

  // Start recovery countdown when away — uses a fresh interval each time
  useEffect(() => {
    if (!state.isAway || !config.enabled || config.matchWinner) {
      clearTimer();
      return;
    }

    // Already running? Don't restart
    if (recoveryTimerRef.current) return;

    forfeitCalledRef.current = false;
    let remaining = RECOVERY_SECONDS;
    setState(s => ({ ...s, recoveryCountdown: remaining }));

    recoveryTimerRef.current = setInterval(() => {
      remaining -= 1;
      setState(s => ({ ...s, recoveryCountdown: remaining }));

      if (remaining <= 0) {
        clearTimer();
        if (!forfeitCalledRef.current) {
          forfeitCalledRef.current = true;
          console.warn('[AFK] Recovery countdown expired — forfeiting');
          onForfeit();
        }
      }
    }, 1000);

    return () => clearTimer();
  }, [state.isAway, config.enabled, config.matchWinner, onForfeit, clearTimer]);

  /** Call this whenever an auto-action fires (auto-bid or auto-move) */
  const recordAutoAction = useCallback(() => {
    setState(prev => {
      const newCount = prev.consecutiveAutoBids + 1;
      if (newCount >= MAX_AUTO_BIDS_BEFORE_AWAY && !prev.isAway) {
        console.warn(`[AFK] ${newCount} consecutive auto-actions — marking player away`);
        return { consecutiveAutoBids: newCount, isAway: true, recoveryCountdown: RECOVERY_SECONDS };
      }
      return { ...prev, consecutiveAutoBids: newCount };
    });
  }, []);

  /** Call this whenever the player performs a manual action */
  const recordManualAction = useCallback(() => {
    setState(prev => {
      if (prev.consecutiveAutoBids === 0 && !prev.isAway) return prev;
      clearTimer();
      forfeitCalledRef.current = false;
      return { consecutiveAutoBids: 0, isAway: false, recoveryCountdown: null };
    });
  }, [clearTimer]);

  // Cleanup
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return {
    ...state,
    recordAutoAction,
    recordManualAction,
  };
}
