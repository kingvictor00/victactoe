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

export default function TournamentGame({
  tournamentId,
  currentPlayerId,
  onBack,
}: TournamentGameProps) {
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);
  const [tournamentName, setTournamentName] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState<Player>("X");
  const [winner, setWinner] = useState<Player | "tie" | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const { toast } = useToast();

  // Get current player and opponent
  const currentPlayer = useMemo(() => 
    players.find(p => p.id === currentPlayerId),
    [players, currentPlayerId]
  );

  // Get the current match pairing based on seed positions
  const matchPairing = useMemo(() => {
    const activePlayers = players
      .filter(p => !p.is_eliminated && p.seed_position !== null)
      .sort((a, b) => (a.seed_position ?? 0) - (b.seed_position ?? 0));
    
    // Find which match the current player is in
    for (let i = 0; i < activePlayers.length; i += 2) {
      if (i + 1 < activePlayers.length) {
        const player1 = activePlayers[i];
        const player2 = activePlayers[i + 1];
        if (player1.id === currentPlayerId || player2.id === currentPlayerId) {
          return {
            player1,
            player2,
            isPlayer1: player1.id === currentPlayerId,
          };
        }
      }
    }
    return null;
  }, [players, currentPlayerId]);

  const opponent = matchPairing?.isPlayer1 
    ? matchPairing.player2 
    : matchPairing?.player1;

  const mySymbol: Player = matchPairing?.isPlayer1 ? "X" : "O";
  const isMyTurn = currentTurn === mySymbol;

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
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
        const me = playersData.find(p => p.id === currentPlayerId);
        if (me) {
          setIsReady(me.is_ready);
        }
      }
    };

    fetchData();

    // Subscribe to player changes
    const channel = supabase
      .channel(`tournament_game_${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_players',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, currentPlayerId]);

  // Check if both players are ready
  useEffect(() => {
    if (matchPairing && matchPairing.player1.is_ready && matchPairing.player2.is_ready && !gameStarted) {
      setGameStarted(true);
      toast({
        title: "Game Started! 🎮",
        description: `You are playing as ${mySymbol}`,
      });
    }
  }, [matchPairing, gameStarted, mySymbol, toast]);

  const handleReady = async () => {
    const newReadyState = !isReady;
    setIsReady(newReadyState);

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

  const makeMove = useCallback((index: number) => {
    if (!gameStarted || !isMyTurn || board[index] !== null || winner) return;

    const newBoard = [...board];
    newBoard[index] = mySymbol;
    setBoard(newBoard);

    const result = checkWinner(newBoard);
    if (result.winner) {
      setWinner(result.winner);
      setWinningLine(result.line);
      
      const didWin = result.winner === mySymbol;
      toast({
        title: didWin ? "You Won! 🎉" : "You Lost 😢",
        description: didWin 
          ? "Congratulations! You advance to the next round."
          : "Better luck next time!",
      });
    } else {
      setCurrentTurn(currentTurn === "X" ? "O" : "X");
    }
  }, [gameStarted, isMyTurn, board, winner, mySymbol, checkWinner, currentTurn, toast]);

  const handleBackClick = () => {
    setShowConfirmLeave(true);
  };

  const handleConfirmLeave = () => {
    setShowConfirmLeave(false);
    onBack();
  };

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

            {matchPairing ? (
              <div className="space-y-4">
                {/* Player 1 */}
                <div className={`flex items-center justify-between p-4 rounded-xl ${
                  matchPairing.isPlayer1 ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                      X
                    </div>
                    <div>
                      <p className="font-medium">{matchPairing.player1.player_name}</p>
                      {matchPairing.isPlayer1 && (
                        <p className="text-xs text-primary">(You)</p>
                      )}
                    </div>
                  </div>
                  {matchPairing.player1.is_ready ? (
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
                  !matchPairing.isPlayer1 ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold">
                      O
                    </div>
                    <div>
                      <p className="font-medium">{matchPairing.player2.player_name}</p>
                      {!matchPairing.isPlayer1 && (
                        <p className="text-xs text-primary">(You)</p>
                      )}
                    </div>
                  </div>
                  {matchPairing.player2.is_ready ? (
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
                Finding your match...
              </div>
            )}
          </motion.div>

          {/* Ready Button */}
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

          {isReady && opponent && !opponent.is_ready && (
            <p className="text-center text-muted-foreground mt-4 text-sm">
              Waiting for {opponent.player_name} to be ready...
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
              {winner ? "Match Complete" : isMyTurn ? "Your Turn" : `${opponent?.player_name}'s Turn`}
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
            <div className={`flex items-center gap-2 ${currentTurn === "X" ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                X
              </div>
              <span className="font-medium text-sm">
                {matchPairing?.player1.player_name}
                {matchPairing?.isPlayer1 && " (You)"}
              </span>
            </div>
            <span className="text-muted-foreground">VS</span>
            <div className={`flex items-center gap-2 ${currentTurn === "O" ? 'text-primary' : 'text-muted-foreground'}`}>
              <span className="font-medium text-sm">
                {matchPairing?.player2.player_name}
                {!matchPairing?.isPlayer1 && " (You)"}
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
        {winner && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="game-card text-center"
          >
            <Trophy className={`w-12 h-12 mx-auto mb-2 ${
              winner === mySymbol ? 'text-primary' : 'text-muted-foreground'
            }`} />
            <h2 className="text-xl font-bold mb-2">
              {winner === "tie" 
                ? "It's a Tie!" 
                : winner === mySymbol 
                  ? "You Won!" 
                  : "You Lost"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {winner === mySymbol 
                ? "You advance to the next round!" 
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
