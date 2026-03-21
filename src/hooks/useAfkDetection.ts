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
const RECOVERY_SECONDS = 15;

/**
 * Tracks consecutive auto-bids/auto-moves. After 3, marks player "away"
 * and starts a 15s recovery countdown. If player doesn't interact before
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
  const countdownRef = useRef<number>(RECOVERY_SECONDS);

  // Reset when match changes or game ends
  useEffect(() => {
    setState({ consecutiveAutoBids: 0, isAway: false, recoveryCountdown: null });
    if (recoveryTimerRef.current) {
      clearInterval(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, [config.matchId, config.matchWinner]);

  // Start recovery countdown when away
  useEffect(() => {
    if (!state.isAway || !config.enabled || config.matchWinner) {
      if (recoveryTimerRef.current) {
        clearInterval(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
      return;
    }

    countdownRef.current = RECOVERY_SECONDS;
    setState(s => ({ ...s, recoveryCountdown: RECOVERY_SECONDS }));

    recoveryTimerRef.current = setInterval(() => {
      countdownRef.current -= 1;
      const val = countdownRef.current;
      setState(s => ({ ...s, recoveryCountdown: val }));

      if (val <= 0) {
        if (recoveryTimerRef.current) {
          clearInterval(recoveryTimerRef.current);
          recoveryTimerRef.current = null;
        }
        console.warn('[AFK] Recovery countdown expired — forfeiting');
        onForfeit();
      }
    }, 1000);

    return () => {
      if (recoveryTimerRef.current) {
        clearInterval(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
    };
  }, [state.isAway, config.enabled, config.matchWinner, onForfeit]);

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
      if (recoveryTimerRef.current) {
        clearInterval(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
      return { consecutiveAutoBids: 0, isAway: false, recoveryCountdown: null };
    });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recoveryTimerRef.current) clearInterval(recoveryTimerRef.current);
    };
  }, []);

  return {
    ...state,
    recordAutoAction,
    recordManualAction,
  };
}
