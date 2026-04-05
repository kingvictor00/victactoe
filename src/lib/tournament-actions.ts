import { getDeviceId, getMatchSession } from "@/hooks/usePlayerIdentity";
import { supabase } from "@/integrations/supabase/client";

export type TournamentActionName =
  | "submit_bid"
  | "finalize_bids"
  | "make_move"
  | "expire_phase"
  | "advance_round"
  | "forfeit_match"
  | "finalize_match";

export interface TournamentActionPayload {
  action: TournamentActionName;
  playerId: string;
  matchId: string;
  bidAmount?: number;
  moveIndex?: number;
  reason?: string;
}

export interface MoveOutcome {
  result: {
    winner: "X" | "O" | "tie" | null;
    line: number[] | null;
  };
  roundWinner: "X" | "O" | null;
  p1Bankrupt: boolean;
  p2Bankrupt: boolean;
  newP1Score: number;
  newP2Score: number;
  matchWinnerStr: "player1" | "player2" | null;
}

export interface TournamentActionResponse<TMatch = unknown> {
  success: boolean;
  action: TournamentActionName;
  match?: TMatch;
  moveOutcome?: MoveOutcome;
  progression?: {
    tournamentComplete: boolean;
    nextRoundCreated: boolean;
  };
  error?: string;
}

const RETRY_DELAYS_MS = [0, 350, 900];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function invokeTournamentAction<TMatch = unknown>(
  payload: TournamentActionPayload,
): Promise<TournamentActionResponse<TMatch>> {
  const session = getMatchSession();
  const sessionToken = session?.playerId === payload.playerId ? session.sessionToken : undefined;
  const deviceId = getDeviceId();

  let lastError: Error | null = null;

  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) {
      await sleep(delay);
    }

    const { data, error } = await supabase.functions.invoke("tournament-action", {
      body: {
        ...payload,
        sessionToken,
        deviceId,
      },
    });

    const response = (data ?? null) as TournamentActionResponse<TMatch> | null;

    if (!error && response?.success) {
      return response;
    }

    lastError = new Error(response?.error || error?.message || "Tournament action failed");
  }

  throw lastError ?? new Error("Tournament action failed");
}