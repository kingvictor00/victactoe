import { motion } from "framer-motion";

interface CoinFlipAnimationProps {
  /** Whether the coin is currently flipping */
  isFlipping: boolean;
  /** Result to show after flip (optional) */
  result?: string;
}

export default function CoinFlipAnimation({ isFlipping, result }: CoinFlipAnimationProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 via-amber-300 to-yellow-500 flex items-center justify-center text-2xl font-bold shadow-lg border-2 border-yellow-600/30"
        style={{ perspective: 600 }}
        animate={
          isFlipping
            ? {
                rotateY: [0, 360, 720, 1080, 1440],
                scale: [1, 1.15, 1, 1.15, 1],
                y: [0, -20, 0, -12, 0],
              }
            : { rotateY: 0, scale: 1, y: 0 }
        }
        transition={
          isFlipping
            ? { duration: 2, ease: "easeInOut" }
            : { duration: 0.3 }
        }
      >
        {result || "🪙"}
      </motion.div>
      {isFlipping && (
        <motion.p
          className="text-sm font-semibold text-muted-foreground"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          Flipping coin…
        </motion.p>
      )}
    </div>
  );
}
