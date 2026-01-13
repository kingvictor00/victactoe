import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LandingPage, { type Difficulty } from "@/components/home/LandingPage";
import GameBoard from "@/components/game/GameBoard";
import CreateTournament from "@/components/tournament/CreateTournament";

type GameMode = "landing" | "computer" | "create-tournament" | "tournament-lobby";

const Index = () => {
  const [gameMode, setGameMode] = useState<GameMode>("landing");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [tournamentCode, setTournamentCode] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState<string | null>(null);

  const handlePlayComputer = (selectedDifficulty: Difficulty) => {
    setDifficulty(selectedDifficulty);
    setGameMode("computer");
  };

  const handleCreateTournament = () => {
    setGameMode("create-tournament");
  };

  const handleTournamentCreated = (code: string, id: string) => {
    setTournamentCode(code);
    setTournamentId(id);
    // For now, stay on the created screen - lobby will be next step
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
          <LandingPage 
            onPlayComputer={handlePlayComputer} 
            onCreateTournament={handleCreateTournament}
          />
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

      {gameMode === "create-tournament" && (
        <motion.div
          key="create-tournament"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
        >
          <CreateTournament 
            onBack={() => setGameMode("landing")} 
            onTournamentCreated={handleTournamentCreated}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Index;