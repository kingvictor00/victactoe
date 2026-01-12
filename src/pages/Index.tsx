import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LandingPage, { type Difficulty } from "@/components/home/LandingPage";
import GameBoard from "@/components/game/GameBoard";

type GameMode = "landing" | "computer" | "tournament";

const Index = () => {
  const [gameMode, setGameMode] = useState<GameMode>("landing");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const handlePlayComputer = (selectedDifficulty: Difficulty) => {
    setDifficulty(selectedDifficulty);
    setGameMode("computer");
  };

  return (
    <AnimatePresence mode="wait">
      {gameMode === "landing" && (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <LandingPage onPlayComputer={handlePlayComputer} />
        </motion.div>
      )}
      
      {gameMode === "computer" && (
        <motion.div
          key="game"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
        >
          <GameBoard onBack={() => setGameMode("landing")} difficulty={difficulty} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Index;