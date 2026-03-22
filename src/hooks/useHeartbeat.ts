import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_INTERVAL = 5000; // 5s
const DISCONNECT_THRESHOLD = 15000; // 15s no heartbeat = disconnected
const GRACE_PERIOD = 60000; // 60s before forfeit

interface UseHeartbeatConfig {
  playerId: string | null;
  opponentId: string | null;
  enabled: boolean;
}

interface HeartbeatState {
  opponentDisconnected: boolean;
  opponentGraceRemaining: number | null; // seconds remaining
}

export function useHeartbeat(config: UseHeartbeatConfig): HeartbeatState {
  const [state, setState] = useState<HeartbeatState>({
    opponentDisconnected: false,
    opponentGraceRemaining: null,
  });
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const disconnectedAtRef = useRef<number | null>(null);

  // Send heartbeat
  useEffect(() => {
    if (!config.playerId || !config.enabled) return;

    const sendHeartbeat = async () => {
      await supabase
        .from('tournament_players')
        .update({
          last_heartbeat: new Date().toISOString(),
          connection_status: 'active',
        })
        .eq('id', config.playerId!);
    };

    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [config.playerId, config.enabled]);

  // Check opponent heartbeat
  useEffect(() => {
    if (!config.opponentId || !config.enabled) {
      setState({ opponentDisconnected: false, opponentGraceRemaining: null });
      disconnectedAtRef.current = null;
      return;
    }

    const checkOpponent = async () => {
      const { data } = await supabase
        .from('tournament_players')
        .select('last_heartbeat, connection_status')
        .eq('id', config.opponentId!)
        .single();

      if (!data) return;

      // If opponent intentionally left
      if (data.connection_status === 'left') {
        setState({ opponentDisconnected: true, opponentGraceRemaining: 0 });
        return;
      }

      const lastBeat = new Date(data.last_heartbeat).getTime();
      const elapsed = Date.now() - lastBeat;

      if (elapsed > DISCONNECT_THRESHOLD) {
        if (!disconnectedAtRef.current) {
          disconnectedAtRef.current = Date.now();
        }
        const graceElapsed = Date.now() - disconnectedAtRef.current;
        const remaining = Math.max(0, Math.ceil((GRACE_PERIOD - graceElapsed) / 1000));
        setState({ opponentDisconnected: true, opponentGraceRemaining: remaining });
      } else {
        disconnectedAtRef.current = null;
        setState({ opponentDisconnected: false, opponentGraceRemaining: null });
      }
    };

    checkOpponent();
    checkRef.current = setInterval(checkOpponent, 3000);

    return () => {
      if (checkRef.current) clearInterval(checkRef.current);
    };
  }, [config.opponentId, config.enabled]);

  // Set status to disconnected on visibilitychange/beforeunload
  useEffect(() => {
    if (!config.playerId || !config.enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Best-effort status update when tab goes hidden
        navigator.sendBeacon?.(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/tournament_players?id=eq.${config.playerId}`,
          // sendBeacon doesn't support PATCH easily, so we rely on heartbeat stopping
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [config.playerId, config.enabled]);

  return state;
}
