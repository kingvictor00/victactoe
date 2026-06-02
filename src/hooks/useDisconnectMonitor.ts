import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_INTERVAL_MS = 5000;
const OPPONENT_POLL_MS = 3000;
const STALE_THRESHOLD_MS = 12000; // opponent considered offline after 12s of silence
const INACTIVITY_MS = 45000; // 45s of no input also counts as disconnected
const COUNTDOWN_SECONDS = 60;

interface Config {
  playerId: string | null;
  opponentId: string | null;
  enabled: boolean;
  onForfeitOpponent: () => void;
}

interface State {
  opponentDisconnected: boolean;
  countdownSeconds: number | null;
  selfDisconnected: boolean;
}

export function useDisconnectMonitor({ playerId, opponentId, enabled, onForfeitOpponent }: Config) {
  const [state, setState] = useState<State>({
    opponentDisconnected: false,
    countdownSeconds: null,
    selfDisconnected: false,
  });

  const disconnectedAtRef = useRef<number | null>(null);
  const forfeitFiredRef = useRef(false);
  const onForfeitRef = useRef(onForfeitOpponent);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    onForfeitRef.current = onForfeitOpponent;
  }, [onForfeitOpponent]);

  // Reset when participants change
  useEffect(() => {
    disconnectedAtRef.current = null;
    forfeitFiredRef.current = false;
    setState({ opponentDisconnected: false, countdownSeconds: null, selfDisconnected: false });
  }, [playerId, opponentId]);

  const sendHeartbeat = useCallback(async (status: "active" | "disconnected" = "active") => {
    if (!playerId) return;
    try {
      await supabase
        .from("tournament_players")
        .update({ last_heartbeat: new Date().toISOString(), connection_status: status })
        .eq("id", playerId);
    } catch (err) {
      console.warn("[disconnect] heartbeat failed", err);
    }
  }, [playerId]);

  // Heartbeat loop + activity tracker
  useEffect(() => {
    if (!enabled || !playerId) return;

    sendHeartbeat("active");
    const bump = () => { lastActivityRef.current = Date.now(); };
    const events: (keyof DocumentEventMap)[] = ["mousedown", "keydown", "touchstart", "pointerdown"];
    events.forEach((e) => document.addEventListener(e, bump, { passive: true }));

    const interval = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      const idle = Date.now() - lastActivityRef.current;
      sendHeartbeat(idle > INACTIVITY_MS || document.hidden ? "disconnected" : "active");
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      events.forEach((e) => document.removeEventListener(e, bump));
    };
  }, [enabled, playerId, sendHeartbeat]);

  // online/offline + tab close detection
  useEffect(() => {
    if (!enabled || !playerId) return;

    const handleOffline = () => {
      setState((s) => ({ ...s, selfDisconnected: true }));
    };
    const handleOnline = () => {
      // keep selfDisconnected true until user clicks "I'm back" so they explicitly resume
    };
    const handleBeforeUnload = () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/tournament_players?id=eq.${playerId}`;
        const body = JSON.stringify({ connection_status: "disconnected", last_heartbeat: new Date(Date.now() - STALE_THRESHOLD_MS).toISOString() });
        const blob = new Blob([body], { type: "application/json" });
        // sendBeacon won't include auth headers; best-effort fallback uses fetch keepalive
        fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            Prefer: "return=minimal",
          },
          body,
          keepalive: true,
        }).catch(() => {});
        navigator.sendBeacon?.(url, blob);
      } catch {}
    };
    const handleVisibility = () => {
      if (document.hidden) {
        // mark disconnected so opponent's countdown starts; user sees "I'm back" on return
        sendHeartbeat("disconnected");
        setState((s) => ({ ...s, selfDisconnected: true }));
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, playerId, sendHeartbeat]);

  // Poll opponent
  useEffect(() => {
    if (!enabled || !opponentId) {
      disconnectedAtRef.current = null;
      forfeitFiredRef.current = false;
      setState((s) => ({ ...s, opponentDisconnected: false, countdownSeconds: null }));
      return;
    }

    let cancelled = false;

    const check = async () => {
      const { data } = await supabase
        .from("tournament_players")
        .select("last_heartbeat, connection_status")
        .eq("id", opponentId)
        .maybeSingle();
      if (cancelled || !data) return;

      const lastBeat = data.last_heartbeat ? new Date(data.last_heartbeat).getTime() : 0;
      const elapsed = Date.now() - lastBeat;
      const isLeft = data.connection_status === "left";
      const isDisconnected = data.connection_status === "disconnected" || elapsed > STALE_THRESHOLD_MS || isLeft;

      if (isDisconnected) {
        if (disconnectedAtRef.current === null) {
          disconnectedAtRef.current = Date.now();
          forfeitFiredRef.current = false;
        }
        const remaining = Math.max(0, Math.ceil((COUNTDOWN_SECONDS * 1000 - (Date.now() - disconnectedAtRef.current)) / 1000));
        setState((s) => ({ ...s, opponentDisconnected: true, countdownSeconds: remaining }));
        if (remaining <= 0 && !forfeitFiredRef.current) {
          forfeitFiredRef.current = true;
          onForfeitRef.current();
        }
      } else {
        disconnectedAtRef.current = null;
        forfeitFiredRef.current = false;
        setState((s) => (s.opponentDisconnected ? { ...s, opponentDisconnected: false, countdownSeconds: null } : s));
      }
    };

    check();
    const interval = setInterval(check, OPPONENT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, opponentId]);

  const imBack = useCallback(async () => {
    lastActivityRef.current = Date.now();
    await sendHeartbeat("active");
    setState((s) => ({ ...s, selfDisconnected: false }));
  }, [sendHeartbeat]);

  return {
    ...state,
    imBack,
    countdownTotal: COUNTDOWN_SECONDS,
  };
}