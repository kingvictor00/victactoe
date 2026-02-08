import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WatchdogConfig {
  matchId: string | null;
  isPlayer1: boolean;
  isBiddingPhase: boolean;
  hasSubmittedBid: boolean;
  bidWinner: string | null;
  mySymbol: string;
  isProcessing: boolean;
  winner: string | null;
  enabled: boolean;
}

// Maximum time a phase can stall before auto-recovery
const PHASE_STALL_TIMEOUT = 30000; // 30 seconds
const BIDDING_FALLBACK_TIMEOUT = 25000; // 25 seconds for bidding
const MOVE_FALLBACK_TIMEOUT = 25000; // 25 seconds for moves

/**
 * Hook that monitors game state and auto-recovers from stalled phases
 * Prevents infinite freezes by forcing progression when necessary
 */
export const useTournamentWatchdog = (
  config: WatchdogConfig,
  onForceBid: () => void,
  onForceMove: () => void,
  onRefresh: () => void
) => {
  const lastStateChangeRef = useRef<number>(Date.now());
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const biddingFallbackRef = useRef<NodeJS.Timeout | null>(null);
  const moveFallbackRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    matchId,
    isPlayer1,
    isBiddingPhase,
    hasSubmittedBid,
    bidWinner,
    mySymbol,
    isProcessing,
    winner,
    enabled,
  } = config;
  
  // Track state changes
  useEffect(() => {
    lastStateChangeRef.current = Date.now();
  }, [isBiddingPhase, bidWinner, winner, isProcessing]);
  
  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    if (biddingFallbackRef.current) {
      clearTimeout(biddingFallbackRef.current);
      biddingFallbackRef.current = null;
    }
    if (moveFallbackRef.current) {
      clearTimeout(moveFallbackRef.current);
      moveFallbackRef.current = null;
    }
  }, []);
  
  // Master watchdog - detects general stalls
  useEffect(() => {
    if (!enabled || !matchId) {
      clearAllTimers();
      return;
    }
    
    // Set up periodic check for stalls
    const checkForStall = () => {
      const timeSinceLastChange = Date.now() - lastStateChangeRef.current;
      
      if (timeSinceLastChange > PHASE_STALL_TIMEOUT && !winner) {
        console.warn('[Watchdog] Phase stalled for too long, triggering refresh');
        onRefresh();
        lastStateChangeRef.current = Date.now();
      }
    };
    
    watchdogTimerRef.current = setInterval(checkForStall, 10000);
    
    return () => {
      if (watchdogTimerRef.current) {
        clearInterval(watchdogTimerRef.current);
      }
    };
  }, [enabled, matchId, winner, onRefresh, clearAllTimers]);
  
  // Bidding phase fallback - auto-submit minimum bid if stuck
  useEffect(() => {
    if (!enabled || !matchId || !isBiddingPhase || hasSubmittedBid || winner || isProcessing) {
      if (biddingFallbackRef.current) {
        clearTimeout(biddingFallbackRef.current);
        biddingFallbackRef.current = null;
      }
      return;
    }
    
    biddingFallbackRef.current = setTimeout(() => {
      console.warn('[Watchdog] Bidding phase timeout - auto-submitting minimum bid');
      onForceBid();
    }, BIDDING_FALLBACK_TIMEOUT);
    
    return () => {
      if (biddingFallbackRef.current) {
        clearTimeout(biddingFallbackRef.current);
        biddingFallbackRef.current = null;
      }
    };
  }, [enabled, matchId, isBiddingPhase, hasSubmittedBid, winner, isProcessing, onForceBid]);
  
  // Move phase fallback - auto-play random move if stuck
  useEffect(() => {
    if (
      !enabled ||
      !matchId ||
      isBiddingPhase ||
      bidWinner !== mySymbol ||
      winner ||
      isProcessing
    ) {
      if (moveFallbackRef.current) {
        clearTimeout(moveFallbackRef.current);
        moveFallbackRef.current = null;
      }
      return;
    }
    
    moveFallbackRef.current = setTimeout(() => {
      console.warn('[Watchdog] Move phase timeout - auto-playing random move');
      onForceMove();
    }, MOVE_FALLBACK_TIMEOUT);
    
    return () => {
      if (moveFallbackRef.current) {
        clearTimeout(moveFallbackRef.current);
        moveFallbackRef.current = null;
      }
    };
  }, [enabled, matchId, isBiddingPhase, bidWinner, mySymbol, winner, isProcessing, onForceMove]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);
  
  return {
    resetWatchdog: () => {
      lastStateChangeRef.current = Date.now();
    },
  };
};

export default useTournamentWatchdog;
