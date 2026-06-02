import { motion } from "framer-motion";
import { WifiOff } from "lucide-react";

interface Props {
  variant: "opponent" | "self";
  opponentName?: string;
  seconds?: number;
  total?: number;
  onImBack?: () => void;
}

/**
 * Small floating card shown when self or opponent loses connection.
 * Non-overlapping: rendered inline in a fixed slot. Circular countdown for opponent variant.
 */
export default function DisconnectCard({ variant, opponentName, seconds = 0, total = 60, onImBack }: Props) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="w-full rounded-xl bg-card p-2.5 mb-2 flex items-center gap-2.5"
      style={{ boxShadow: "var(--shadow-card)" }}
      role="status"
      aria-live="polite"
    >
      {variant === "opponent" ? (
        <>
          <div className="relative w-11 h-11 shrink-0" aria-label={`Auto-forfeit in ${seconds}s`}>
            <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r={radius} stroke="hsl(var(--muted))" strokeWidth="3" fill="none" />
              <circle
                cx="22"
                cy="22"
                r={radius}
                stroke="hsl(var(--destructive))"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">{seconds}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold flex items-center gap-1">
              <WifiOff className="w-3 h-3 text-destructive" />
              {opponentName ?? "Opponent"} disconnected
            </p>
            <p className="text-[10px] text-muted-foreground truncate">Auto-forfeit if they don't return…</p>
          </div>
        </>
      ) : (
        <>
          <div className="w-9 h-9 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
            <WifiOff className="w-4 h-4 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">You're disconnected</p>
            <p className="text-[10px] text-muted-foreground truncate">Tap to resume before time runs out.</p>
          </div>
          <button
            onClick={onImBack}
            className="btn-game-primary px-3 py-1.5 text-xs rounded-lg shrink-0"
          >
            I'm back
          </button>
        </>
      )}
    </motion.div>
  );
}