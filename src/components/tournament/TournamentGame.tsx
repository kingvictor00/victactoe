import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, Check, Loader2, ArrowLeft, Coins, Clock, ArrowRight, Volume2, VolumeX, Music, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FloatingBackground from "@/components/ui/FloatingBackground";
import ConfirmLeaveDialog from "@/components/ui/ConfirmLeaveDialog";
import TournamentWinner from "./TournamentWinner";
import RobohashAvatar from "@/components/ui/RobohashAvatar";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useTournamentWatchdog } from "@/hooks/useTournamentWatchdog";
import { useGameSounds } from "@/hooks/useGameSounds";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";
import { useAfkDetection } from "@/hooks/useAfkDetection";
import { 
  createNextRoundMatches, 
  getRemainingPlayers,
  generateFairCoinToss,
} from "@/lib/tournament-utils";

type Player = "X" | "O";
type CellValue = Player | null;
type Board = CellValue[];

interface TournamentPlayer {
  id: string;
  player_name: string;
  is_ready: boolean;
  seed_position: number | null;
  is_eliminated: boolean;
}

interface TournamentMatch {
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

interface TournamentGameProps {
  tournamentId: string;
  currentPlayerId: string;
  onBack: () => void;
}

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const INITIAL_COINS = 100;
const PHASE_TIME = 20; // 20 seconds for bidding and moves
const BID_RESULT_DELAY = 3000; // 3 seconds to show bid results
const ROUND_RESULT_DELAY = 3000; // 3 seconds to show round results
const COIN_TOSS_ANIMATION_TIME = 2000; // 2 seconds for coin toss animation
const COIN_TOSS_TIMEOUT = 5000; // 5 second timeout for P1's result

// Helper: ordinal suffix
const getOrdinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Convert board string to array
const boardStringToArray = (boardStr: string): Board => {
  return boardStr.split('').map(c => c === '-' ? null : c as Player);
};

// Convert board array to string
const boardArrayToString = (board: Board): string => {
  return board.map(c => c === null ? '-' : c).join('');
};

type NotificationType = "bid_win" | "bid_lose" | "tie_coin_toss" | "round_win" | "round_lose" | "match_win" | "match_lose" | "opponent_turn" | "your_turn" | "coin_toss_animation" | "opponent_forfeit" | "bye_advancement";

interface Notification {
  type: NotificationType;
  message: string;
  subMessage?: string;
}

export default function TournamentGame({
  tournamentId,
  currentPlayerId,
  onBack,
}: TournamentGameProps) {
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [allPlayers, setAllPlayers] = useState<TournamentPlayer[]>([]);
  const [tournamentName, setTournamentName] = useState("");
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playerBid, setPlayerBid] = useState(10);
  const [timeLeft, setTimeLeft] = useState(PHASE_TIME);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTournamentWinner, setShowTournamentWinner] = useState(false);
  const [tournamentRankings, setTournamentRankings] = useState<{ id: string; name: string; position: number; isCurrentPlayer: boolean }[]>([]);
  const [totalPlayerCount, setTotalPlayerCount] = useState(0);
  const [hasByeAdvancement, setHasByeAdvancement] = useState(false);
  const hasSubmittedBidRef = useRef(false);
  const isResolvingBidsRef = useRef(false);
  const coinTossTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenBidResultRef = useRef<string | null>(null);
  const lastSeenRoundWinnerRef = useRef<string | null>(null);
  const byeCheckDoneRef = useRef(false);
  const { toast } = useToast();
  const { isMuted, toggleMute, play } = useGameSounds();
  const { isMusicMuted, toggleMusic } = useBackgroundMusic();

  // Get current player
  const currentPlayer = useMemo(() =>
    players.find(p => p.id === currentPlayerId),
    [players, currentPlayerId]
  );

  // Determine match info
  const matchInfo = useMemo(() => {
    if (!currentMatch) return null;

    const player1 = players.find(p => p.id === currentMatch.player1_id);
    const player2 = players.find(p => p.id === currentMatch.player2_id);

    if (!player1 || !player2) return null;

    const isPlayer1 = currentMatch.player1_id === currentPlayerId;
    const mySymbol: Player = isPlayer1 ? "X" : "O";
    const opponent = isPlayer1 ? player2 : player1;
    const myCoins = isPlayer1 ? currentMatch.player1_coins : currentMatch.player2_coins;
    const opponentCoins = isPlayer1 ? currentMatch.player2_coins : currentMatch.player1_coins;
    const myScore = isPlayer1 ? currentMatch.player1_score : currentMatch.player2_score;
    const opponentScore = isPlayer1 ? currentMatch.player2_score : currentMatch.player1_score;
    const myBid = isPlayer1 ? currentMatch.player1_bid : currentMatch.player2_bid;
    const opponentBid = isPlayer1 ? currentMatch.player2_bid : currentMatch.player1_bid;

    return {
      player1,
      player2,
      isPlayer1,
      mySymbol,
      opponent,
      myCoins,
      opponentCoins,
      myScore,
      opponentScore,
      myBid,
      opponentBid,
    };
  }, [currentMatch, players, currentPlayerId]);

  // Parse board from match
  const board = useMemo(() => {
    if (!currentMatch) return Array(9).fill(null) as Board;
    return boardStringToArray(currentMatch.board);
  }, [currentMatch]);

  const currentTurn = currentMatch?.current_turn as Player || "X";
  const isMyTurn = matchInfo?.mySymbol === currentTurn;
  const gameStarted = currentMatch?.status === 'playing';
  const winner = currentMatch?.winner as Player | "tie" | null;
  const winningLine = currentMatch?.winning_line ? JSON.parse(currentMatch.winning_line) : null;
  const isBiddingPhase = currentMatch?.is_bidding_phase ?? true;
  const bidWinner = currentMatch?.bid_winner as Player | null;

  // Fetch tournament data
  const fetchData = useCallback(async () => {
    const { data: tournamentData } = await supabase
      .from('tournaments')
      .select('name')
      .eq('id', tournamentId)
      .single();

    if (tournamentData) {
      setTournamentName(tournamentData.name);
    }

    const { data: playersData } = await supabase
      .from('tournament_players')
      .select('*')
      .eq('tournament_id', tournamentId);

    if (playersData) {
      setPlayers(playersData);
      setAllPlayers(playersData);
      setTotalPlayerCount(playersData.length);
      const me = playersData.find(p => p.id === currentPlayerId);
      if (me) {
        setIsReady(me.is_ready);
      }
    }

    // Find match where current player is participating
    const { data: matchData } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .or(`player1_id.eq.${currentPlayerId},player2_id.eq.${currentPlayerId}`)
      .in('status', ['pending', 'playing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (matchData) {
      setCurrentMatch(matchData as unknown as TournamentMatch);
    }

    setIsLoading(false);
  }, [tournamentId, currentPlayerId]);

  // Initial fetch and subscriptions
  useEffect(() => {
    let isMounted = true;

    fetchData();

    const channelSuffix = `${tournamentId}_${currentPlayerId}_${Date.now()}`;

    const playersChannel = supabase
      .channel(`game_players_${channelSuffix}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_players',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          if (!isMounted) return;
          fetchData();
        }
      )
      .subscribe();

    const matchChannel = supabase
      .channel(`game_matches_${channelSuffix}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          if (!isMounted) return;
          const newMatch = payload.new as TournamentMatch;
          if (newMatch && (newMatch.player1_id === currentPlayerId || newMatch.player2_id === currentPlayerId)) {
            setCurrentMatch(newMatch);
          }
        }
      )
      .subscribe();

    const pollInterval = setInterval(() => {
      if (isMounted) fetchData();
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(matchChannel);
      // Cleanup coin toss timeout
      if (coinTossTimeoutRef.current) {
        clearTimeout(coinTossTimeoutRef.current);
      }
    };
  }, [tournamentId, currentPlayerId, fetchData]);

  // Check if both players are ready and start the game
  useEffect(() => {
    const checkAndStartGame = async () => {
      if (!currentMatch || !matchInfo || currentMatch.status !== 'pending') return;

      const player1Ready = matchInfo.player1.is_ready;
      const player2Ready = matchInfo.player2.is_ready;

      if (player1Ready && player2Ready) {
        if (matchInfo.isPlayer1) {
          const deadline = new Date(Date.now() + PHASE_TIME * 1000).toISOString();
          await supabase
            .from('tournament_matches')
            .update({
              status: 'playing',
              phase_deadline: deadline,
            })
            .eq('id', currentMatch.id);
        }

        toast({
          title: "Match Started! 🎮",
          description: `Best of 3 - You are playing as ${matchInfo.mySymbol}`,
        });
      }
    };

    checkAndStartGame();
  }, [currentMatch, matchInfo, toast]);

  // Ref for match-end detection (effect placed after handleMatchComplete definition)
  const hasHandledMatchEndRef = useRef(false);

  // Timer effect
  useEffect(() => {
    if (!gameStarted || !currentMatch || currentMatch.match_winner || notification || isProcessing) {
      return;
    }

    const timer = setInterval(() => {
      if (currentMatch.phase_deadline) {
        const remaining = Math.max(0, Math.floor((new Date(currentMatch.phase_deadline).getTime() - Date.now()) / 1000));
        setTimeLeft(remaining);

        if (remaining <= 0) {
          // Auto-action on timeout
          if (isBiddingPhase && matchInfo && !hasSubmittedBidRef.current) {
            handleBidSubmit(1); // Auto-bid minimum
          } else if (!isBiddingPhase && isMyTurn && bidWinner === matchInfo?.mySymbol) {
            autoPlayMove();
          }
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, currentMatch, notification, isProcessing, isBiddingPhase, isMyTurn, bidWinner, matchInfo]);

  // Reset bid submission flag when bidding phase changes
  useEffect(() => {
    if (isBiddingPhase) {
      hasSubmittedBidRef.current = false;
      isResolvingBidsRef.current = false;
      lastSeenRoundWinnerRef.current = null;
      setPlayerBid(10);
    }
  }, [isBiddingPhase, currentMatch?.current_round]);

  // Auto-resolve bids when both are present OR when bid result already exists from P1
  useEffect(() => {
    if (!currentMatch || !matchInfo) return;
    
    // P2: If we're showing coin toss animation and P1's authoritative result arrives via DB,
    // use that result directly — never generate our own
    if (notification?.type === "coin_toss_animation" && currentMatch.last_bid_result && !currentMatch.is_bidding_phase) {
      const resultKey = `${currentMatch.id}-${currentMatch.current_round}-${JSON.stringify(currentMatch.last_bid_result)}`;
      if (resultKey !== lastSeenBidResultRef.current) {
        lastSeenBidResultRef.current = resultKey;
        
        // Clear any pending fallback timeout — we got the authoritative result
        if (coinTossTimeoutRef.current) {
          clearTimeout(coinTossTimeoutRef.current);
          coinTossTimeoutRef.current = null;
        }
        
        // Use the authoritative winner from DB (bid_winner / current_turn),
        // NOT last_bid_result.winner which could have serialization issues
        const authoritativeWinner = currentMatch.bid_winner as Player;
        const bidResult = currentMatch.last_bid_result;
        const didWin = authoritativeWinner === matchInfo.mySymbol;
        const myBidAmount = matchInfo.isPlayer1 ? bidResult.player1Bid : bidResult.player2Bid;
        
        setNotification({
          type: "tie_coin_toss",
          message: "🪙 Coin Toss Result!",
          subMessage: `Both bid $${myBidAmount}. ${didWin ? "You" : matchInfo.opponent.player_name} won the toss!`,
        });
        
        setTimeout(() => {
          setNotification(null);
          setIsProcessing(false);
          play("turnChange");
        }, COIN_TOSS_ANIMATION_TIME);
      }
      return;
    }
    
    // P2: If bidding phase ended (P1 resolved) and we missed the coin toss animation,
    // still process the result to stay in sync
    if (!matchInfo.isPlayer1 && !currentMatch.is_bidding_phase && currentMatch.last_bid_result && currentMatch.bid_winner) {
      const resultKey = `${currentMatch.id}-${currentMatch.current_round}-${JSON.stringify(currentMatch.last_bid_result)}`;
      if (resultKey !== lastSeenBidResultRef.current && !isProcessing && !notification) {
        lastSeenBidResultRef.current = resultKey;
        
        if (coinTossTimeoutRef.current) {
          clearTimeout(coinTossTimeoutRef.current);
          coinTossTimeoutRef.current = null;
        }
        
        const authoritativeWinner = currentMatch.bid_winner as Player;
        const bidResult = currentMatch.last_bid_result;
        const didWin = authoritativeWinner === matchInfo.mySymbol;
        const myBidAmount = matchInfo.isPlayer1 ? bidResult.player1Bid : bidResult.player2Bid;
        const oppBidAmount = matchInfo.isPlayer1 ? bidResult.player2Bid : bidResult.player1Bid;
        const isTie = bidResult.player1Bid === bidResult.player2Bid;
        
        setNotification({
          type: isTie ? "tie_coin_toss" : (didWin ? "bid_win" : "bid_lose"),
          message: isTie 
            ? "🪙 Coin Toss Result!" 
            : (didWin ? "🎯 You Won the Bid!" : `💻 ${matchInfo.opponent.player_name} Won!`),
          subMessage: isTie 
            ? `Both bid $${myBidAmount}. ${didWin ? "You" : matchInfo.opponent.player_name} won the toss!`
            : `You bid $${myBidAmount} vs $${oppBidAmount}`,
        });
        
        setTimeout(() => {
          setNotification(null);
          play("turnChange");
        }, BID_RESULT_DELAY);
      }
      return;
    }
    
    if (!isBiddingPhase || isResolvingBidsRef.current || isProcessing) return;
    
    const p1Bid = currentMatch.player1_bid;
    const p2Bid = currentMatch.player2_bid;
    
    // Both bids are in - only P1 resolves to avoid race conditions
    if (p1Bid !== null && p2Bid !== null) {
      isResolvingBidsRef.current = true;
      setNotification(null);
      resolveBids(p1Bid, p2Bid);
    }
  }, [currentMatch?.player1_bid, currentMatch?.player2_bid, currentMatch?.last_bid_result, currentMatch?.is_bidding_phase, currentMatch?.bid_winner, isBiddingPhase, matchInfo, isProcessing, notification?.type]);

  // Clear BYE state when a match is found
  useEffect(() => {
    if (currentMatch && hasByeAdvancement) {
      setHasByeAdvancement(false);
      setNotification(null);
      byeCheckDoneRef.current = false;
    }
  }, [currentMatch, hasByeAdvancement]);

  // BYE Detection - Check if player has a BYE for current round
  useEffect(() => {
    const checkForBye = async () => {
      if (!tournamentId || !currentPlayerId || byeCheckDoneRef.current || currentMatch || isLoading) {
        return;
      }
      
      // Get remaining non-eliminated players
      const { data: remainingPlayers } = await supabase
        .from('tournament_players')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('is_eliminated', false);

      // If only 2 players remain, there are NO BYEs - it's the final
      if (!remainingPlayers || remainingPlayers.length <= 2) {
        return;
      }
      
      // Get all active matches for this tournament
      const { data: allActiveMatches } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .in('status', ['pending', 'playing']);
      
      if (!allActiveMatches || allActiveMatches.length === 0) {
        return;
      }
      
      // Check if player is in any active match
      const playerMatch = allActiveMatches.find(
        m => m.player1_id === currentPlayerId || m.player2_id === currentPlayerId
      );
      
      if (!playerMatch) {
        // Player has a BYE - show notification and wait for next round
        byeCheckDoneRef.current = true;
        setHasByeAdvancement(true);
        
        setNotification({
          type: "bye_advancement",
          message: "🎯 You Have a BYE!",
          subMessage: "Waiting for other matches to complete. You'll advance automatically.",
        });
        
        toast({
          title: "BYE Round",
          description: "You'll advance automatically when other matches finish.",
        });
      }
    };
    
    checkForBye();
  }, [tournamentId, currentPlayerId, currentMatch, isLoading, toast]);

  // Sync round results for non-moving player via realtime updates
  useEffect(() => {
    if (!currentMatch || !matchInfo || !gameStarted) return;
    
    // When a round winner appears in the match state and we haven't seen it yet
    if (currentMatch.winner) {
      const roundKey = `${currentMatch.id}-round${currentMatch.current_round}-${currentMatch.winner}`;
      if (roundKey === lastSeenRoundWinnerRef.current) return;
      lastSeenRoundWinnerRef.current = roundKey;
      
      const roundWinner = currentMatch.winner as Player | "tie";
      const didWinRound = roundWinner === matchInfo.mySymbol;
      const myScore = matchInfo.isPlayer1 ? currentMatch.player1_score : currentMatch.player2_score;
      const oppScore = matchInfo.isPlayer1 ? currentMatch.player2_score : currentMatch.player1_score;
      
      // Only show notification if we're not already showing one (avoid duplicate for the moving player)
      if (!notification || (notification.type !== "round_win" && notification.type !== "round_lose")) {
        const winningLine = currentMatch.winning_line ? JSON.parse(currentMatch.winning_line) : null;
        let winReason = "";
        if (winningLine) {
          winReason = "Won by completing three marks";
        } else if (roundWinner === "tie") {
          winReason = "Round ended in a tie";
        } else if (currentMatch.player1_coins < 1 || currentMatch.player2_coins < 1) {
          winReason = "Won by bankrupting opponent";
        } else {
          winReason = "Won by economic advantage";
        }
        
        setNotification({
          type: didWinRound ? "round_win" : "round_lose",
          message: roundWinner === "tie" 
            ? "🤝 Round Tied!" 
            : (didWinRound ? "🎉 You Won This Round!" : `${matchInfo.opponent.player_name} Won This Round`),
          subMessage: `${winReason} • Score: ${myScore} - ${oppScore}`,
        });
        
        play(didWinRound ? "win" : "lose");
      }
      
      // Handle match completion for non-moving player
      if (currentMatch.match_winner && currentMatch.status === 'completed') {
        const didWinMatch = (currentMatch.match_winner === "player1" && matchInfo.isPlayer1) || 
                           (currentMatch.match_winner === "player2" && !matchInfo.isPlayer1);
        if (didWinMatch) play("tournamentVictory");
      }
    }
  }, [currentMatch?.winner, currentMatch?.current_round, currentMatch?.player1_score, currentMatch?.player2_score, matchInfo, gameStarted]);

  const checkWinner = useCallback((currentBoard: Board, p1Coins: number, p2Coins: number): { winner: Player | "tie" | null; line: number[] | null } => {
    for (const combo of WINNING_COMBINATIONS) {
      const [a, b, c] = combo;
      if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
        return { winner: currentBoard[a], line: combo };
      }
    }
    if (currentBoard.every(cell => cell !== null)) {
      // Board full - economic win
      if (p1Coins > p2Coins) return { winner: "X", line: null };
      if (p2Coins > p1Coins) return { winner: "O", line: null };
      return { winner: "tie", line: null };
    }
    return { winner: null, line: null };
  }, []);

  const getEmptyCells = (currentBoard: Board): number[] => {
    return currentBoard.reduce<number[]>((acc, cell, idx) => {
      if (cell === null) acc.push(idx);
      return acc;
    }, []);
  };

  const autoPlayMove = useCallback(async () => {
    if (!currentMatch || !matchInfo) return;

    const emptyCells = getEmptyCells(board);
    if (emptyCells.length === 0) return;

    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    await makeMove(randomCell);
  }, [board, currentMatch, matchInfo]);

  const handleBidSubmit = useCallback(async (bidAmount: number, isAuto = false) => {
    if (!currentMatch || !matchInfo || hasSubmittedBidRef.current) return;

    hasSubmittedBidRef.current = true;
    if (!isAuto) afkActions?.recordManualAction();
    play("bidPlace");

    const actualBid = Math.max(1, Math.min(bidAmount, matchInfo.myCoins));

    try {
      const updateData: Record<string, unknown> = matchInfo.isPlayer1
        ? { player1_bid: actualBid }
        : { player2_bid: actualBid };

      await supabase
        .from('tournament_matches')
        .update(updateData)
        .eq('id', currentMatch.id);
    } catch (error) {
      console.error("Error submitting bid:", error);
      hasSubmittedBidRef.current = false;
    }
  }, [currentMatch, matchInfo]);

  // Watchdog hook for timeout failsafes - placed after handlers are defined
  const handleForceBid = useCallback(() => {
    if (!hasSubmittedBidRef.current && matchInfo) {
      afkActions.recordAutoAction();
      handleBidSubmit(1, true);
    }
  }, [matchInfo, handleBidSubmit]);
  
  const handleForceMove = useCallback(() => {
    afkActions.recordAutoAction();
    autoPlayMove();
  }, [autoPlayMove]);
  
  const handleForceRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Forfeit handler for AFK system
  const handleAfkForfeit = useCallback(async () => {
    if (!currentMatch || !matchInfo || currentMatch.status !== 'playing') return;
    
    const winnerStr = matchInfo.isPlayer1 ? "player2" : "player1";
    
    await supabase
      .from('tournament_matches')
      .update({
        match_winner: winnerStr,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', currentMatch.id);
    
    await supabase
      .from('tournament_players')
      .update({ is_eliminated: true })
      .eq('id', currentPlayerId);
      
    console.warn('[AFK] Player forfeited due to inactivity');
  }, [currentMatch, matchInfo, currentPlayerId]);

  // AFK detection hook
  const afkActions = useAfkDetection(
    {
      enabled: gameStarted && !showTournamentWinner && !winner,
      matchId: currentMatch?.id || null,
      isMyTurn,
      isBiddingPhase,
      gameStarted,
      winner,
      matchWinner: currentMatch?.match_winner || null,
    },
    handleAfkForfeit,
  );

  useTournamentWatchdog(
    {
      matchId: currentMatch?.id || null,
      isPlayer1: matchInfo?.isPlayer1 || false,
      isBiddingPhase,
      hasSubmittedBid: hasSubmittedBidRef.current,
      bidWinner: bidWinner || null,
      mySymbol: matchInfo?.mySymbol || "X",
      isProcessing,
      winner,
      enabled: gameStarted && !showTournamentWinner,
    },
    handleForceBid,
    handleForceMove,
    handleForceRefresh
  );

  // beforeunload + visibilitychange: forfeit if player closes/navigates away mid-match
  useEffect(() => {
    if (!currentMatch || currentMatch.status !== 'playing' || !matchInfo || showTournamentWinner) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Show browser confirmation dialog
      e.preventDefault();
      e.returnValue = '';
      
      // Attempt to forfeit using sendBeacon for reliability
      const winnerStr = matchInfo.isPlayer1 ? "player2" : "player1";
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/tournament_matches?id=eq.${currentMatch.id}`;
      const body = JSON.stringify({
        match_winner: winnerStr,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
      
      navigator.sendBeacon?.(url); // Best-effort; realtime + polling will catch it
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentMatch?.id, currentMatch?.status, matchInfo?.isPlayer1, showTournamentWinner]);

  const resolveBids = useCallback(async (p1Bid: number, p2Bid: number) => {
    if (!currentMatch || !matchInfo) return;

    setIsProcessing(true);

    const isTie = p1Bid === p2Bid;

    // Only Player 1 resolves and writes to DB — this is the authoritative path
    if (matchInfo.isPlayer1) {
      let bidWinnerSymbol: Player;

      if (p1Bid > p2Bid) {
        bidWinnerSymbol = "X";
      } else if (p2Bid > p1Bid) {
        bidWinnerSymbol = "O";
      } else {
        // Tie — P1 does the coin toss authoritatively
        bidWinnerSymbol = generateFairCoinToss() ? "X" : "O";

        // Show coin toss animation for P1
        setNotification({
          type: "coin_toss_animation",
          message: "🪙 Tie! Coin Toss...",
          subMessage: "Flipping the coin...",
        });

        await new Promise(resolve => setTimeout(resolve, COIN_TOSS_ANIMATION_TIME));
      }

      const newP1Coins = currentMatch.player1_coins - p1Bid;
      const newP2Coins = currentMatch.player2_coins - p2Bid;
      const deadline = new Date(Date.now() + PHASE_TIME * 1000).toISOString();

      // Write authoritative result to DB
      await supabase
        .from('tournament_matches')
        .update({
          player1_coins: newP1Coins,
          player2_coins: newP2Coins,
          bid_winner: bidWinnerSymbol,
          current_turn: bidWinnerSymbol,
          is_bidding_phase: false,
          player1_bid: null,
          player2_bid: null,
          phase_deadline: deadline,
          last_bid_result: {
            player1Bid: p1Bid,
            player2Bid: p2Bid,
            winner: bidWinnerSymbol,
          },
        })
        .eq('id', currentMatch.id);

      // Show result notification for P1
      const didWin = bidWinnerSymbol === "X"; // P1 is always X
      const myBidAmount = p1Bid;
      const oppBidAmount = p2Bid;

      if (isTie) {
        setNotification({
          type: "tie_coin_toss",
          message: "🪙 Coin Toss Result!",
          subMessage: `Both bid $${myBidAmount}. ${didWin ? "You" : matchInfo.opponent.player_name} won the toss!`,
        });
      } else {
        setNotification({
          type: didWin ? "bid_win" : "bid_lose",
          message: didWin ? "🎯 You Won the Bid!" : `💻 ${matchInfo.opponent.player_name} Won!`,
          subMessage: `You bid $${myBidAmount} vs $${oppBidAmount}`,
        });
      }

      setTimeout(() => {
        setNotification(null);
        setIsProcessing(false);
        play("turnChange");
      }, BID_RESULT_DELAY);

    } else {
      // Player 2: Do NOT resolve independently.
      // Show animation for tie, then wait for P1's authoritative result via realtime/polling.
      if (isTie) {
        setNotification({
          type: "coin_toss_animation",
          message: "🪙 Tie! Coin Toss...",
          subMessage: "Flipping the coin...",
        });

        // Fallback: if P1's result doesn't arrive within timeout, re-fetch from DB
        coinTossTimeoutRef.current = setTimeout(async () => {
          // Re-fetch match state from DB to get P1's authoritative result
          const { data: freshMatch } = await supabase
            .from('tournament_matches')
            .select('*')
            .eq('id', currentMatch.id)
            .single();

          if (freshMatch && freshMatch.bid_winner && !freshMatch.is_bidding_phase) {
            // P1's result is in DB — use it
            setCurrentMatch(freshMatch as unknown as TournamentMatch);
          } else {
            // P1 hasn't written yet — keep waiting, polling will pick it up
            console.log('[CoinToss] P1 result not yet in DB, polling will handle it');
          }
        }, COIN_TOSS_TIMEOUT);
      } else {
        // Non-tie: P2 just waits for P1's DB write via realtime/polling
        // The useEffect above will show the notification when the result arrives
      }

      // Don't clear isProcessing — the useEffect handler will do that when P1's result arrives
      setIsProcessing(false);
    }
  }, [currentMatch, matchInfo]);

  const makeMove = useCallback(async (index: number) => {
    if (!gameStarted || !isMyTurn || board[index] !== null || winner || !currentMatch || !matchInfo || isBiddingPhase || bidWinner !== matchInfo.mySymbol) {
      return;
    }

    setIsProcessing(true);
    afkActions.recordManualAction();
    play("markPlace");

    const newBoard = [...board];
    newBoard[index] = matchInfo.mySymbol;
    const newBoardStr = boardArrayToString(newBoard);
    const nextTurn = currentTurn === "X" ? "O" : "X";

    const result = checkWinner(newBoard, currentMatch.player1_coins, currentMatch.player2_coins);

    // Check for bankruptcy before next bidding phase
    const p1Bankrupt = currentMatch.player1_coins < 1;
    const p2Bankrupt = currentMatch.player2_coins < 1;

    let roundWinner: Player | null = null;
    if (result.winner) {
      roundWinner = result.winner === "tie" ? null : result.winner;
    } else if (p1Bankrupt) {
      roundWinner = "O";
    } else if (p2Bankrupt) {
      roundWinner = "X";
    }

    if (roundWinner || result.winner === "tie") {
      // Round ended
      const p1Wins = roundWinner === "X";
      const newP1Score = currentMatch.player1_score + (p1Wins ? 1 : 0);
      const newP2Score = currentMatch.player2_score + (!p1Wins && roundWinner ? 1 : 0);

      const updateData: Record<string, unknown> = {
        board: newBoardStr,
        current_turn: nextTurn,
        winner: result.winner || roundWinner,
        winning_line: result.line ? JSON.stringify(result.line) : null,
        player1_score: newP1Score,
        player2_score: newP2Score,
      };

      // Check if match is over (Best of 3)
      if (newP1Score >= 2 || newP2Score >= 2) {
        updateData.match_winner = newP1Score >= 2 ? "player1" : "player2";
        updateData.status = "completed";
        updateData.completed_at = new Date().toISOString();
      }

      await supabase
        .from('tournament_matches')
        .update(updateData)
        .eq('id', currentMatch.id);

      const didWinRound = roundWinner === matchInfo.mySymbol;

      // Determine win reason
      let winReason = "";
      if (result.line) {
        winReason = "Won by completing three marks";
      } else if (p1Bankrupt || p2Bankrupt) {
        winReason = "Won by bankrupting opponent";
      } else if (result.winner === "tie") {
        winReason = "Round ended in a tie";
      } else {
        winReason = "Won by economic advantage";
      }

      setNotification({
        type: didWinRound ? "round_win" : "round_lose",
        message: didWinRound ? "🎉 You Won This Round!" : `${matchInfo.opponent.player_name} Won This Round`,
        subMessage: `${winReason} • Score: ${matchInfo.isPlayer1 ? newP1Score : newP2Score} - ${matchInfo.isPlayer1 ? newP2Score : newP1Score}`,
      });

      play(didWinRound ? "win" : "lose");

      // Check if match is over - immediate transition, no artificial delay
      if (newP1Score >= 2 || newP2Score >= 2) {
        const matchWinnerStr = newP1Score >= 2 ? "player1" : "player2";
        const didWinMatch = (matchWinnerStr === "player1" && matchInfo.isPlayer1) || (matchWinnerStr === "player2" && !matchInfo.isPlayer1);

        if (didWinMatch) play("tournamentVictory");

        // Immediately proceed to match completion and leaderboard
        hasHandledMatchEndRef.current = true;
        setNotification(null);
        setIsProcessing(false);
        await handleMatchComplete(matchWinnerStr);
      } else {
        // Start next round after brief round-result display
        setTimeout(async () => {
          setNotification(null);
          play("roundStart");
          const deadline = new Date(Date.now() + PHASE_TIME * 1000).toISOString();
          await supabase
            .from('tournament_matches')
            .update({
              board: "---------",
              current_turn: "X",
              winner: null,
              winning_line: null,
              is_bidding_phase: true,
              bid_winner: null,
              player1_coins: INITIAL_COINS,
              player2_coins: INITIAL_COINS,
              current_round: currentMatch.current_round + 1,
              phase_deadline: deadline,
              player1_bid: null,
              player2_bid: null,
              last_bid_result: null,
            })
            .eq('id', currentMatch.id);
          setIsProcessing(false);
        }, ROUND_RESULT_DELAY);
      }
    } else {
      // Continue playing - start new bidding phase
      const deadline = new Date(Date.now() + PHASE_TIME * 1000).toISOString();

      await supabase
        .from('tournament_matches')
        .update({
          board: newBoardStr,
          current_turn: nextTurn,
          is_bidding_phase: true,
          bid_winner: null,
          phase_deadline: deadline,
          player1_bid: null,
          player2_bid: null,
        })
        .eq('id', currentMatch.id);

      setIsProcessing(false);
    }
  }, [gameStarted, isMyTurn, board, winner, currentMatch, matchInfo, isBiddingPhase, bidWinner, currentTurn, checkWinner]);

  const handleMatchComplete = useCallback(async (matchWinnerStr: "player1" | "player2") => {
    if (!currentMatch || !matchInfo) return;

    const winnerId = matchWinnerStr === "player1" ? currentMatch.player1_id : currentMatch.player2_id;
    const loserId = matchWinnerStr === "player1" ? currentMatch.player2_id : currentMatch.player1_id;
    const didWin = winnerId === currentPlayerId;
    const currentRoundNumber = currentMatch.round_number || 1;

    // Mark loser as eliminated
    await supabase
      .from('tournament_players')
      .update({ is_eliminated: true })
      .eq('id', loserId);

    // Refetch all players to get latest elimination state
    const { data: latestPlayers } = await supabase
      .from('tournament_players')
      .select('*')
      .eq('tournament_id', tournamentId);

    const updatedAllPlayers = latestPlayers || allPlayers;
    const remainingPlayersList = getRemainingPlayers(updatedAllPlayers);
    const eliminatedCount = updatedAllPlayers.filter(p => p.is_eliminated).length;

    // Tournament is complete when only 1 (or 0) non-eliminated players remain
    const tournamentComplete = remainingPlayersList.length <= 1;

    if (tournamentComplete) {
      // Tournament complete! Update status
      await supabase
        .from('tournaments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', tournamentId);

      // Build full rankings: winner first, then eliminated in reverse order of elimination
      const winnerPlayer = updatedAllPlayers.find(p => p.id === winnerId);
      const loserPlayer = updatedAllPlayers.find(p => p.id === loserId);
      const otherEliminated = updatedAllPlayers.filter(
        p => p.is_eliminated && p.id !== loserId
      );

      const rankings = [
        {
          id: winnerId,
          name: winnerPlayer?.player_name || "Winner",
          position: 1,
          isCurrentPlayer: winnerId === currentPlayerId,
        },
        {
          id: loserId,
          name: loserPlayer?.player_name || "Runner-up",
          position: 2,
          isCurrentPlayer: loserId === currentPlayerId,
        },
      ];

      otherEliminated.forEach((p, idx) => {
        rankings.push({
          id: p.id,
          name: p.player_name,
          position: 3 + idx,
          isCurrentPlayer: p.id === currentPlayerId,
        });
      });

      setTournamentRankings(rankings);
      setShowTournamentWinner(true);
    } else {
      // More rounds to go
      // Player1 of this match is responsible for creating next round (idempotent)
      if (matchInfo.isPlayer1) {
        const created = await createNextRoundMatches(tournamentId, currentRoundNumber);
        if (created) {
          console.log(`[Progression] Created round ${currentRoundNumber + 1} matches`);
        }
      }

      if (!didWin) {
        // Eliminated player: immediately show leaderboard
        const finishPosition = remainingPlayersList.length + 1;
        setNotification(null);

        const rankings: { id: string; name: string; position: number; isCurrentPlayer: boolean }[] = [];
        remainingPlayersList.forEach((p, idx) => {
          rankings.push({
            id: p.id,
            name: p.player_name,
            position: idx + 1,
            isCurrentPlayer: p.id === currentPlayerId,
          });
        });
        rankings.push({
          id: loserId,
          name: updatedAllPlayers.find(p => p.id === loserId)?.player_name || "You",
          position: finishPosition,
          isCurrentPlayer: loserId === currentPlayerId,
        });

        setTournamentRankings(rankings);
        setShowTournamentWinner(true);
      } else {
        // Winner: immediately advance to next match
        setNotification(null);

        await supabase
          .from('tournament_players')
          .update({ is_ready: false })
          .eq('id', currentPlayerId);

        setIsReady(false);
        setCurrentMatch(null);
        byeCheckDoneRef.current = false;
        setHasByeAdvancement(false);
        fetchData();
      }
    }
  }, [currentMatch, matchInfo, currentPlayerId, allPlayers, totalPlayerCount, tournamentId, fetchData]);

  // Detect match completion from remote updates (forfeit, or opponent made winning move)
  // This ensures ALL players transition to leaderboard when match ends
  useEffect(() => {
    if (!currentMatch || !matchInfo || hasHandledMatchEndRef.current || showTournamentWinner) return;
    
    if (currentMatch.match_winner && currentMatch.status === 'completed') {
      hasHandledMatchEndRef.current = true;
      
      const winnerId = currentMatch.match_winner === "player1" ? currentMatch.player1_id : currentMatch.player2_id;
      const didWin = winnerId === currentPlayerId;
      
      // Check if this was a forfeit (no round winner set — opponent left mid-game)
      const isForfeit = !currentMatch.winner;
      
      if (isForfeit && didWin) {
        setNotification({
          type: "opponent_forfeit",
          message: "🏃 Opponent Forfeited!",
          subMessage: `${matchInfo.opponent.player_name} has left the game. You win!`,
        });
      }
      
      // Immediately transition to leaderboard for ALL players
      setNotification(null);
      setIsProcessing(false);
      handleMatchComplete(currentMatch.match_winner as "player1" | "player2");
    }
  }, [currentMatch?.match_winner, currentMatch?.status, matchInfo, currentPlayerId, showTournamentWinner, handleMatchComplete]);

  const handleReady = async () => {
    if (isReady) return;

    setIsReady(true);

    const { error } = await supabase
      .from('tournament_players')
      .update({ is_ready: true })
      .eq('id', currentPlayerId);

    if (error) {
      console.error('Error updating ready state:', error);
      setIsReady(false);
      toast({
        title: "Error",
        description: "Failed to update ready state",
        variant: "destructive",
      });
    }
  };

  const handleBackClick = () => {
    setShowConfirmLeave(true);
  };

  const handleConfirmLeave = async () => {
    setShowConfirmLeave(false);
    
    // If in an active match, forfeit the match
    if (currentMatch && currentMatch.status === 'playing' && matchInfo) {
      const winnerStr = matchInfo.isPlayer1 ? "player2" : "player1";
      
      await supabase
        .from('tournament_matches')
        .update({
          match_winner: winnerStr,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', currentMatch.id);
      
      // Mark self as eliminated
      await supabase
        .from('tournament_players')
        .update({ is_eliminated: true })
        .eq('id', currentPlayerId);
    }
    
    onBack();
  };

  const quickBids = [5, 10, 25, 50];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background relative flex items-center justify-center">
        <FloatingBackground />
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading match...</p>
        </div>
      </div>
    );
  }

  // Tournament winner screen
  if (showTournamentWinner) {
    return (
      <>
        <FloatingBackground />
        <TournamentWinner
          isOpen={showTournamentWinner}
          tournamentName={tournamentName}
          rankings={tournamentRankings}
          currentPlayerId={currentPlayerId}
          onHome={onBack}
        />
      </>
    );
  }

  // No match found yet
  if (!currentMatch) {
    return (
      <div className="min-h-screen bg-background relative">
        <FloatingBackground />
        <div className="container max-w-lg mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleBackClick}
              className="p-2 rounded-xl bg-card hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{tournamentName}</h1>
              <p className="text-sm text-muted-foreground">Tournament Match</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="game-card text-center"
          >
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-lg font-bold mb-2">Preparing Your Match</h2>
            <p className="text-muted-foreground">Please wait while we set up your match...</p>
          </motion.div>
        </div>

        <ConfirmLeaveDialog
          open={showConfirmLeave}
          onOpenChange={setShowConfirmLeave}
          onConfirm={handleConfirmLeave}
          title="Leave Match?"
          description="Are you sure you want to leave? This will count as a forfeit."
        />
      </div>
    );
  }

  // Pre-game ready screen
  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-background relative">
        <FloatingBackground />
        <div className="container max-w-lg mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleBackClick}
              className="p-2 rounded-xl bg-card hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{tournamentName}</h1>
              <p className="text-sm text-muted-foreground">Tournament Match • Best of 3</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="game-card mb-6"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold">Match Setup</h2>
            </div>

            {matchInfo ? (
              <div className="space-y-4">
                {/* Player 1 */}
                <div className={`flex items-center justify-between p-4 rounded-xl ${matchInfo.isPlayer1 ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted'
                  }`}>
                  <div className="flex items-center gap-3">
                    <RobohashAvatar seed={matchInfo.player1.id} size={40} />
                    <div>
                      <p className="font-medium">{matchInfo.player1.player_name}</p>
                      {matchInfo.isPlayer1 && (
                        <p className="text-xs text-primary">(You)</p>
                      )}
                    </div>
                  </div>
                  {matchInfo.player1.is_ready ? (
                    <span className="flex items-center gap-1 text-green-500 text-sm">
                      <Check className="w-4 h-4" /> Ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Waiting...
                    </span>
                  )}
                </div>

                <div className="text-center text-muted-foreground text-sm">VS</div>

                {/* Player 2 */}
                <div className={`flex items-center justify-between p-4 rounded-xl ${!matchInfo.isPlayer1 ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted'
                  }`}>
                  <div className="flex items-center gap-3">
                    <RobohashAvatar seed={matchInfo.player2.id} size={40} />
                    <div>
                      <p className="font-medium">{matchInfo.player2.player_name}</p>
                      {!matchInfo.isPlayer1 && (
                        <p className="text-xs text-primary">(You)</p>
                      )}
                    </div>
                  </div>
                  {matchInfo.player2.is_ready ? (
                    <span className="flex items-center gap-1 text-green-500 text-sm">
                      <Check className="w-4 h-4" /> Ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Waiting...
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                Loading match details...
              </div>
            )}
          </motion.div>

          {/* Ready Button */}
          {currentMatch?.status === 'pending' && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={handleReady}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${isReady
                ? 'bg-green-500 text-white'
                : 'btn-game-primary'
                }`}
            >
              {isReady ? (
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" /> Ready!
                </span>
              ) : (
                "Click when Ready"
              )}
            </motion.button>
          )}

          {isReady && matchInfo?.opponent && !matchInfo.opponent.is_ready && (
            <p className="text-center text-muted-foreground mt-4 text-sm">
              Waiting for {matchInfo.opponent.player_name} to be ready...
            </p>
          )}
        </div>

        <ConfirmLeaveDialog
          open={showConfirmLeave}
          onOpenChange={setShowConfirmLeave}
          onConfirm={handleConfirmLeave}
          title="Leave Match?"
          description="Are you sure you want to leave? This will count as a forfeit."
        />
      </div>
    );
  }

  // Game board with bidding
  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      <div className="max-w-md mx-auto w-full flex flex-col h-full px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-0">
        {/* Top Bar: Players + Score */}
        <div className="flex items-center gap-3 mb-2">
          {/* Player X */}
          <div className={`flex-1 rounded-xl p-2.5 bg-card transition-all ${bidWinner === "X" ? "ring-2 ring-primary" : ""}`} style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center gap-2 mb-1">
              <RobohashAvatar seed={matchInfo?.player1.id || "p1"} size={28} />
              <span className="font-medium text-xs truncate">{matchInfo?.player1.player_name}</span>
              {matchInfo?.isPlayer1 && <span className="text-[10px] text-primary">(You)</span>}
            </div>
            <div className="coin-badge text-xs">
              <Coins className="w-3 h-3" />
              ${currentMatch.player1_coins}
            </div>
          </div>

          {/* Center: Round + Score */}
          <div className="text-center shrink-0">
            <div className="text-xs text-muted-foreground font-medium">Round {currentMatch.current_round}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-game-x font-bold text-lg">{matchInfo?.isPlayer1 ? currentMatch.player1_score : currentMatch.player2_score}</span>
              <span className="text-muted-foreground text-sm">-</span>
              <span className="text-game-o font-bold text-lg">{matchInfo?.isPlayer1 ? currentMatch.player2_score : currentMatch.player1_score}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Best of 3</div>
          </div>

          {/* Player O */}
          <div className={`flex-1 rounded-xl p-2.5 bg-card transition-all ${bidWinner === "O" ? "ring-2 ring-secondary" : ""}`} style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center gap-2 mb-1">
              <RobohashAvatar seed={matchInfo?.player2.id || "p2"} size={28} />
              <span className="font-medium text-xs truncate">{matchInfo?.player2.player_name}</span>
              {!matchInfo?.isPlayer1 && <span className="text-[10px] text-primary">(You)</span>}
            </div>
            <div className="coin-badge text-xs">
              <Coins className="w-3 h-3" />
              ${currentMatch.player2_coins}
            </div>
          </div>
        </div>

        {/* Middle: Board + Overlays (flex-1 fills remaining space) */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0">
          {/* Notification Overlay */}
          <AnimatePresence>
            {notification && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full rounded-2xl bg-card p-4 text-center mb-3"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <h3 className="text-base font-bold mb-0.5">{notification.message}</h3>
                {notification.subMessage && (
                  <p className="text-xs text-muted-foreground">{notification.subMessage}</p>
                )}
                {notification.type === "opponent_turn" && (
                  <div className="flex items-center justify-center gap-1 mt-1.5">
                    <motion.div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                    <motion.div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} />
                    <motion.div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Waiting for Opponent Bid */}
          <AnimatePresence>
            {isBiddingPhase && !winner && !notification && !isProcessing && matchInfo && hasSubmittedBidRef.current && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full rounded-2xl bg-card p-4 text-center mb-3"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <h3 className="text-base font-bold mb-0.5">⏳ Bid Placed!</h3>
                <p className="text-xs text-muted-foreground">
                  Waiting for {matchInfo.opponent.player_name} to bid...
                </p>
                <Loader2 className="w-4 h-4 mx-auto mt-1.5 animate-spin text-muted-foreground" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bidding Phase UI */}
          <AnimatePresence mode="wait">
            {isBiddingPhase && !winner && !notification && !isProcessing && matchInfo && !hasSubmittedBidRef.current && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full rounded-2xl bg-card p-4 mb-3"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center">
                      <Coins className="w-4 h-4 text-foreground" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs">Place Your Bid</h3>
                      <p className="text-[10px] text-muted-foreground">Higher bid wins the turn</p>
                    </div>
                  </div>
                  <div className={`timer-ring w-10 h-10 text-sm ${timeLeft <= 5 ? "text-game-warning" : "text-foreground"}`}>
                    <Clock className="w-2.5 h-2.5 absolute top-0 right-0 opacity-50" />
                    {timeLeft}s
                  </div>
                </div>
                <div className="flex gap-1.5 justify-center mb-2">
                  {quickBids.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setPlayerBid(Math.min(amount, matchInfo.myCoins))}
                      disabled={amount > matchInfo.myCoins}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${playerBid === amount ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"} ${amount > matchInfo.myCoins ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">$1</span>
                    <span className="font-bold text-base">${playerBid}</span>
                    <span className="text-muted-foreground">${matchInfo.myCoins}</span>
                  </div>
                  <Slider value={[playerBid]} onValueChange={(v) => setPlayerBid(v[0])} min={1} max={matchInfo.myCoins} step={1} className="w-full" />
                </div>
                <button onClick={() => handleBidSubmit(playerBid)} className="btn-game-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm">
                  Confirm Bid <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Last Bid Result */}
          <AnimatePresence>
            {currentMatch.last_bid_result && !isBiddingPhase && !notification && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full rounded-xl bg-card p-2.5 text-center text-xs mb-2" style={{ boxShadow: 'var(--shadow-card)' }}>
                <span className="text-muted-foreground">
                  You bid <span className="text-game-x font-bold">${matchInfo?.isPlayer1 ? currentMatch.last_bid_result.player1Bid : currentMatch.last_bid_result.player2Bid}</span> vs
                  <span className="text-game-o font-bold"> ${matchInfo?.isPlayer1 ? currentMatch.last_bid_result.player2Bid : currentMatch.last_bid_result.player1Bid}</span>
                </span>
                <span className="block font-medium mt-0.5">
                  {currentMatch.last_bid_result.winner === matchInfo?.mySymbol ? "🎯 You won the bid!" : `💻 ${matchInfo?.opponent.player_name} won the bid`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Your Turn Indicator */}
          {!isBiddingPhase && !winner && !notification && !isProcessing && bidWinner === matchInfo?.mySymbol && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full rounded-xl bg-primary/10 ring-2 ring-primary p-3 text-center mb-2"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className={`timer-ring w-9 h-9 text-sm ${timeLeft <= 5 ? "text-game-warning" : "text-foreground"}`}>
                  <Clock className="w-2.5 h-2.5 absolute top-0 right-0 opacity-50" />
                  {timeLeft}s
                </div>
              </div>
              <h3 className="text-sm font-bold text-primary">🎮 Your Turn!</h3>
              <p className="text-[10px] text-muted-foreground">Tap any empty cell to place your {matchInfo?.mySymbol}</p>
            </motion.div>
          )}

          {/* Opponent's Turn */}
          {!isBiddingPhase && !winner && !notification && !isProcessing && bidWinner !== matchInfo?.mySymbol && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full rounded-xl bg-card p-3 text-center mb-2" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="font-medium text-sm mb-1">{matchInfo?.opponent.player_name} is thinking</p>
              <div className="flex items-center justify-center gap-1">
                <motion.div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                <motion.div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} />
                <motion.div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />
              </div>
            </motion.div>
          )}

          {/* Game Board */}
          <div className="w-full max-w-[min(100%,60vh)] aspect-square rounded-2xl bg-card p-3" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="grid grid-cols-3 gap-2.5 h-full">
              {board.map((cell, index) => (
                <motion.button
                  key={index}
                  className={`game-cell ${cell === "X" ? "x" : cell === "O" ? "o" : ""} ${winningLine?.includes(index) ? "animate-winner-glow" : ""}`}
                  onClick={() => makeMove(index)}
                  disabled={cell !== null || !isMyTurn || !!winner || isBiddingPhase || bidWinner !== matchInfo?.mySymbol || isProcessing}
                  whileTap={{ scale: 0.95 }}
                >
                  <AnimatePresence mode="wait">
                    {cell && (
                      <motion.span key={cell} initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} className="animate-pop-in">
                        {cell}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Round Winner */}
          <AnimatePresence>
            {winner && !currentMatch.match_winner && !notification && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full rounded-2xl bg-card p-4 text-center mt-3" style={{ boxShadow: 'var(--shadow-card)' }}>
                <Trophy className="w-8 h-8 mx-auto mb-1.5 text-game-coin" />
                <h3 className="text-lg font-bold mb-0.5">
                  {winner === matchInfo?.mySymbol ? "You Won This Round! 🎉" : winner === "tie" ? "It's a Tie! 🤝" : `${matchInfo?.opponent.player_name} Wins 💪`}
                </h3>
                <p className="text-xs text-muted-foreground">Next round starting...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-center gap-3 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          <button onClick={handleBackClick} className="flex-1 py-3 rounded-xl bg-card hover:bg-muted transition-colors font-semibold text-sm flex items-center justify-center gap-2" style={{ boxShadow: 'var(--shadow-card)' }}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button onClick={toggleMute} className="py-3 px-3 rounded-xl bg-card hover:bg-muted transition-colors" style={{ boxShadow: 'var(--shadow-card)' }} title="Sound effects">
            {isMuted ? <VolumeX className="w-4 h-4 text-muted-foreground" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button onClick={toggleMusic} className="py-3 px-3 rounded-xl bg-card hover:bg-muted transition-colors" style={{ boxShadow: 'var(--shadow-card)' }} title="Background music">
            <Music className={`w-4 h-4 ${isMusicMuted ? 'text-muted-foreground' : 'text-primary'}`} />
          </button>
        </div>
      </div>

      <ConfirmLeaveDialog
        open={showConfirmLeave}
        onOpenChange={setShowConfirmLeave}
        onConfirm={handleConfirmLeave}
        title="Leave Match?"
        description="Are you sure you want to leave? This will count as a forfeit."
      />
    </div>
  );
}
