import { motion } from "framer-motion";

const symbols = ["X", "O", "✕", "○", "△", "□", "◇", "★"];

const COLOR_CLASSES = [
  "text-primary",
  "text-secondary",
  "text-accent",
  "text-game-success",
  "text-game-warning",
  "text-game-coin",
];

const generateFloatingItems = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    symbol: symbols[i % symbols.length],
    colorClass: COLOR_CLASSES[i % COLOR_CLASSES.length],
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 48 + 24,
    duration: Math.random() * 20 + 15,
    delay: Math.random() * 5,
    opacity: Math.random() * 0.18 + 0.08,
  }));
};

const floatingItems = generateFloatingItems(28);

// Colorful gradient blobs that gently drift to add vibrancy.
const blobs = [
  { className: "bg-primary/30", x: "-10%", y: "-10%", size: 420, duration: 24 },
  { className: "bg-secondary/30", x: "75%", y: "-15%", size: 360, duration: 28 },
  { className: "bg-accent/30", x: "-15%", y: "65%", size: 400, duration: 30 },
  { className: "bg-game-success/25", x: "70%", y: "70%", size: 380, duration: 26 },
  { className: "bg-game-warning/25", x: "30%", y: "40%", size: 300, duration: 32 },
];

export default function FloatingBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Base gradient wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-secondary/10" />

      {/* Colorful drifting blobs */}
      {blobs.map((blob, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-3xl ${blob.className}`}
          style={{
            left: blob.x,
            top: blob.y,
            width: blob.size,
            height: blob.size,
          }}
          animate={{
            x: [0, 40, -30, 0],
            y: [0, -30, 40, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: blob.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Floating colorful symbols */}
      {floatingItems.map((item) => (
        <motion.div
          key={item.id}
          className={`absolute font-bold select-none ${item.colorClass}`}
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            fontSize: `${item.size}px`,
            opacity: item.opacity,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            rotate: [0, item.id % 2 === 0 ? 15 : -15, 0],
          }}
          transition={{
            duration: item.duration,
            delay: item.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {item.symbol}
        </motion.div>
      ))}
    </div>
  );
}
