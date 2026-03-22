/**
 * Manages persistent player identity via localStorage.
 * - deviceId: stable across sessions (crypto.randomUUID)
 * - sessionToken: per-match, regenerated on each join
 */

const DEVICE_ID_KEY = 'victactoe_device_id';
const SESSION_KEY = 'victactoe_match_session';

export interface MatchSession {
  tournamentId: string;
  tournamentCode: string;
  playerId: string; // DB row id
  playerName: string;
  isHost: boolean;
  sessionToken: string;
  timestamp: number;
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function generateSessionToken(): string {
  return crypto.randomUUID();
}

export function saveMatchSession(session: MatchSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Also keep in sessionStorage for backward compat
  sessionStorage.setItem('tournament_session', JSON.stringify({
    tournamentId: session.tournamentId,
    tournamentCode: session.tournamentCode,
    isHost: session.isHost,
    currentPlayerId: session.playerId,
    playerName: session.playerName,
    timestamp: session.timestamp,
  }));
}

export function getMatchSession(): MatchSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session: MatchSession = JSON.parse(raw);
    // 24h expiry
    if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
      clearMatchSession();
      return null;
    }
    return session;
  } catch {
    clearMatchSession();
    return null;
  }
}

export function clearMatchSession(): void {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('tournament_session');
}
