import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Home, Crown, Medal, Star } from "lucide-react";

interface PlayerRanking {
  id: string;
  name: string;
  position: number;
  isCurrentPlayer: boolean;
}

interface TournamentWinnerProps {
  isOpen: boolean;
  tournamentName: string;
  rankings: PlayerRanking[];
  currentPlayerId: string;
  onHome: () => void;
}

export default function TournamentWinner({
  isOpen,
  tournamentName,
  rankings,
  currentPlayerId,
  onHome,
}: TournamentWinnerProps) {
  const currentPlayerRank = rankings.find(r => r.id === currentPlayerId);
  const isWinner = currentPlayerRank?.position === 1;

  const getRankIcon = (position: number) => {
    if (position === 1) return <Crown className="w-6 h-6 text-amber-500" />;
    if (position === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (position === 3) return <Medal className="w-6 h-6 text-amber-700" />;
    return <Star className="w-5 h-5 text-muted-foreground" />;
  };

  const getRankBgClass = (position: number, isCurrentPlayer: boolean) => {
    const baseClasses = "flex items-center gap-3 p-4 rounded-xl transition-all";
    if (isCurrentPlayer) {
      return `${baseClasses} ring-2 ring-primary bg-primary/10`;
    }
    if (position === 1) return `${baseClasses} bg-gradient-to-r from-amber-500/20 to-amber-400/10`;
    if (position === 2) return `${baseClasses} bg-muted/80`;
    if (position === 3) return `${baseClasses} bg-amber-900/10`;
    return `${baseClasses} bg-muted/50`;
  };

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
            className="game-card w-full max-w-md text-center max-h-[90vh] overflow-y-auto"
          >
            {/* Animated Trophy */}
            <motion.div
              className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg"
              animate={{
                rotate: [0, -5, 5, -5, 0],
                scale: [1, 1.05, 1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Trophy className="w-12 h-12 text-white" />
            </motion.div>

            {/* Title */}
            <motion.h2
              className="text-2xl font-bold mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {isWinner ? "🎉 You Won!" : "Tournament Complete"}
            </motion.h2>

            <motion.p
              className="text-muted-foreground text-sm mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {tournamentName}
            </motion.p>

            {/* Leaderboard */}
            <motion.div
              className="space-y-2 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-sm font-semibold text-left text-muted-foreground mb-3">
                🏆 Final Rankings
              </h3>
              {rankings.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className={getRankBgClass(player.position, player.isCurrentPlayer)}
                >
                  {/* Position Badge */}
                  <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center font-bold text-lg shadow-sm">
                    {player.position <= 3 ? (
                      getRankIcon(player.position)
                    ) : (
                      <span className="text-muted-foreground">{player.position}</span>
                    )}
                  </div>

                  {/* Player Name */}
                  <div className="flex-1 text-left">
                    <span className="font-medium">{player.name}</span>
                    {player.isCurrentPlayer && (
                      <span className="text-xs text-primary ml-2">(You)</span>
                    )}
                  </div>

                  {/* Position Number */}
                  <span className="text-sm font-bold text-muted-foreground">
                    #{player.position}
                  </span>
                </motion.div>
              ))}
            </motion.div>

            {/* Home Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              onClick={onHome}
              className="btn-game-primary w-full flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Back to Home
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
