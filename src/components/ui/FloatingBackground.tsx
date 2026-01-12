import { motion } from "framer-motion";

const symbols = ["X", "O"];

const generateFloatingItems = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    symbol: symbols[i % 2],
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 40 + 20,
    duration: Math.random() * 20 + 15,
    delay: Math.random() * 5,
    opacity: Math.random() * 0.08 + 0.03,
  }));
};

const floatingItems = generateFloatingItems(20);

export default function FloatingBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      
      {/* Floating X and O symbols */}
      {floatingItems.map((item) => (
        <motion.div
          key={item.id}
          className={`absolute font-bold select-none ${
            item.symbol === "X" ? "text-primary" : "text-secondary"
          }`}
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            fontSize: `${item.size}px`,
            opacity: item.opacity,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            rotate: [0, item.symbol === "X" ? 10 : -10, 0],
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
