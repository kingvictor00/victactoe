import { supabase } from "@/integrations/supabase/client";

export interface TournamentPlayer {
  id: string;
  player_name: string;
  is_ready: boolean;
  seed_position: number | null;
  is_eliminated: boolean;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  player1_id: string;
  player2_id: string;
  round_number: number;
  status: string;
  match_winner: string | null;
}

// BYE player placeholder ID - used to identify automatic advancement
export const BYE_PLAYER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Calculate the number of rounds needed for a tournament
 */
export const calculateTotalRounds = (playerCount: number): number => {
  if (playerCount <= 1) return 0;
  return Math.ceil(Math.log2(playerCount));
};

/**
 * Calculate how many players get a BYE in round 1
 * BYEs = (next power of 2) - playerCount
 */
export const calculateByeCount = (playerCount: number): number => {
  if (playerCount <= 2) return 0; // Never BYE when only 2 players
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(playerCount)));
  return nextPowerOf2 - playerCount;
};

/**
 * Determine which players get BYEs in round 1
 * Higher seed positions get the BYEs (advantage for early joiners or random)
 */
export const getByePlayers = (
  players: TournamentPlayer[],
  byeCount: number
): TournamentPlayer[] => {
  const sorted = [...players]
    .filter(p => !p.is_eliminated)
    .sort((a, b) => (a.seed_position || 999) - (b.seed_position || 999));
  return sorted.slice(0, byeCount);
};

/**
 * Get players who will play in round 1 (non-BYE players)
 */
export const getPlayingPlayers = (
  players: TournamentPlayer[],
  byeCount: number
): TournamentPlayer[] => {
  const sorted = [...players]
    .filter(p => !p.is_eliminated)
    .sort((a, b) => (a.seed_position || 999) - (b.seed_position || 999));
  return sorted.slice(byeCount);
};

/**
 * Create first round matches with BYE handling
 */
export const createFirstRoundMatches = (
  tournamentId: string,
  players: TournamentPlayer[]
): { matches: Array<{ tournament_id: string; player1_id: string; player2_id: string; round_number: number; status: string }>; byePlayerIds: string[] } => {
  const playerCount = players.length;
  const byeCount = calculateByeCount(playerCount);
  
  const byePlayers = getByePlayers(players, byeCount);
  const playingPlayers = getPlayingPlayers(players, byeCount);
  
  const matches: Array<{ tournament_id: string; player1_id: string; player2_id: string; round_number: number; status: string }> = [];
  
  for (let i = 0; i < playingPlayers.length; i += 2) {
    if (i + 1 < playingPlayers.length) {
      matches.push({
        tournament_id: tournamentId,
        player1_id: playingPlayers[i].id,
        player2_id: playingPlayers[i + 1].id,
        round_number: 1,
        status: 'pending',
      });
    }
  }
  
  return {
    matches,
    byePlayerIds: byePlayers.map(p => p.id),
  };
};

/**
 * Create next round matches from the results of the current round.
 * 
 * This is the CORE progression function. It:
 * 1. Gathers winners from completed matches in the current round
 * 2. Adds BYE players (those not in any match this round) to the advancing pool
 * 3. If exactly 1 player remains -> tournament is over (returns false)
 * 4. If exactly 2 players remain -> creates the final match (NO BYEs)
 * 5. If >2 and odd -> gives 1 BYE, pairs the rest
 * 6. If >2 and even -> pairs all
 */
export const createNextRoundMatches = async (
  tournamentId: string,
  currentRoundNumber: number
): Promise<boolean> => {
  const nextRoundNumber = currentRoundNumber + 1;

  // Check if next round matches already exist (idempotency)
  const { count: existingCount } = await supabase
    .from('tournament_matches')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .eq('round_number', nextRoundNumber);

  if ((existingCount || 0) > 0) {
    console.log(`[Progression] Round ${nextRoundNumber} matches already exist, skipping`);
    return false;
  }

  // Get all matches from the current round
  const { data: currentRoundMatches } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('round_number', currentRoundNumber);

  if (!currentRoundMatches) return false;

  // Ensure ALL matches in this round are completed
  const allComplete = currentRoundMatches.every(m => m.status === 'completed');
  if (!allComplete) {
    console.log(`[Progression] Not all round ${currentRoundNumber} matches complete yet`);
    return false;
  }

  // Get winners from completed matches
  const roundWinners: string[] = currentRoundMatches
    .filter(m => m.match_winner)
    .map(m => m.match_winner === 'player1' ? m.player1_id : m.player2_id);

  // Get all non-eliminated players to find BYE players
  const { data: allPlayers } = await supabase
    .from('tournament_players')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('is_eliminated', false);

  if (!allPlayers) return false;

  // BYE players = non-eliminated players who were NOT in any match this round
  const playersInMatches = new Set<string>();
  currentRoundMatches.forEach(m => {
    playersInMatches.add(m.player1_id);
    playersInMatches.add(m.player2_id);
  });

  const byePlayerIds = allPlayers
    .filter(p => !playersInMatches.has(p.id))
    .map(p => p.id);

  // Combine winners + BYE players = advancing pool
  const advancingPlayers = [...roundWinners, ...byePlayerIds];

  console.log(`[Progression] Round ${currentRoundNumber} complete. Winners: ${roundWinners.length}, BYEs: ${byePlayerIds.length}, Total advancing: ${advancingPlayers.length}`);

  if (advancingPlayers.length <= 1) {
    // Tournament complete
    console.log('[Progression] Tournament complete - 1 or fewer players remain');
    return false;
  }

  // Build next round matches
  const nextRoundMatches: Array<{ tournament_id: string; player1_id: string; player2_id: string; round_number: number; status: string }> = [];

  if (advancingPlayers.length === 2) {
    // Finals - exactly 2 players, NO BYEs
    nextRoundMatches.push({
      tournament_id: tournamentId,
      player1_id: advancingPlayers[0],
      player2_id: advancingPlayers[1],
      round_number: nextRoundNumber,
      status: 'pending',
    });
  } else {
    // More than 2 players
    let playersToMatch = [...advancingPlayers];

    // If odd count, first player gets a BYE (skip this round)
    if (playersToMatch.length % 2 !== 0) {
      const byePlayer = playersToMatch.shift()!;
      console.log(`[Progression] Round ${nextRoundNumber}: Player ${byePlayer} gets a BYE`);
      // BYE player doesn't get a match - they'll be picked up next round
    }

    // Pair remaining players
    for (let i = 0; i < playersToMatch.length; i += 2) {
      nextRoundMatches.push({
        tournament_id: tournamentId,
        player1_id: playersToMatch[i],
        player2_id: playersToMatch[i + 1],
        round_number: nextRoundNumber,
        status: 'pending',
      });
    }
  }

  if (nextRoundMatches.length > 0) {
    const { error } = await supabase
      .from('tournament_matches')
      .insert(nextRoundMatches);

    if (error) {
      console.error('[Progression] Error creating next round matches:', error);
      return false;
    }

    // Reset ready state for ALL advancing players so they go through ready screen
    await supabase
      .from('tournament_players')
      .update({ is_ready: false })
      .in('id', advancingPlayers);

    console.log(`[Progression] Created ${nextRoundMatches.length} match(es) for round ${nextRoundNumber}`);
    return true;
  }

  return false;
};

/**
 * Get remaining active (non-eliminated) players
 */
export const getRemainingPlayers = (players: TournamentPlayer[]): TournamentPlayer[] => {
  return players.filter(p => !p.is_eliminated);
};

/**
 * Determine if tournament is complete (1 or 0 remaining players)
 */
export const isTournamentComplete = (players: TournamentPlayer[]): boolean => {
  return getRemainingPlayers(players).length <= 1;
};

/**
 * Generate fair random number using Web Crypto API
 */
export const generateFairCoinToss = (): boolean => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % 2 === 0;
};
