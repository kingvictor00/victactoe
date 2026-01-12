import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Clock, Trophy, RotateCcw, Home } from "lucide-react";
import BiddingModal from "./BiddingModal";
import GameOverModal from "./GameOverModal";

type Player = "X" | "O";
type CellValue = Player | null;
type Board = CellValue[];
type Difficulty = "easy" | "medium" | "hard";

interface GameBoardProps {
  onBack: () => void;
  difficulty: Difficulty;
}

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6], // diagonals
];

const INITIAL_COINS = 100;
const TURN_TIME = 20;
const MAX_AUTO_PLAYS = 5;

export default function GameBoard({ onBack, difficulty }: GameBoardProps) {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [playerCoins, setPlayerCoins] = useState(INITIAL_COINS);
  const [computerCoins, setComputerCoins] = useState(INITIAL_COINS);
  const [currentBidder, setCurrentBidder] = useState<Player | null>(null);
  const [showBidding, setShowBidding] = useState(true);
  const [winner, setWinner] = useState<Player | "tie" | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [autoPlays, setAutoPlays] = useState(0);
  const [lastBidResult, setLastBidResult] = useState<{ playerBid: number; computerBid: number; winner: Player } | null>(null);
  const [score, setScore] = useState({ player: 0, computer: 0 });
  const [round, setRound] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isComputerThinking, setIsComputerThinking] = useState(false);

  const checkWinner = useCallback((currentBoard: Board): { winner: Player | "tie" | null; line: number[] | null } => {
    for (const combo of WINNING_COMBINATIONS) {
      const [a, b, c] = combo;
      if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
        return { winner: currentBoard[a], line: combo };
      }
    }
    if (currentBoard.every(cell => cell !== null)) {
      // Board full - economic win
      if (playerCoins > computerCoins) return { winner: "X", line: null };
      if (computerCoins > playerCoins) return { winner: "O", line: null };
      return { winner: "tie", line: null };
    }
    // Bankruptcy check
    if (playerCoins <= 0 && computerCoins > 0) return { winner: "O", line: null };
    if (computerCoins <= 0 && playerCoins > 0) return { winner: "X", line: null };
    return { winner: null, line: null };
  }, [playerCoins, computerCoins]);

  const getEmptyCells = (currentBoard: Board): number[] => {
    return currentBoard.reduce<number[]>((acc, cell, idx) => {
      if (cell === null) acc.push(idx);
      return acc;
    }, []);
  };

  const computerMove = useCallback((currentBoard: Board): number => {
    const emptyCells = getEmptyCells(currentBoard);
    
    // Easy: mostly random with occasional blocking
    if (difficulty === "easy") {
      if (Math.random() < 0.3) {
        // 30% chance to make a smart move
        for (const combo of WINNING_COMBINATIONS) {
          const [a, b, c] = combo;
          const values = [currentBoard[a], currentBoard[b], currentBoard[c]];
          const oCount = values.filter(v => v === "O").length;
          const emptyCount = values.filter(v => v === null).length;
          if (oCount === 2 && emptyCount === 1) {
            const emptyIdx = [a, b, c].find(i => currentBoard[i] === null);
            if (emptyIdx !== undefined) return emptyIdx;
          }
        }
      }
      return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }
    
    // Medium: try to win, block, prefer center, then random
    if (difficulty === "medium") {
      // Try to win
      for (const combo of WINNING_COMBINATIONS) {
        const [a, b, c] = combo;
        const values = [currentBoard[a], currentBoard[b], currentBoard[c]];
        const oCount = values.filter(v => v === "O").length;
        const emptyCount = values.filter(v => v === null).length;
        if (oCount === 2 && emptyCount === 1) {
          const emptyIdx = [a, b, c].find(i => currentBoard[i] === null);
          if (emptyIdx !== undefined) return emptyIdx;
        }
      }
      // Block player
      for (const combo of WINNING_COMBINATIONS) {
        const [a, b, c] = combo;
        const values = [currentBoard[a], currentBoard[b], currentBoard[c]];
        const xCount = values.filter(v => v === "X").length;
        const emptyCount = values.filter(v => v === null).length;
        if (xCount === 2 && emptyCount === 1) {
          const emptyIdx = [a, b, c].find(i => currentBoard[i] === null);
          if (emptyIdx !== undefined) return emptyIdx;
        }
      }
      if (emptyCells.includes(4)) return 4;
      return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }
    
    // Hard: minimax-like strategy with perfect play
    // Try to win
    for (const combo of WINNING_COMBINATIONS) {
      const [a, b, c] = combo;
      const values = [currentBoard[a], currentBoard[b], currentBoard[c]];
      const oCount = values.filter(v => v === "O").length;
      const emptyCount = values.filter(v => v === null).length;
      if (oCount === 2 && emptyCount === 1) {
        const emptyIdx = [a, b, c].find(i => currentBoard[i] === null);
        if (emptyIdx !== undefined) return emptyIdx;
      }
    }
    // Block player
    for (const combo of WINNING_COMBINATIONS) {
      const [a, b, c] = combo;
      const values = [currentBoard[a], currentBoard[b], currentBoard[c]];
      const xCount = values.filter(v => v === "X").length;
      const emptyCount = values.filter(v => v === null).length;
      if (xCount === 2 && emptyCount === 1) {
        const emptyIdx = [a, b, c].find(i => currentBoard[i] === null);
        if (emptyIdx !== undefined) return emptyIdx;
      }
    }
    // Create a fork (two ways to win)
    for (const cell of emptyCells) {
      const testBoard = [...currentBoard];
      testBoard[cell] = "O";
      let winPaths = 0;
      for (const combo of WINNING_COMBINATIONS) {
        const [a, b, c] = combo;
        const values = [testBoard[a], testBoard[b], testBoard[c]];
        const oCount = values.filter(v => v === "O").length;
        const emptyCount = values.filter(v => v === null).length;
        if (oCount === 2 && emptyCount === 1) winPaths++;
      }
      if (winPaths >= 2) return cell;
    }
    // Block player fork
    for (const cell of emptyCells) {
      const testBoard = [...currentBoard];
      testBoard[cell] = "X";
      let winPaths = 0;
      for (const combo of WINNING_COMBINATIONS) {
        const [a, b, c] = combo;
        const values = [testBoard[a], testBoard[b], testBoard[c]];
        const xCount = values.filter(v => v === "X").length;
        const emptyCount = values.filter(v => v === null).length;
        if (xCount === 2 && emptyCount === 1) winPaths++;
      }
      if (winPaths >= 2) return cell;
    }
    // Center
    if (emptyCells.includes(4)) return 4;
    // Corners
    const corners = [0, 2, 6, 8].filter(c => emptyCells.includes(c));
    if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
    // Edges
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }, [difficulty]);

  const getComputerBid = useCallback(() => {
    const maxBid = computerCoins;
    if (difficulty === "easy") {
      // Easy: bid low, 1-15% of coins
      return Math.min(Math.floor(Math.random() * Math.max(1, maxBid * 0.15)) + 1, maxBid);
    } else if (difficulty === "medium") {
      // Medium: bid moderately, 5-30% of coins
      return Math.min(Math.floor(Math.random() * Math.max(1, maxBid * 0.25)) + Math.floor(maxBid * 0.05) + 1, maxBid);
    } else {
      // Hard: bid strategically, 10-50% of coins
      const strategicBid = Math.floor(Math.random() * Math.max(1, maxBid * 0.4)) + Math.floor(maxBid * 0.1) + 1;
      return Math.min(strategicBid, maxBid);
    }
  }, [computerCoins, difficulty]);

  const executeComputerMove = useCallback((currentBoard: Board) => {
    setIsComputerThinking(true);
    const thinkTime = difficulty === "easy" ? 500 : difficulty === "medium" ? 800 : 1200;
    
    setTimeout(() => {
      const moveIndex = computerMove(currentBoard);
      setIsComputerThinking(false);
      
      const newBoard = [...currentBoard];
      newBoard[moveIndex] = "O";
      setBoard(newBoard);
      
      const result = checkWinner(newBoard);
      if (result.winner) {
        setWinner(result.winner);
        setWinningLine(result.line);
        if (result.winner === "O") {
          setScore(prev => ({ ...prev, computer: prev.computer + 1 }));
        } else if (result.winner === "X") {
          setScore(prev => ({ ...prev, player: prev.player + 1 }));
        }
        setTimeout(() => {
          const newPlayerScore = result.winner === "X" ? score.player + 1 : score.player;
          const newComputerScore = result.winner === "O" ? score.computer + 1 : score.computer;
          if (newPlayerScore >= 2 || newComputerScore >= 2) {
            setGameOver(true);
          } else {
            startNextRound();
          }
        }, 2000);
      } else {
        setShowBidding(true);
        setCurrentBidder(null);
      }
    }, thinkTime);
  }, [computerMove, checkWinner, score, difficulty]);

  const handleBidSubmit = useCallback((playerBid: number) => {
    const computerBid = getComputerBid();
    
    setPlayerCoins(prev => prev - playerBid);
    setComputerCoins(prev => prev - computerBid);
    
    let bidWinner: Player;
    if (playerBid > computerBid) {
      bidWinner = "X";
    } else if (computerBid > playerBid) {
      bidWinner = "O";
    } else {
      bidWinner = Math.random() > 0.5 ? "X" : "O";
    }
    
    setLastBidResult({ playerBid, computerBid, winner: bidWinner });
    setCurrentBidder(bidWinner);
    setShowBidding(false);
    setTimeLeft(TURN_TIME);
    
    if (bidWinner === "O") {
      executeComputerMove(board);
    }
  }, [getComputerBid, board, executeComputerMove]);

  const makeMove = useCallback((cellIndex: number) => {
    if (board[cellIndex] !== null || !currentBidder) return;
    
    const newBoard = [...board];
    newBoard[cellIndex] = currentBidder;
    setBoard(newBoard);
    setAutoPlays(0);
    
    const result = checkWinner(newBoard);
    if (result.winner) {
      setWinner(result.winner);
      setWinningLine(result.line);
      if (result.winner === "X") {
        setScore(prev => ({ ...prev, player: prev.player + 1 }));
      } else if (result.winner === "O") {
        setScore(prev => ({ ...prev, computer: prev.computer + 1 }));
      }
      setTimeout(() => {
        if (score.player === 1 || score.computer === 1 || result.winner === "tie") {
          // Best of 3 logic - check if someone has 2 wins
          const newPlayerScore = result.winner === "X" ? score.player + 1 : score.player;
          const newComputerScore = result.winner === "O" ? score.computer + 1 : score.computer;
          if (newPlayerScore >= 2 || newComputerScore >= 2) {
            setGameOver(true);
          } else {
            startNextRound();
          }
        } else {
          startNextRound();
        }
      }, 2000);
    } else {
      setShowBidding(true);
      setCurrentBidder(null);
    }
  }, [board, currentBidder, checkWinner, score]);

  const startNextRound = () => {
    setBoard(Array(9).fill(null));
    setPlayerCoins(INITIAL_COINS);
    setComputerCoins(INITIAL_COINS);
    setWinner(null);
    setWinningLine(null);
    setCurrentBidder(null);
    setShowBidding(true);
    setTimeLeft(TURN_TIME);
    setAutoPlays(0);
    setLastBidResult(null);
    setRound(prev => prev + 1);
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setPlayerCoins(INITIAL_COINS);
    setComputerCoins(INITIAL_COINS);
    setWinner(null);
    setWinningLine(null);
    setCurrentBidder(null);
    setShowBidding(true);
    setTimeLeft(TURN_TIME);
    setAutoPlays(0);
    setLastBidResult(null);
    setScore({ player: 0, computer: 0 });
    setRound(1);
    setGameOver(false);
  };

  // Timer effect
  useEffect(() => {
    if (!currentBidder || winner || currentBidder === "O") return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto play
          const emptyCells = getEmptyCells(board);
          if (emptyCells.length > 0) {
            const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            setAutoPlays(ap => {
              const newAutoPlays = ap + 1;
              if (newAutoPlays >= MAX_AUTO_PLAYS) {
                setWinner("O");
                setScore(prev => ({ ...prev, computer: prev.computer + 1 }));
              }
              return newAutoPlays;
            });
            makeMove(randomCell);
          }
          return TURN_TIME;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [currentBidder, winner, board, makeMove]);

  const getCellClass = (index: number) => {
    const baseClass = "game-cell";
    const isWinning = winningLine?.includes(index);
    const value = board[index];
    
    return `${baseClass} ${value === "X" ? "x" : value === "O" ? "o" : ""} ${isWinning ? "animate-winner-glow" : ""}`;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={onBack}
            className="p-2 rounded-xl bg-card hover:bg-muted transition-colors"
          >
            <Home className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">TicTacToe</h1>
          <button 
            onClick={resetGame}
            className="p-2 rounded-xl bg-card hover:bg-muted transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        {/* Score Display */}
        <div className="game-card mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">Round {round} • Best of 3</span>
            <div className="flex items-center gap-2">
              <span className="text-game-x font-bold">{score.player}</span>
              <span className="text-muted-foreground">-</span>
              <span className="text-game-o font-bold">{score.computer}</span>
            </div>
          </div>
        </div>

        {/* Players Info */}
        <div className="flex justify-between items-center mb-6 gap-4">
          <div className={`game-card flex-1 ${currentBidder === "X" ? "ring-2 ring-primary" : ""}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-game-x font-bold">X</span>
              </div>
              <span className="font-medium text-sm">You</span>
            </div>
            <div className="coin-badge">
              <Coins className="w-4 h-4" />
              ${playerCoins}
            </div>
          </div>
          
          <div className={`game-card flex-1 ${currentBidder === "O" ? "ring-2 ring-secondary" : ""}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                <span className="text-game-o font-bold">O</span>
              </div>
              <span className="font-medium text-sm">Computer</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                difficulty === "easy" ? "bg-green-500/20 text-green-600" :
                difficulty === "medium" ? "bg-amber-500/20 text-amber-600" :
                "bg-red-500/20 text-red-600"
              }`}>
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </span>
            </div>
            <div className="coin-badge">
              <Coins className="w-4 h-4" />
              ${computerCoins}
            </div>
            {isComputerThinking && (
              <div className="text-xs text-muted-foreground mt-2 animate-pulse">
                Thinking...
              </div>
            )}
          </div>
        </div>

        {/* Last Bid Result */}
        <AnimatePresence>
          {lastBidResult && !showBidding && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="game-card mb-4 text-center text-sm"
            >
              <span className="text-muted-foreground">
                You bid <span className="text-game-x font-bold">${lastBidResult.playerBid}</span> vs 
                <span className="text-game-o font-bold"> ${lastBidResult.computerBid}</span>
              </span>
              <span className="block font-medium mt-1">
                {lastBidResult.winner === "X" ? "🎯 You win the bid!" : "💻 Computer wins the bid"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timer */}
        {currentBidder === "X" && !winner && (
          <div className="flex justify-center mb-4">
            <div className={`timer-ring ${timeLeft <= 5 ? "text-game-warning" : "text-foreground"}`}>
              <Clock className="w-4 h-4 absolute top-0 right-0 opacity-50" />
              {timeLeft}s
            </div>
          </div>
        )}

        {/* Game Board */}
        <div className="game-card mb-6">
          <div className="grid grid-cols-3 gap-3">
            {board.map((cell, index) => (
              <motion.button
                key={index}
                className={getCellClass(index)}
                onClick={() => currentBidder === "X" && makeMove(index)}
                disabled={cell !== null || currentBidder !== "X" || !!winner}
                whileTap={{ scale: 0.95 }}
              >
                <AnimatePresence mode="wait">
                  {cell && (
                    <motion.span
                      key={cell}
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="animate-pop-in"
                    >
                      {cell}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Winner Announcement */}
        <AnimatePresence>
          {winner && !gameOver && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="game-card text-center"
            >
              <Trophy className="w-10 h-10 mx-auto mb-2 text-game-coin" />
              <h3 className="text-xl font-bold mb-1">
                {winner === "X" ? "You Win This Round! 🎉" : winner === "O" ? "Computer Wins 💻" : "It's a Tie! 🤝"}
              </h3>
              <p className="text-sm text-muted-foreground">Next round starting...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auto-play warning */}
        {autoPlays > 0 && autoPlays < MAX_AUTO_PLAYS && (
          <div className="text-center text-sm text-game-warning mt-4">
            ⚠️ Auto-played {autoPlays}/{MAX_AUTO_PLAYS} times
          </div>
        )}
      </div>

      {/* Bidding Modal */}
      <BiddingModal 
        isOpen={showBidding && !winner}
        onSubmit={handleBidSubmit}
        maxBid={playerCoins}
      />

      {/* Game Over Modal */}
      <GameOverModal
        isOpen={gameOver}
        winner={score.player >= 2 ? "player" : "computer"}
        playerScore={score.player}
        computerScore={score.computer}
        onPlayAgain={resetGame}
        onHome={onBack}
      />
    </div>
  );
}