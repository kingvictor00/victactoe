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
 * For non-power-of-2 player counts, we still need ceiling of log2
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
  if (playerCount <= 1) return 0;
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
  // Sort by seed position, take top byeCount players as BYE recipients
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
 * Returns the matches to create and the list of BYE player IDs
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
  
  // Create matches for playing players
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
 * Create next round matches from winners + BYE players
 * This handles progression correctly for any player count
 */
export const createNextRoundMatches = async (
  tournamentId: string,
  currentRoundNumber: number,
  completedMatches: TournamentMatch[],
  byePlayerIds: string[] = []
): Promise<boolean> => {
  // Get winners from completed matches
  const roundWinners = completedMatches
    .filter(m => m.match_winner)
    .map(m => m.match_winner === 'player1' ? m.player1_id : m.player2_id);
  
  // Combine with BYE players (they advance automatically)
  const advancingPlayers = [...byePlayerIds, ...roundWinners];
  
  if (advancingPlayers.length < 2) {
    // Tournament complete or waiting for more matches
    return false;
  }
  
  const nextRoundNumber = currentRoundNumber + 1;
  
  // Check if next round matches already exist
  const { count: existingCount } = await supabase
    .from('tournament_matches')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .eq('round_number', nextRoundNumber);
  
  if ((existingCount || 0) > 0) {
    return false; // Already created
  }
  
  // Calculate BYEs for next round if odd number of advancing players
  const nextByeCount = advancingPlayers.length % 2;
  const nextByePlayerIds = advancingPlayers.slice(0, nextByeCount);
  const playersForMatches = advancingPlayers.slice(nextByeCount);
  
  const nextRoundMatches: Array<{ tournament_id: string; player1_id: string; player2_id: string; round_number: number; status: string }> = [];
  
  for (let i = 0; i < playersForMatches.length; i += 2) {
    if (i + 1 < playersForMatches.length) {
      nextRoundMatches.push({
        tournament_id: tournamentId,
        player1_id: playersForMatches[i],
        player2_id: playersForMatches[i + 1],
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
      console.error('Error creating next round matches:', error);
      return false;
    }
    
    // Reset ready state for advancing players
    await supabase
      .from('tournament_players')
      .update({ is_ready: false })
      .in('id', advancingPlayers);
    
    // Store BYE players for next round handling (they'll auto-advance again if needed)
    if (nextByePlayerIds.length > 0) {
      console.log(`Round ${nextRoundNumber} BYE players:`, nextByePlayerIds);
    }
    
    return true;
  }
  
  return false;
};

/**
 * Check if a player has a BYE for the current round
 */
export const checkPlayerHasBye = async (
  tournamentId: string,
  playerId: string,
  roundNumber: number
): Promise<boolean> => {
  // Player has BYE if they're not in any match for this round
  const { data: matches } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('round_number', roundNumber)
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
  
  return !matches || matches.length === 0;
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
