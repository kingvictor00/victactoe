import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Clock, Trophy, RotateCcw, Home, ArrowRight, Loader2 } from "lucide-react";
import GameOverModal from "./GameOverModal";
import { Slider } from "@/components/ui/slider";
import ConfirmLeaveDialog from "@/components/ui/ConfirmLeaveDialog";

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
const BID_TIME = 20;
const MAX_AUTO_PLAYS = 5;
const BID_RESULT_DELAY = 3000; // 3 seconds for bid results
const COIN_TOSS_DELAY = 7000; // 7 seconds for coin toss
const BANKRUPTCY_DELAY = 3000; // 3 seconds for bankruptcy notification

type NotificationType = "bid_win" | "bid_lose" | "tie_coin_toss" | "bankruptcy";

interface Notification {
  type: NotificationType;
  message: string;
  subMessage?: string;
  winner?: Player;
}

export default function GameBoard({ onBack, difficulty }: GameBoardProps) {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [playerCoins, setPlayerCoins] = useState(INITIAL_COINS);
  const [computerCoins, setComputerCoins] = useState(INITIAL_COINS);
  const [currentBidder, setCurrentBidder] = useState<Player | null>(null);
  const [isBiddingPhase, setIsBiddingPhase] = useState(true);
  const [winner, setWinner] = useState<Player | "tie" | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [bidTimeLeft, setBidTimeLeft] = useState(BID_TIME);
  const [autoPlays, setAutoPlays] = useState(0);
  const [lastBidResult, setLastBidResult] = useState<{ playerBid: number; computerBid: number; winner: Player } | null>(null);
  const [score, setScore] = useState({ player: 0, computer: 0 });
  const [round, setRound] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isComputerThinking, setIsComputerThinking] = useState(false);
  const [playerBid, setPlayerBid] = useState(10);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isProcessingBid, setIsProcessingBid] = useState(false);
  const [coinTossAnimation, setCoinTossAnimation] = useState(false);

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
    // Enforce minimum bid of $1 for computer as well
    if (difficulty === "easy") {
      // Easy: bid low, 1-15% of coins
      return Math.max(1, Math.min(Math.floor(Math.random() * Math.max(1, maxBid * 0.15)) + 1, maxBid));
    } else if (difficulty === "medium") {
      // Medium: bid moderately, 5-30% of coins
      return Math.max(1, Math.min(Math.floor(Math.random() * Math.max(1, maxBid * 0.25)) + Math.floor(maxBid * 0.05) + 1, maxBid));
    } else {
      // Hard: bid strategically, 10-50% of coins
      const strategicBid = Math.floor(Math.random() * Math.max(1, maxBid * 0.4)) + Math.floor(maxBid * 0.1) + 1;
      return Math.max(1, Math.min(strategicBid, maxBid));
    }
  }, [computerCoins, difficulty]);

  const executeComputerMove = useCallback((currentBoard: Board) => {
    setIsComputerThinking(true);
    // 3 second delay for thinking as requested
    const thinkTime = 3000;
    
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
        setIsBiddingPhase(true);
        setBidTimeLeft(BID_TIME);
        setCurrentBidder(null);
      }
    }, thinkTime);
  }, [computerMove, checkWinner, score]);

  const handleBidSubmit = useCallback((bidAmount: number) => {
    if (isProcessingBid) return;
    setIsProcessingBid(true);
    
    const computerBid = getComputerBid();
    // Enforce minimum bid of $1 - no $0 bids allowed
    const actualBid = Math.max(1, Math.min(bidAmount, playerCoins));
    
    const newPlayerCoins = playerCoins - actualBid;
    const newComputerCoins = computerCoins - computerBid;
    
    setPlayerCoins(newPlayerCoins);
    setComputerCoins(newComputerCoins);
    
    const isTie = actualBid === computerBid;
    let bidWinner: Player;
    
    if (actualBid > computerBid) {
      bidWinner = "X";
    } else if (computerBid > actualBid) {
      bidWinner = "O";
    } else {
      // Tie - coin toss
      bidWinner = Math.random() > 0.5 ? "X" : "O";
    }
    
    setLastBidResult({ playerBid: actualBid, computerBid, winner: bidWinner });
    setIsBiddingPhase(false);
    setPlayerBid(10);
    
    // Handle tie with coin toss animation
    if (isTie) {
      setCoinTossAnimation(true);
      setNotification({
        type: "tie_coin_toss",
        message: "🪙 It's a Tie! Coin Toss...",
        subMessage: "Both players bid the same amount. Flipping a coin to decide...",
        winner: bidWinner,
      });
      
      setTimeout(() => {
        setNotification({
          type: "tie_coin_toss",
          message: bidWinner === "X" ? "🎯 You Won the Coin Toss!" : "💻 Computer Won the Coin Toss!",
          subMessage: `${bidWinner === "X" ? "You" : "Computer"} will make the next move.`,
          winner: bidWinner,
        });
        setCoinTossAnimation(false);
        
        setTimeout(() => {
          setNotification(null);
          setCurrentBidder(bidWinner);
          setTimeLeft(TURN_TIME);
          setIsProcessingBid(false);
          
          if (bidWinner === "O") {
            executeComputerMove(board);
          }
        }, BID_RESULT_DELAY);
      }, COIN_TOSS_DELAY - BID_RESULT_DELAY);
      return;
    }
    
    // Show bid result notification with delay
    setNotification({
      type: bidWinner === "X" ? "bid_win" : "bid_lose",
      message: bidWinner === "X" ? "🎯 You Won the Bid!" : "💻 Computer Won the Bid!",
      subMessage: `You bid $${actualBid} vs Computer's $${computerBid}`,
    });
    
    setTimeout(() => {
      setNotification(null);
      setCurrentBidder(bidWinner);
      setTimeLeft(TURN_TIME);
      setIsProcessingBid(false);
      
      if (bidWinner === "O") {
        executeComputerMove(board);
      }
    }, BID_RESULT_DELAY);
    
  }, [getComputerBid, board, executeComputerMove, playerCoins, computerCoins, isProcessingBid]);

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
      // Bankruptcy check at start of next turn (before bidding phase)
      // Check if player can afford to continue bidding (minimum bid is $1)
      if (playerCoins < 1) {
        setNotification({
          type: "bankruptcy",
          message: "💸 You're Bankrupt!",
          subMessage: "You can't afford to bid anymore. Computer wins this round!",
        });
        setTimeout(() => {
          setNotification(null);
          setWinner("O");
          setScore(prev => ({ ...prev, computer: prev.computer + 1 }));
          setTimeout(() => {
            const newComputerScore = score.computer + 1;
            if (newComputerScore >= 2) {
              setGameOver(true);
            } else {
              startNextRound();
            }
          }, 2000);
        }, BANKRUPTCY_DELAY);
        return;
      }
      
      if (computerCoins < 1) {
        setNotification({
          type: "bankruptcy",
          message: "🎉 Computer Bankrupt!",
          subMessage: "Computer can't afford to bid anymore. You win this round!",
        });
        setTimeout(() => {
          setNotification(null);
          setWinner("X");
          setScore(prev => ({ ...prev, player: prev.player + 1 }));
          setTimeout(() => {
            const newPlayerScore = score.player + 1;
            if (newPlayerScore >= 2) {
              setGameOver(true);
            } else {
              startNextRound();
            }
          }, 2000);
        }, BANKRUPTCY_DELAY);
        return;
      }
      
      setIsBiddingPhase(true);
      setBidTimeLeft(BID_TIME);
      setCurrentBidder(null);
    }
  }, [board, currentBidder, checkWinner, score, playerCoins, computerCoins]);

  const startNextRound = () => {
    setBoard(Array(9).fill(null));
    setPlayerCoins(INITIAL_COINS);
    setComputerCoins(INITIAL_COINS);
    setWinner(null);
    setWinningLine(null);
    setCurrentBidder(null);
    setIsBiddingPhase(true);
    setTimeLeft(TURN_TIME);
    setBidTimeLeft(BID_TIME);
    setAutoPlays(0);
    setLastBidResult(null);
    setRound(prev => prev + 1);
    setPlayerBid(10);
    setNotification(null);
    setIsProcessingBid(false);
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setPlayerCoins(INITIAL_COINS);
    setComputerCoins(INITIAL_COINS);
    setWinner(null);
    setWinningLine(null);
    setCurrentBidder(null);
    setIsBiddingPhase(true);
    setTimeLeft(TURN_TIME);
    setBidTimeLeft(BID_TIME);
    setAutoPlays(0);
    setLastBidResult(null);
    setScore({ player: 0, computer: 0 });
    setRound(1);
    setGameOver(false);
    setPlayerBid(10);
    setNotification(null);
    setIsProcessingBid(false);
  };

  const handleBackClick = () => {
    setShowConfirmLeave(true);
  };

  const handleConfirmLeave = () => {
    setShowConfirmLeave(false);
    onBack();
  };

  // Bid timer effect
  useEffect(() => {
    if (!isBiddingPhase || winner || isProcessingBid) return;
    
    const timer = setInterval(() => {
      setBidTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-submit minimum bid when time runs out
          handleBidSubmit(1);
          return BID_TIME;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isBiddingPhase, winner, handleBidSubmit, isProcessingBid]);

  // Turn timer effect
  useEffect(() => {
    if (!currentBidder || winner || currentBidder === "O" || isBiddingPhase) return;
    
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
  }, [currentBidder, winner, board, makeMove, isBiddingPhase]);

  const getCellClass = (index: number) => {
    const baseClass = "game-cell";
    const isWinning = winningLine?.includes(index);
    const value = board[index];
    
    return `${baseClass} ${value === "X" ? "x" : value === "O" ? "o" : ""} ${isWinning ? "animate-winner-glow" : ""}`;
  };

  const quickBids = [5, 10, 25, 50];

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
      <div className="max-w-md mx-auto w-full flex flex-col h-full px-4 py-3">
        {/* Top Bar: Players + Score */}
        <div className="flex items-center gap-3 mb-2">
          {/* Player X (You) */}
          <div className={`flex-1 rounded-xl p-2.5 bg-card transition-all ${currentBidder === "X" ? "ring-2 ring-primary" : ""}`} style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-game-x font-bold text-sm">X</span>
              </div>
              <span className="font-medium text-xs">You</span>
            </div>
            <div className="coin-badge text-xs">
              <Coins className="w-3 h-3" />
              ${playerCoins}
            </div>
          </div>

          {/* Center: Round + Score */}
          <div className="text-center shrink-0">
            <div className="text-xs text-muted-foreground font-medium">Round {round}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-game-x font-bold text-lg">{score.player}</span>
              <span className="text-muted-foreground text-sm">-</span>
              <span className="text-game-o font-bold text-lg">{score.computer}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Best of 3</div>
          </div>

          {/* Player O (Computer) */}
          <div className={`flex-1 rounded-xl p-2.5 bg-card transition-all ${currentBidder === "O" ? "ring-2 ring-secondary" : ""}`} style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-secondary/10 flex items-center justify-center">
                <span className="text-game-o font-bold text-sm">O</span>
              </div>
              <span className="font-medium text-xs">CPU</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                difficulty === "easy" ? "bg-green-500/20 text-green-600" :
                difficulty === "medium" ? "bg-amber-500/20 text-amber-600" :
                "bg-red-500/20 text-red-600"
              }`}>
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </span>
            </div>
            <div className="coin-badge text-xs">
              <Coins className="w-3 h-3" />
              ${computerCoins}
            </div>
            {isComputerThinking && (
              <div className="flex items-center gap-1 mt-1">
                <div className="flex gap-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[10px] text-muted-foreground">Thinking</span>
              </div>
            )}
          </div>
        </div>

        {/* Middle: Board + Overlays (flex-1 to fill remaining space) */}
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
                {coinTossAnimation && (
                  <div className="mb-2">
                    <motion.div
                      animate={{ rotateY: [0, 180, 360, 540, 720], scale: [1, 1.2, 1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xl shadow-lg"
                    >
                      🪙
                    </motion.div>
                  </div>
                )}
                <h3 className="text-base font-bold mb-0.5">{notification.message}</h3>
                {notification.subMessage && (
                  <p className="text-xs text-muted-foreground">{notification.subMessage}</p>
                )}
                {notification.type === "bankruptcy" && (
                  <Loader2 className="w-4 h-4 mx-auto mt-1.5 animate-spin text-muted-foreground" />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inline Bidding Section */}
          <AnimatePresence mode="wait">
            {isBiddingPhase && !winner && !notification && !isProcessingBid && (
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
                  <div className={`timer-ring w-10 h-10 text-sm ${bidTimeLeft <= 5 ? "text-game-warning" : "text-foreground"}`}>
                    <Clock className="w-2.5 h-2.5 absolute top-0 right-0 opacity-50" />
                    {bidTimeLeft}s
                  </div>
                </div>
                <div className="flex gap-1.5 justify-center mb-2">
                  {quickBids.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setPlayerBid(Math.min(amount, playerCoins))}
                      disabled={amount > playerCoins}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        playerBid === amount ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                      } ${amount > playerCoins ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">$1</span>
                    <span className="font-bold text-base">${playerBid}</span>
                    <span className="text-muted-foreground">${playerCoins}</span>
                  </div>
                  <Slider value={[playerBid]} onValueChange={(v) => setPlayerBid(v[0])} min={1} max={playerCoins} step={1} className="w-full" />
                </div>
                <button onClick={() => handleBidSubmit(playerBid)} className="btn-game-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm">
                  Confirm Bid <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Last Bid Result */}
          <AnimatePresence>
            {lastBidResult && !isBiddingPhase && !notification && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full rounded-xl bg-card p-2.5 text-center text-xs mb-2" style={{ boxShadow: 'var(--shadow-card)' }}>
                <span className="text-muted-foreground">
                  You bid <span className="text-game-x font-bold">${lastBidResult.playerBid}</span> vs <span className="text-game-o font-bold">${lastBidResult.computerBid}</span>
                </span>
                <span className="block font-medium mt-0.5">
                  {lastBidResult.winner === "X" ? "🎯 You win the bid!" : "💻 Computer wins the bid"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Timer for your turn */}
          {currentBidder === "X" && !winner && !isBiddingPhase && !notification && (
            <div className="flex justify-center mb-2">
              <div className={`timer-ring w-10 h-10 text-sm ${timeLeft <= 5 ? "text-game-warning" : "text-foreground"}`}>
                <Clock className="w-3 h-3 absolute top-0 right-0 opacity-50" />
                {timeLeft}s
              </div>
            </div>
          )}

          {/* Game Board */}
          <div className="w-full max-w-[min(100%,60vh)] aspect-square rounded-2xl bg-card p-3" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="grid grid-cols-3 gap-2.5 h-full">
              {board.map((cell, index) => (
                <motion.button
                  key={index}
                  className={getCellClass(index)}
                  onClick={() => currentBidder === "X" && makeMove(index)}
                  disabled={cell !== null || currentBidder !== "X" || !!winner || isBiddingPhase || !!notification}
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

          {/* Winner Announcement */}
          <AnimatePresence>
            {winner && !gameOver && !notification && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full rounded-2xl bg-card p-4 text-center mt-3" style={{ boxShadow: 'var(--shadow-card)' }}>
                <Trophy className="w-8 h-8 mx-auto mb-1.5 text-game-coin" />
                <h3 className="text-lg font-bold mb-0.5">
                  {winner === "X" ? "You Win This Round! 🎉" : winner === "O" ? "Computer Wins 💻" : "It's a Tie! 🤝"}
                </h3>
                <p className="text-xs text-muted-foreground">Next round starting...</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Auto-play warning */}
          {autoPlays > 0 && autoPlays < MAX_AUTO_PLAYS && (
            <div className="text-center text-xs text-game-warning mt-2">
              ⚠️ Auto-played {autoPlays}/{MAX_AUTO_PLAYS} times
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-center gap-3 pt-2 pb-1">
          <button onClick={handleBackClick} className="flex-1 py-3 rounded-xl bg-card hover:bg-muted transition-colors font-semibold text-sm flex items-center justify-center gap-2" style={{ boxShadow: 'var(--shadow-card)' }}>
            <Home className="w-4 h-4" /> Back
          </button>
          <button onClick={resetGame} className="flex-1 py-3 rounded-xl bg-card hover:bg-muted transition-colors font-semibold text-sm flex items-center justify-center gap-2" style={{ boxShadow: 'var(--shadow-card)' }}>
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>

      {/* Game Over Modal */}
      <GameOverModal
        isOpen={gameOver}
        winner={score.player >= 2 ? "player" : "computer"}
        playerScore={score.player}
        computerScore={score.computer}
        onPlayAgain={resetGame}
        onHome={onBack}
      />

      {/* Confirm Leave Dialog */}
      <ConfirmLeaveDialog
        open={showConfirmLeave}
        onOpenChange={setShowConfirmLeave}
        onConfirm={handleConfirmLeave}
        title="Leave Game?"
        description="Are you sure you want to leave? Your current game progress will be lost."
      />
    </div>
  );
}
