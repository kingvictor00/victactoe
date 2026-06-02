import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHASE_TIME = 20;
const ROUND_RESULT_DELAY = 3000;
const INITIAL_COINS = 100;

type Player = "X" | "O";
type CellValue = Player | null;
type Board = CellValue[];

type TournamentActionName =
  | "submit_bid"
  | "finalize_bids"
  | "make_move"
  | "expire_phase"
  | "advance_round"
  | "forfeit_match"
  | "finalize_match";

interface ActionBody {
  action: TournamentActionName;
  playerId: string;
  matchId: string;
  sessionToken?: string;
  deviceId?: string;
  bidAmount?: number;
  moveIndex?: number;
  reason?: string;
  forfeitPlayerId?: string;
}

interface TournamentPlayerRow {
  id: string;
  tournament_id: string;
  player_name: string;
  is_eliminated: boolean;
  is_ready: boolean;
  session_token: string | null;
  device_id: string | null;
  connection_status: string;
  seed_position: number | null;
}

interface TournamentMatchRow {
  id: string;
  tournament_id: string;
  player1_id: string;
  player2_id: string;
  board: string;
  current_turn: string;
  winner: string | null;
  winning_line: string | null;
  status: string;
  player1_coins: number;
  player2_coins: number;
  player1_score: number;
  player2_score: number;
  current_round: number;
  is_bidding_phase: boolean;
  player1_bid: number | null;
  player2_bid: number | null;
  bid_winner: string | null;
  last_bid_result: { player1Bid: number; player2Bid: number; winner: Player } | null;
  phase_deadline: string | null;
  match_winner: string | null;
  round_number: number;
}

interface MoveOutcome {
  result: {
    winner: Player | "tie" | null;
    line: number[] | null;
  };
  roundWinner: Player | null;
  p1Bankrupt: boolean;
  p2Bankrupt: boolean;
  newP1Score: number;
  newP2Score: number;
  matchWinnerStr: "player1" | "player2" | null;
}

interface ProgressionResult {
  tournamentComplete: boolean;
  nextRoundCreated: boolean;
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });

const boardStringToArray = (boardStr: string): Board =>
  boardStr.split("").map((value) => (value === "-" ? null : (value as Player)));

const boardArrayToString = (board: Board) =>
  board.map((value) => (value === null ? "-" : value)).join("");

const evaluateBoardState = (
  currentBoard: Board,
  p1Coins: number,
  p2Coins: number,
): { winner: Player | "tie" | null; line: number[] | null } => {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
      return { winner: currentBoard[a], line: combo };
    }
  }

  if (currentBoard.every((cell) => cell !== null)) {
    if (p1Coins > p2Coins) return { winner: "X", line: null };
    if (p2Coins > p1Coins) return { winner: "O", line: null };
    return { winner: "tie", line: null };
  }

  return { winner: null, line: null };
};

const selectAutoMove = (currentBoard: Board, symbol: Player): number => {
  const findLineMove = (target: Player) => {
    for (const combo of WINNING_COMBINATIONS) {
      const values = combo.map((index) => currentBoard[index]);
      const targetCount = values.filter((value) => value === target).length;
      const emptyCount = values.filter((value) => value === null).length;

      if (targetCount === 2 && emptyCount === 1) {
        return combo.find((index) => currentBoard[index] === null) ?? null;
      }
    }

    return null;
  };

  return (
    findLineMove(symbol) ??
    findLineMove(symbol === "X" ? "O" : "X") ??
    (currentBoard[4] === null ? 4 : null) ??
    [0, 2, 6, 8].find((index) => currentBoard[index] === null) ??
    currentBoard.findIndex((cell) => cell === null)
  );
};

const nowIso = () => new Date().toISOString();

const getPlayerSymbol = (match: TournamentMatchRow, playerId: string): Player =>
  match.player1_id === playerId ? "X" : "O";

const getMatchWinnerPlayerId = (match: TournamentMatchRow, matchWinner: "player1" | "player2") =>
  matchWinner === "player1" ? match.player1_id : match.player2_id;

const getLoserPlayerId = (match: TournamentMatchRow, matchWinner: "player1" | "player2") =>
  matchWinner === "player1" ? match.player2_id : match.player1_id;

async function fetchMatchById(admin: ReturnType<typeof createClient>, matchId: string) {
  const { data, error } = await admin
    .from("tournament_matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Match not found");
  return data as TournamentMatchRow;
}

async function verifyActor(admin: ReturnType<typeof createClient>, playerId: string, sessionToken?: string, deviceId?: string) {
  const { data, error } = await admin
    .from("tournament_players")
    .select("*")
    .eq("id", playerId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Player not found");

  const player = data as TournamentPlayerRow;

  // Update device_id / session_token if provided (helps with reconnection)
  if (deviceId && player.device_id !== deviceId) {
    await admin
      .from("tournament_players")
      .update({ device_id: deviceId })
      .eq("id", playerId);
  }
  if (sessionToken && player.session_token !== sessionToken) {
    await admin
      .from("tournament_players")
      .update({ session_token: sessionToken })
      .eq("id", playerId);
  }

  return player;
}

async function getPlayerMatch(admin: ReturnType<typeof createClient>, matchId: string, playerId: string) {
  const { data, error } = await admin
    .from("tournament_matches")
    .select("*")
    .eq("id", matchId)
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Match not found for this player");
  return data as TournamentMatchRow;
}

async function finalizeBids(admin: ReturnType<typeof createClient>, match: TournamentMatchRow) {
  if (
    match.status !== "playing" ||
    !match.is_bidding_phase ||
    match.match_winner ||
    match.player1_bid === null ||
    match.player2_bid === null
  ) {
    return match;
  }

  if (match.bid_winner && !match.is_bidding_phase) {
    return match;
  }

  let bidWinnerSymbol: Player;

  if (match.player1_bid > match.player2_bid) {
    bidWinnerSymbol = "X";
  } else if (match.player2_bid > match.player1_bid) {
    bidWinnerSymbol = "O";
  } else {
    const toss = new Uint32Array(1);
    crypto.getRandomValues(toss);
    bidWinnerSymbol = toss[0] % 2 === 0 ? "X" : "O";
  }

  // Account for the client-side announcement (coin flip + result reveal) so
  // the move timer feels fresh when "Your turn" appears.
  const isTie = match.player1_bid === match.player2_bid;
  const ANNOUNCEMENT_MS = isTie ? 6000 : 3000; // 3s coin flip + 3s result, or just 3s result

  const { data } = await admin
    .from("tournament_matches")
    .update({
      player1_coins: Math.max(0, match.player1_coins - match.player1_bid),
      player2_coins: Math.max(0, match.player2_coins - match.player2_bid),
      bid_winner: bidWinnerSymbol,
      current_turn: bidWinnerSymbol,
      is_bidding_phase: false,
      player1_bid: null,
      player2_bid: null,
      phase_deadline: new Date(Date.now() + ANNOUNCEMENT_MS + PHASE_TIME * 1000).toISOString(),
      last_bid_result: {
        player1Bid: match.player1_bid,
        player2Bid: match.player2_bid,
        winner: bidWinnerSymbol,
      },
    })
    .eq("id", match.id)
    .eq("status", "playing")
    .eq("is_bidding_phase", true)
    .is("match_winner", null)
    .is("bid_winner", null)
    .eq("player1_bid", match.player1_bid)
    .eq("player2_bid", match.player2_bid)
    .select("*")
    .maybeSingle();

  if (data) {
    return data as TournamentMatchRow;
  }

  return await fetchMatchById(admin, match.id);
}

async function createNextRoundMatchesAdmin(
  admin: ReturnType<typeof createClient>,
  tournamentId: string,
  currentRoundNumber: number,
) {
  const nextRoundNumber = currentRoundNumber + 1;

  const { count, error: countError } = await admin
    .from("tournament_matches")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("round_number", nextRoundNumber);

  if (countError) throw new HttpError(500, countError.message);
  if ((count ?? 0) > 0) {
    return false;
  }

  const { data: currentRoundMatches, error: currentRoundError } = await admin
    .from("tournament_matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("round_number", currentRoundNumber);

  if (currentRoundError) throw new HttpError(500, currentRoundError.message);
  if (!currentRoundMatches || currentRoundMatches.length === 0) return false;
  if (currentRoundMatches.some((match) => match.status !== "completed")) return false;

  const roundWinners = currentRoundMatches
    .filter((match) => match.match_winner)
    .map((match) => (match.match_winner === "player1" ? match.player1_id : match.player2_id));

  const { data: allPlayers, error: allPlayersError } = await admin
    .from("tournament_players")
    .select("id, is_eliminated")
    .eq("tournament_id", tournamentId)
    .eq("is_eliminated", false);

  if (allPlayersError) throw new HttpError(500, allPlayersError.message);
  if (!allPlayers) return false;

  const playersInMatches = new Set<string>();
  currentRoundMatches.forEach((match) => {
    playersInMatches.add(match.player1_id);
    playersInMatches.add(match.player2_id);
  });

  const byePlayerIds = allPlayers
    .filter((player) => !playersInMatches.has(player.id))
    .map((player) => player.id);

  const advancingPlayers = [...roundWinners, ...byePlayerIds];
  if (advancingPlayers.length <= 1) return false;

  const nextRoundMatches: Array<{
    tournament_id: string;
    player1_id: string;
    player2_id: string;
    round_number: number;
    status: string;
  }> = [];

  if (advancingPlayers.length === 2) {
    nextRoundMatches.push({
      tournament_id: tournamentId,
      player1_id: advancingPlayers[0],
      player2_id: advancingPlayers[1],
      round_number: nextRoundNumber,
      status: "pending",
    });
  } else {
    const playersToMatch = [...advancingPlayers];
    if (playersToMatch.length % 2 !== 0) {
      playersToMatch.shift();
    }

    for (let index = 0; index < playersToMatch.length; index += 2) {
      nextRoundMatches.push({
        tournament_id: tournamentId,
        player1_id: playersToMatch[index],
        player2_id: playersToMatch[index + 1],
        round_number: nextRoundNumber,
        status: "pending",
      });
    }
  }

  if (nextRoundMatches.length === 0) return false;

  const { error: insertError } = await admin
    .from("tournament_matches")
    .insert(nextRoundMatches);

  if (insertError) throw new HttpError(500, insertError.message);

  const { error: readyResetError } = await admin
    .from("tournament_players")
    .update({ is_ready: false })
    .in("id", advancingPlayers);

  if (readyResetError) throw new HttpError(500, readyResetError.message);

  return true;
}

async function finalizeMatchProgression(admin: ReturnType<typeof createClient>, match: TournamentMatchRow): Promise<ProgressionResult> {
  if (!match.match_winner || match.status !== "completed") {
    return {
      tournamentComplete: false,
      nextRoundCreated: false,
    };
  }

  const matchWinner = match.match_winner as "player1" | "player2";
  const loserId = getLoserPlayerId(match, matchWinner);

  const { error: eliminateError } = await admin
    .from("tournament_players")
    .update({ is_eliminated: true })
    .eq("id", loserId);

  if (eliminateError) throw new HttpError(500, eliminateError.message);

  const { data: latestPlayers, error: playersError } = await admin
    .from("tournament_players")
    .select("id, is_eliminated")
    .eq("tournament_id", match.tournament_id);

  if (playersError) throw new HttpError(500, playersError.message);

  const remainingPlayers = (latestPlayers ?? []).filter((player) => !player.is_eliminated);

  if (remainingPlayers.length <= 1) {
    const { error: tournamentError } = await admin
      .from("tournaments")
      .update({
        status: "completed",
        completed_at: nowIso(),
      })
      .eq("id", match.tournament_id)
      .neq("status", "completed");

    if (tournamentError) throw new HttpError(500, tournamentError.message);

    return {
      tournamentComplete: true,
      nextRoundCreated: false,
    };
  }

  const nextRoundCreated = await createNextRoundMatchesAdmin(admin, match.tournament_id, match.round_number || 1);

  return {
    tournamentComplete: false,
    nextRoundCreated,
  };
}

async function applyMoveUpdateAdmin(
  admin: ReturnType<typeof createClient>,
  match: TournamentMatchRow,
  index: number,
  moveSymbol: Player,
) {
  const snapshotBoard = boardStringToArray(match.board);
  if (snapshotBoard[index] !== null || match.winner || match.match_winner) {
    return null;
  }

  const newBoard = [...snapshotBoard];
  newBoard[index] = moveSymbol;
  const newBoardStr = boardArrayToString(newBoard);
  const nextTurn = moveSymbol === "X" ? "O" : "X";
  const result = evaluateBoardState(newBoard, match.player1_coins, match.player2_coins);
  const p1Bankrupt = match.player1_coins < 1;
  const p2Bankrupt = match.player2_coins < 1;

  let roundWinner: Player | null = null;
  if (result.winner) {
    roundWinner = result.winner === "tie" ? null : result.winner;
  } else if (p1Bankrupt) {
    roundWinner = "O";
  } else if (p2Bankrupt) {
    roundWinner = "X";
  }

  const updateData: Record<string, unknown> = {
    board: newBoardStr,
    current_turn: nextTurn,
  };

  let newP1Score = match.player1_score;
  let newP2Score = match.player2_score;
  let matchWinnerStr: "player1" | "player2" | null = null;

  if (roundWinner || result.winner === "tie") {
    const p1Wins = roundWinner === "X";
    newP1Score += p1Wins ? 1 : 0;
    newP2Score += !p1Wins && roundWinner ? 1 : 0;

    updateData.winner = result.winner || roundWinner;
    updateData.winning_line = result.line ? JSON.stringify(result.line) : null;
    updateData.player1_score = newP1Score;
    updateData.player2_score = newP2Score;

    if (newP1Score >= 2 || newP2Score >= 2) {
      matchWinnerStr = newP1Score >= 2 ? "player1" : "player2";
      updateData.match_winner = matchWinnerStr;
      updateData.status = "completed";
      updateData.completed_at = nowIso();
      updateData.phase_deadline = null;
      updateData.is_bidding_phase = false;
      updateData.player1_bid = null;
      updateData.player2_bid = null;
      updateData.bid_winner = null;
    } else {
      updateData.phase_deadline = new Date(Date.now() + ROUND_RESULT_DELAY).toISOString();
    }
  } else {
    updateData.is_bidding_phase = true;
    updateData.bid_winner = null;
    updateData.phase_deadline = new Date(Date.now() + PHASE_TIME * 1000).toISOString();
    updateData.player1_bid = null;
    updateData.player2_bid = null;
  }

  const { data: updatedMatch, error } = await admin
    .from("tournament_matches")
    .update(updateData)
    .eq("id", match.id)
    .eq("board", match.board)
    .eq("current_turn", moveSymbol)
    .eq("is_bidding_phase", false)
    .is("winner", null)
    .is("match_winner", null)
    .select("*")
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!updatedMatch) {
    return null;
  }

  return {
    updatedMatch: updatedMatch as TournamentMatchRow,
    moveOutcome: {
      result,
      roundWinner,
      p1Bankrupt,
      p2Bankrupt,
      newP1Score,
      newP2Score,
      matchWinnerStr,
    } satisfies MoveOutcome,
  };
}

async function advanceRound(admin: ReturnType<typeof createClient>, match: TournamentMatchRow) {
  if (
    match.status !== "playing" ||
    !match.winner ||
    match.match_winner
  ) {
    return match;
  }

  if (match.phase_deadline && new Date(match.phase_deadline).getTime() > Date.now()) {
    return match;
  }

  const { data } = await admin
    .from("tournament_matches")
    .update({
      board: "---------",
      current_turn: "X",
      winner: null,
      winning_line: null,
      is_bidding_phase: true,
      bid_winner: null,
      player1_coins: INITIAL_COINS,
      player2_coins: INITIAL_COINS,
      current_round: match.current_round + 1,
      phase_deadline: new Date(Date.now() + PHASE_TIME * 1000).toISOString(),
      player1_bid: null,
      player2_bid: null,
      last_bid_result: null,
    })
    .eq("id", match.id)
    .eq("current_round", match.current_round)
    .eq("status", "playing")
    .eq("winner", match.winner)
    .is("match_winner", null)
    .select("*")
    .maybeSingle();

  if (data) {
    return data as TournamentMatchRow;
  }

  return await fetchMatchById(admin, match.id);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new HttpError(500, "Backend environment is not configured");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const body = (await req.json()) as ActionBody;
    const { action, playerId, matchId, sessionToken, deviceId } = body;

    if (!action || !playerId || !matchId) {
      throw new HttpError(400, "Missing required action fields");
    }

    await verifyActor(admin, playerId, sessionToken, deviceId);
    const match = await getPlayerMatch(admin, matchId, playerId);

    switch (action) {
      case "submit_bid": {
        if (match.status !== "playing" || !match.is_bidding_phase || match.match_winner) {
          throw new HttpError(409, "Bidding is no longer available");
        }

        const requestedBid = Number(body.bidAmount);
        if (!Number.isFinite(requestedBid)) {
          throw new HttpError(400, "Missing or invalid bid amount");
        }

        const isPlayer1 = match.player1_id === playerId;
        const bidColumn = isPlayer1 ? "player1_bid" : "player2_bid";
        const currentBid = isPlayer1 ? match.player1_bid : match.player2_bid;
        const maxBid = Math.max(1, isPlayer1 ? match.player1_coins : match.player2_coins);
        const actualBid = Math.max(1, Math.min(Math.floor(requestedBid), maxBid));

        if (currentBid !== null) {
          return json({
            success: true,
            action,
            match,
          });
        }

        const { data } = await admin
          .from("tournament_matches")
          .update({ [bidColumn]: actualBid })
          .eq("id", match.id)
          .eq("status", "playing")
          .eq("is_bidding_phase", true)
          .is("match_winner", null)
          .is(bidColumn, null)
          .select("*")
          .maybeSingle();

        return json({
          success: true,
          action,
          match: (data as TournamentMatchRow | null) ?? await fetchMatchById(admin, match.id),
        });
      }

      case "finalize_bids": {
        const finalizedMatch = await finalizeBids(admin, match);

        return json({
          success: true,
          action,
          match: finalizedMatch,
        });
      }

      case "make_move": {
        if (match.status !== "playing" || match.is_bidding_phase || match.match_winner || match.winner) {
          throw new HttpError(409, "Moves are not currently allowed");
        }

        const moveIndex = Number(body.moveIndex);
        if (!Number.isInteger(moveIndex) || moveIndex < 0 || moveIndex > 8) {
          throw new HttpError(400, "Missing or invalid move index");
        }

        const playerSymbol = getPlayerSymbol(match, playerId);
        if (match.current_turn !== playerSymbol || match.bid_winner !== playerSymbol) {
          throw new HttpError(409, "It is not this player's turn");
        }

        const result = await applyMoveUpdateAdmin(admin, match, moveIndex, playerSymbol);
        if (!result) {
          throw new HttpError(409, "Move could not be applied");
        }

        const progression = result.moveOutcome.matchWinnerStr
          ? await finalizeMatchProgression(admin, result.updatedMatch)
          : { tournamentComplete: false, nextRoundCreated: false };

        return json({
          success: true,
          action,
          match: result.updatedMatch,
          moveOutcome: result.moveOutcome,
          progression,
        });
      }

      case "expire_phase": {
        if (match.status !== "playing" || match.match_winner) {
          return json({
            success: true,
            action,
            match,
          });
        }

        if (match.phase_deadline && new Date(match.phase_deadline).getTime() > Date.now()) {
          return json({
            success: true,
            action,
            match,
          });
        }

        if (match.is_bidding_phase) {
          const updateData: Record<string, number> = {};

          if (match.player1_bid === null) updateData.player1_bid = 1;
          if (match.player2_bid === null) updateData.player2_bid = 1;

          if (Object.keys(updateData).length === 0) {
            return json({ success: true, action, match });
          }

          const { data } = await admin
            .from("tournament_matches")
            .update(updateData)
            .eq("id", match.id)
            .eq("status", "playing")
            .eq("is_bidding_phase", true)
            .is("match_winner", null)
            .eq("current_round", match.current_round)
            .select("*")
            .maybeSingle();

          return json({
            success: true,
            action,
            match: (data as TournamentMatchRow | null) ?? await fetchMatchById(admin, match.id),
          });
        }

        const turnSymbol = match.current_turn as Player;
        const moveIndex = selectAutoMove(boardStringToArray(match.board), turnSymbol);
        if (moveIndex < 0) {
          return json({ success: true, action, match });
        }

        const result = await applyMoveUpdateAdmin(admin, match, moveIndex, turnSymbol);
        if (!result) {
          return json({
            success: true,
            action,
            match: await fetchMatchById(admin, match.id),
          });
        }

        const progression = result.moveOutcome.matchWinnerStr
          ? await finalizeMatchProgression(admin, result.updatedMatch)
          : { tournamentComplete: false, nextRoundCreated: false };

        return json({
          success: true,
          action,
          match: result.updatedMatch,
          moveOutcome: result.moveOutcome,
          progression,
        });
      }

      case "advance_round": {
        const advancedMatch = await advanceRound(admin, match);

        return json({
          success: true,
          action,
          match: advancedMatch,
        });
      }

      case "forfeit_match": {
        const matchWinner = match.player1_id === playerId ? "player2" : "player1";

        const { data } = await admin
          .from("tournament_matches")
          .update({
            match_winner: matchWinner,
            status: "completed",
            completed_at: nowIso(),
            phase_deadline: null,
            is_bidding_phase: false,
            player1_bid: null,
            player2_bid: null,
            bid_winner: null,
          })
          .eq("id", match.id)
          .is("match_winner", null)
          .select("*")
          .maybeSingle();

        const forfeitedMatch = (data as TournamentMatchRow | null) ?? await fetchMatchById(admin, match.id);

        const playerPatch: Record<string, unknown> = { is_eliminated: true };
        if (body.reason === "leave" || body.reason === "disconnect") {
          playerPatch.connection_status = "left";
        }

        await admin
          .from("tournament_players")
          .update(playerPatch)
          .eq("id", playerId);

        const progression = await finalizeMatchProgression(admin, forfeitedMatch);

        return json({
          success: true,
          action,
          match: forfeitedMatch,
          progression,
        });
      }

      case "finalize_match": {
        const progression = await finalizeMatchProgression(admin, match);

        return json({
          success: true,
          action,
          match: await fetchMatchById(admin, match.id),
          progression,
        });
      }
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected backend error";
    console.error("[tournament-action]", error);
    return json({ success: false, error: message }, status);
  }
});