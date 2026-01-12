import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Gamepad2, Trophy, Zap, Hash, ArrowRight } from "lucide-react";

interface LandingPageProps {
  onPlayComputer: () => void;
}

export default function LandingPage({ onPlayComputer }: LandingPageProps) {
  const [joinCode, setJoinCode] = useState(["", "", "", "", "", ""]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...joinCode];
    newCode[index] = value.toUpperCase();
    setJoinCode(newCode);
    
    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !joinCode[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary mb-4">
            <Hash className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">TicTacToe</h1>
          <p className="text-muted-foreground">Bringing back childhood memories! 😊</p>
        </motion.div>

        {/* Feature Pills */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap justify-center gap-2 mb-8"
        >
          {["Bidding System", "Best of 3", "Tournaments"].map((feature, i) => (
            <span 
              key={feature}
              className="px-3 py-1.5 bg-muted rounded-full text-xs font-medium text-muted-foreground"
            >
              {feature}
            </span>
          ))}
        </motion.div>

        {/* Create Tournament Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="game-card mb-4"
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">Create Tournament</h2>
              <p className="text-sm text-muted-foreground">
                Host a tournament and compete with friends in a bracket-style competition
              </p>
            </div>
          </div>
          <button className="btn-game-primary w-full flex items-center justify-center gap-2">
            <Users className="w-5 h-5" />
            Create & Invite Friends
          </button>
          <p className="text-xs text-center text-muted-foreground mt-3">
            🎮 Free to play • Up to 16 players
          </p>
        </motion.div>

        {/* Join Game Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="game-card mb-4"
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">Join Game</h2>
              <p className="text-sm text-muted-foreground">
                Enter the game code to join an existing tournament
              </p>
            </div>
          </div>
          
          {/* PIN Input */}
          <div className="flex justify-center gap-2 mb-4">
            {joinCode.map((digit, index) => (
              <input
                key={index}
                id={`pin-${index}`}
                type="text"
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="pin-input"
                maxLength={1}
                placeholder="•"
              />
            ))}
          </div>
          
          <button 
            className="btn-game-secondary w-full flex items-center justify-center gap-2"
            disabled={joinCode.some(d => !d)}
          >
            Join Tournament
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>

        {/* Play vs Computer Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="game-card"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                <Gamepad2 className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <h2 className="font-bold">Play vs Computer</h2>
                <p className="text-sm text-muted-foreground">Practice your skills</p>
              </div>
            </div>
            <button 
              onClick={onPlayComputer}
              className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* Rules Summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center"
        >
          <h3 className="font-semibold mb-3">How It Works</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="game-card p-4">
              <div className="text-2xl mb-2">💰</div>
              <div className="text-xs text-muted-foreground">Start with $100</div>
            </div>
            <div className="game-card p-4">
              <div className="text-2xl mb-2">🎯</div>
              <div className="text-xs text-muted-foreground">Bid to play</div>
            </div>
            <div className="game-card p-4">
              <div className="text-2xl mb-2">🏆</div>
              <div className="text-xs text-muted-foreground">Best of 3 wins</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}