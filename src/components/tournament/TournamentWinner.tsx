import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Home, Crown, Medal, Star } from "lucide-react";
import { useMemo } from "react";
import RobohashAvatar from "@/components/ui/RobohashAvatar";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";

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
  // Switch to the soft leaderboard tune while this overlay is visible.
  useBackgroundMusic(isOpen ? "leaderboard" : "default");

  const floatingStars = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      symbol: i % 2 === 0 ? "✕" : "○",
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 16 + 8,
      duration: Math.random() * 25 + 20,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.15 + 0.05,
    })),
  []);

  const currentPlayerRank = rankings.find(r => r.id === currentPlayerId);
  const isWinner = currentPlayerRank?.position === 1;

  const top3 = rankings.filter(r => r.position <= 3);
  const rest = rankings.filter(r => r.position > 3);

  // Reorder top3 for podium: 2nd, 1st, 3rd
  const first = top3.find(r => r.position === 1);
  const second = top3.find(r => r.position === 2);
  const third = top3.find(r => r.position === 3);
  const podiumOrder = [second, first, third].filter(Boolean) as PlayerRanking[];

  const getPodiumHeight = (position: number) => {
    if (position === 1) return "h-28";
    if (position === 2) return "h-20";
    return "h-14";
  };

  const getPodiumBg = (position: number) => {
    if (position === 1) return "bg-gradient-to-t from-amber-500/30 to-amber-400/10";
    if (position === 2) return "bg-gradient-to-t from-muted to-muted/50";
    return "bg-gradient-to-t from-amber-900/20 to-amber-800/5";
  };

  const getAvatarRing = (position: number, isCurrent: boolean) => {
    if (isCurrent) return "ring-2 ring-primary";
    if (position === 1) return "ring-2 ring-amber-500";
    if (position === 2) return "ring-2 ring-gray-400";
    if (position === 3) return "ring-2 ring-amber-700";
    return "";
  };

  const getAvatarBg = (position: number) => {
    if (position === 1) return "bg-gradient-to-br from-amber-400 to-amber-600";
    if (position === 2) return "bg-gradient-to-br from-gray-300 to-gray-500";
    if (position === 3) return "bg-gradient-to-br from-amber-700 to-amber-900";
    return "bg-muted";
  };

  const getBadgeBg = (position: number) => {
    if (position === 1) return "bg-amber-500 text-white";
    if (position === 2) return "bg-gray-400 text-white";
    if (position === 3) return "bg-amber-700 text-white";
    return "bg-muted text-muted-foreground";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-hidden"
        >
          {/* Floating X/O star elements */}
          {floatingStars.map((star) => (
            <motion.span
              key={star.id}
              className={star.symbol === "✕" ? "text-primary" : "text-secondary"}
              style={{
                position: "absolute",
                left: `${star.x}%`,
                top: `${star.y}%`,
                fontSize: `${star.size}px`,
                opacity: star.opacity,
                pointerEvents: "none",
                willChange: "transform",
              }}
              animate={{
                y: [0, -40, 0],
                x: [0, Math.sin(star.id) * 15, 0],
                rotate: [0, star.symbol === "✕" ? 90 : -90, 0],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: star.duration,
                delay: star.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {star.symbol}
            </motion.span>
          ))}
          <motion.div
            initial={{ scale: 0.8, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 30 }}
            transition={{ type: "spring", damping: 20 }}
            className="w-full max-w-md max-h-[90vh] flex flex-col"
          >
            {/* Header with gradient background */}
            <div className="rounded-t-2xl bg-gradient-to-b from-primary/20 via-primary/10 to-card pt-6 pb-4 px-6 text-center">
              <motion.p
                className="text-muted-foreground text-xs mb-1 uppercase tracking-wider font-semibold"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {tournamentName}
              </motion.p>
              <motion.h2
                className="text-xl font-bold mb-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {isWinner ? "🎉 You Won!" : "🏆 LEADERBOARD"}
              </motion.h2>

              {/* Podium - Top 3 */}
              {podiumOrder.length > 0 && (
                <motion.div
                  className="flex items-end justify-center gap-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {podiumOrder.map((player) => (
                    <div key={player.id} className="flex flex-col items-center" style={{ width: player.position === 1 ? '35%' : '28%' }}>
                      {/* Crown for 1st */}
                      {player.position === 1 && (
                        <motion.div
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="mb-1"
                        >
                          <Crown className="w-6 h-6 text-amber-500" />
                        </motion.div>
                      )}

                      {/* Avatar */}
                      <div className="relative mb-1">
                        <div className={`${player.position === 1 ? 'w-16 h-16' : 'w-12 h-12'} rounded-full ${getAvatarRing(player.position, player.isCurrentPlayer)} flex items-center justify-center shadow-lg overflow-hidden`}>
                          <RobohashAvatar seed={player.id} size={player.position === 1 ? 64 : 48} />
                        </div>
                        {/* Position badge */}
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${getBadgeBg(player.position)} flex items-center justify-center text-[10px] font-bold shadow-sm`}>
                          {player.position}
                        </div>
                      </div>

                      {/* Name */}
                      <p className={`text-xs font-medium truncate max-w-full ${player.isCurrentPlayer ? 'text-primary' : ''}`}>
                        {player.name}
                        {player.isCurrentPlayer && <span className="text-[10px] text-primary ml-0.5">(You)</span>}
                      </p>

                      {/* Podium bar */}
                      <div className={`w-full ${getPodiumHeight(player.position)} ${getPodiumBg(player.position)} rounded-t-lg mt-1 flex items-center justify-center`}>
                        <span className="font-bold text-sm text-foreground">#{player.position}</span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Remaining players list */}
            <div className="bg-card rounded-b-2xl px-4 pb-4 flex-1 overflow-y-auto" style={{ boxShadow: 'var(--shadow-card)' }}>
              {rest.length > 0 && (
                <motion.div
                  className="divide-y divide-border"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {rest.map((player, index) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.08 }}
                      className={`flex items-center gap-3 py-3 ${player.isCurrentPlayer ? 'bg-primary/5 -mx-2 px-2 rounded-lg' : ''}`}
                    >
                      {/* Position number */}
                      <span className="text-lg font-bold text-muted-foreground w-6 text-center">
                        {player.position}
                      </span>

                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center ${player.isCurrentPlayer ? 'ring-2 ring-primary' : ''}`}>
                        <RobohashAvatar seed={player.id} size={40} />
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm truncate ${player.isCurrentPlayer ? 'text-primary' : ''}`}>
                          {player.name}
                          {player.isCurrentPlayer && <span className="text-xs text-primary ml-1">(You)</span>}
                        </p>
                      </div>

                      {/* Rank badge */}
                      <span className="text-xs font-semibold text-muted-foreground">
                        #{player.position}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Home Button */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                onClick={onHome}
                className="btn-game-primary w-full flex items-center justify-center gap-2 mt-4"
              >
                <Home className="w-5 h-5" />
                Back to Home
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
