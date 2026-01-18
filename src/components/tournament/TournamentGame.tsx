import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, Check, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FloatingBackground from "@/components/ui/FloatingBackground";
import ConfirmLeaveDialog from "@/components/ui/ConfirmLeaveDialog";
import { useToast } from "@/hooks/use-toast";

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

// Convert board string to array
const boardStringToArray = (boardStr: string): Board => {
  return boardStr.split('').map(c => c === '-' ? null : c as Player);
};

// Convert board array to string
const boardArrayToString = (board: Board): string => {
  return board.map(c => c === null ? '-' : c).join('');
};

export default function TournamentGame({
  tournamentId,
  currentPlayerId,
  onBack,
}: TournamentGameProps) {
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [tournamentName, setTournamentName] = useState("");
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
    
    return {
      player1,
      player2,
      isPlayer1,
      mySymbol,
      opponent,
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

  // Fetch tournament data
  const fetchData = useCallback(async () => {
    console.log('Fetching tournament data...');
    
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
      console.log('Players loaded:', playersData);
      setPlayers(playersData);
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
      console.log('Match loaded:', matchData);
      setCurrentMatch(matchData as TournamentMatch);
    }
    
    setIsLoading(false);
  }, [tournamentId, currentPlayerId]);

  // Initial fetch and subscriptions
  useEffect(() => {
    fetchData();

    // Subscribe to player changes for ready status
    const playersChannel = supabase
      .channel(`tournament_game_players_${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_players',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          console.log('Player change:', payload);
          fetchData();
        }
      )
      .subscribe((status) => {
        console.log('Players subscription:', status);
      });

    // Subscribe to match changes for game state sync
    const matchChannel = supabase
      .channel(`tournament_matches_${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_matches',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          console.log('Match change:', payload);
          // Update match state directly from payload for faster sync
          const newMatch = payload.new as TournamentMatch;
          if (newMatch && (newMatch.player1_id === currentPlayerId || newMatch.player2_id === currentPlayerId)) {
            setCurrentMatch(newMatch);
          }
        }
      )
      .subscribe((status) => {
        console.log('Match subscription:', status);
      });

    return () => {
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(matchChannel);
    };
  }, [tournamentId, currentPlayerId, fetchData]);

  // Check if both players are ready and start the game
  useEffect(() => {
    const checkAndStartGame = async () => {
      if (!currentMatch || !matchInfo || currentMatch.status !== 'pending') return;
      
      const player1Ready = matchInfo.player1.is_ready;
      const player2Ready = matchInfo.player2.is_ready;
      
      console.log('Checking ready status:', { player1Ready, player2Ready });
      
      if (player1Ready && player2Ready) {
        // Only player1 updates the match to avoid race conditions
        if (matchInfo.isPlayer1) {
          console.log('Both players ready, starting game...');
          const { error } = await supabase
            .from('tournament_matches')
            .update({ status: 'playing' })
            .eq('id', currentMatch.id);
          
          if (error) {
            console.error('Error starting game:', error);
          }
        }
        
        toast({
          title: "Game Started! 🎮",
          description: `You are playing as ${matchInfo.mySymbol}`,
        });
      }
    };
    
    checkAndStartGame();
  }, [currentMatch, matchInfo, toast]);

  const handleReady = async () => {
    const newReadyState = !isReady;
    setIsReady(newReadyState);

    console.log('Updating ready state to:', newReadyState);

    const { error } = await supabase
      .from('tournament_players')
      .update({ is_ready: newReadyState })
      .eq('id', currentPlayerId);

    if (error) {
      console.error('Error updating ready state:', error);
      setIsReady(!newReadyState);
      toast({
        title: "Error",
        description: "Failed to update ready state",
        variant: "destructive",
      });
    }
  };

  const checkWinner = useCallback((currentBoard: Board): { winner: Player | "tie" | null; line: number[] | null } => {
    for (const combo of WINNING_COMBINATIONS) {
      const [a, b, c] = combo;
      if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
        return { winner: currentBoard[a], line: combo };
      }
    }
    if (currentBoard.every(cell => cell !== null)) {
      return { winner: "tie", line: null };
    }
    return { winner: null, line: null };
  }, []);

  const makeMove = useCallback(async (index: number) => {
    if (!gameStarted || !isMyTurn || board[index] !== null || winner || !currentMatch || !matchInfo) {
      console.log('Move blocked:', { gameStarted, isMyTurn, cellValue: board[index], winner });
      return;
    }

    const newBoard = [...board];
    newBoard[index] = matchInfo.mySymbol;
    const newBoardStr = boardArrayToString(newBoard);
    const nextTurn = currentTurn === "X" ? "O" : "X";
    
    const result = checkWinner(newBoard);
    
    console.log('Making move:', { index, symbol: matchInfo.mySymbol, result });

    const updateData: Record<string, unknown> = {
      board: newBoardStr,
      current_turn: nextTurn,
    };

    if (result.winner) {
      updateData.winner = result.winner;
      updateData.winning_line = result.line ? JSON.stringify(result.line) : null;
      updateData.status = 'completed';
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('tournament_matches')
      .update(updateData)
      .eq('id', currentMatch.id);

    if (error) {
      console.error('Error making move:', error);
      toast({
        title: "Error",
        description: "Failed to make move. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (result.winner) {
      const didWin = result.winner === matchInfo.mySymbol;
      toast({
        title: didWin ? "You Won! 🎉" : result.winner === "tie" ? "It's a Tie!" : "You Lost 😢",
        description: didWin 
          ? "Congratulations! You advance to the next round."
          : result.winner === "tie"
          ? "Good match!"
          : "Better luck next time!",
      });
    }
  }, [gameStarted, isMyTurn, board, winner, currentMatch, matchInfo, currentTurn, checkWinner, toast]);

  const handleBackClick = () => {
    setShowConfirmLeave(true);
  };

  const handleConfirmLeave = () => {
    setShowConfirmLeave(false);
    onBack();
  };

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
              <p className="text-sm text-muted-foreground">Tournament Match</p>
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
                <div className={`flex items-center justify-between p-4 rounded-xl ${
                  matchInfo.isPlayer1 ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                      X
                    </div>
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
                <div className={`flex items-center justify-between p-4 rounded-xl ${
                  !matchInfo.isPlayer1 ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold">
                      O
                    </div>
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
          {matchInfo && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={handleReady}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                isReady
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

  // Game board
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
            <p className="text-sm text-muted-foreground">
              {winner ? "Match Complete" : isMyTurn ? "Your Turn" : `${matchInfo?.opponent?.player_name}'s Turn`}
            </p>
          </div>
        </div>

        {/* Player Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="game-card mb-6"
        >
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 ${currentTurn === "X" && !winner ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                X
              </div>
              <span className="font-medium text-sm">
                {matchInfo?.player1.player_name}
                {matchInfo?.isPlayer1 && " (You)"}
              </span>
            </div>
            <span className="text-muted-foreground">VS</span>
            <div className={`flex items-center gap-2 ${currentTurn === "O" && !winner ? 'text-primary' : 'text-muted-foreground'}`}>
              <span className="font-medium text-sm">
                {matchInfo?.player2.player_name}
                {!matchInfo?.isPlayer1 && " (You)"}
              </span>
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-bold text-sm">
                O
              </div>
            </div>
          </div>
        </motion.div>

        {/* Game Board */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="game-card mb-6"
        >
          <div className="grid grid-cols-3 gap-2">
            {board.map((cell, index) => (
              <motion.button
                key={index}
                onClick={() => makeMove(index)}
                disabled={!isMyTurn || cell !== null || !!winner}
                className={`aspect-square rounded-xl text-4xl font-bold transition-all ${
                  cell === null && isMyTurn && !winner
                    ? 'bg-muted hover:bg-muted/80 cursor-pointer'
                    : 'bg-muted cursor-not-allowed'
                } ${
                  winningLine?.includes(index) ? 'bg-primary/20 ring-2 ring-primary' : ''
                }`}
                whileHover={cell === null && isMyTurn && !winner ? { scale: 1.05 } : {}}
                whileTap={cell === null && isMyTurn && !winner ? { scale: 0.95 } : {}}
              >
                <AnimatePresence>
                  {cell && (
                    <motion.span
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className={cell === "X" ? "text-primary" : "text-secondary-foreground"}
                    >
                      {cell}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Winner Display */}
        {winner && matchInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="game-card text-center"
          >
            <Trophy className={`w-12 h-12 mx-auto mb-2 ${
              winner === matchInfo.mySymbol ? 'text-primary' : 'text-muted-foreground'
            }`} />
            <h2 className="text-xl font-bold mb-2">
              {winner === "tie" 
                ? "It's a Tie!" 
                : winner === matchInfo.mySymbol 
                  ? "You Won!" 
                  : "You Lost"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {winner === matchInfo.mySymbol 
                ? "You advance to the next round!" 
                : winner === "tie"
                ? "The match will need to be replayed!"
                : "Better luck next time!"}
            </p>
          </motion.div>
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
