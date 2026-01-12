import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Home, RotateCcw, Medal } from "lucide-react";

interface GameOverModalProps {
  isOpen: boolean;
  winner: "player" | "computer";
  playerScore: number;
  computerScore: number;
  onPlayAgain: () => void;
  onHome: () => void;
}

export default function GameOverModal({ 
  isOpen, 
  winner, 
  playerScore, 
  computerScore, 
  onPlayAgain, 
  onHome 
}: GameOverModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-foreground/30 backdrop-blur-md flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.8, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 30 }}
            transition={{ type: "spring", damping: 20 }}
            className="game-card w-full max-w-sm text-center"
          >
            {/* Trophy Icon */}
            <motion.div 
              className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center"
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {winner === "player" ? (
                <Trophy className="w-10 h-10 text-foreground" />
              ) : (
                <Medal className="w-10 h-10 text-foreground" />
              )}
            </motion.div>
            
            <motion.h2 
              className="text-3xl font-bold mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {winner === "player" ? "Victory! 🎉" : "Game Over"}
            </motion.h2>
            
            <p className="text-muted-foreground mb-6">
              {winner === "player" 
                ? "Congratulations! You won the match!" 
                : "The computer won this time. Try again!"}
            </p>

            {/* Final Score */}
            <div className="flex justify-center items-center gap-6 mb-8">
              <div className="text-center">
                <div className={`text-4xl font-bold ${winner === "player" ? "text-game-x" : "text-muted-foreground"}`}>
                  {playerScore}
                </div>
                <div className="text-sm text-muted-foreground">You</div>
              </div>
              <div className="text-2xl text-muted-foreground">-</div>
              <div className="text-center">
                <div className={`text-4xl font-bold ${winner === "computer" ? "text-game-o" : "text-muted-foreground"}`}>
                  {computerScore}
                </div>
                <div className="text-sm text-muted-foreground">Computer</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onHome}
                className="flex-1 py-3 px-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Home className="w-5 h-5" />
                Home
              </button>
              <button
                onClick={onPlayAgain}
                className="flex-1 btn-game-primary flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Play Again
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}