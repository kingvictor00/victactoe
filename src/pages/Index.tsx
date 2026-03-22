import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import LandingPage, { type Difficulty } from "@/components/home/LandingPage";
import GameBoard from "@/components/game/GameBoard";
import CreateTournament from "@/components/tournament/CreateTournament";
import JoinTournament from "@/components/tournament/JoinTournament";
import TournamentLobby from "@/components/tournament/TournamentLobby";
import TournamentGame from "@/components/tournament/TournamentGame";
import { supabase } from "@/integrations/supabase/client";
import { getMatchSession, getDeviceId, clearMatchSession } from "@/hooks/usePlayerIdentity";

type GameMode = "landing" | "computer" | "create-tournament" | "join-tournament" | "tournament-lobby" | "tournament-game";

interface TournamentSession {
  tournamentId: string;
  tournamentCode: string;
  isHost: boolean;
  currentPlayerId: string;
  playerName: string;
  timestamp: number;
}

const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [gameMode, setGameMode] = useState<GameMode>("landing");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [tournamentCode, setTournamentCode] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [initialJoinCode, setInitialJoinCode] = useState<string | null>(null);

  // Handle ?join=CODE deep link
  useEffect(() => {
    const joinCode = searchParams.get("join");
    if (joinCode && joinCode.length === 6) {
      setInitialJoinCode(joinCode.toUpperCase());
      setGameMode("join-tournament");
      // Clean up the URL
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    if (initialJoinCode) return; // Don't restore session if deep-linking
    const savedSession = sessionStorage.getItem('tournament_session');
    if (savedSession) {
      try {
        const session: TournamentSession = JSON.parse(savedSession);
        if (Date.now() - session.timestamp < SESSION_EXPIRY) {
          setTournamentId(session.tournamentId);
          setTournamentCode(session.tournamentCode);
          setIsHost(session.isHost);
          setCurrentPlayerId(session.currentPlayerId);
          setGameMode("tournament-lobby");
        } else {
          sessionStorage.removeItem('tournament_session');
        }
      } catch (e) {
        sessionStorage.removeItem('tournament_session');
      }
    }

    const saveInterval = setInterval(() => {
      const currentSession = sessionStorage.getItem('tournament_session');
      if (currentSession) {
        try {
          const session: TournamentSession = JSON.parse(currentSession);
          session.timestamp = Date.now();
          sessionStorage.setItem('tournament_session', JSON.stringify(session));
        } catch (e) {}
      }
    }, 30000);

    return () => clearInterval(saveInterval);
  }, [initialJoinCode]);

  const handlePlayComputer = (selectedDifficulty: Difficulty) => {
    setDifficulty(selectedDifficulty);
    setGameMode("computer");
  };

  const handleCreateTournament = () => {
    setGameMode("create-tournament");
  };

  const handleJoinTournament = () => {
    setGameMode("join-tournament");
  };

  const handleTournamentCreated = (code: string, id: string, playerId: string) => {
    setTournamentCode(code);
    setTournamentId(id);
    setCurrentPlayerId(playerId);
    setIsHost(true);
    setGameMode("tournament-lobby");
  };

  const handleJoinedTournament = (id: string, code: string, playerId: string) => {
    setTournamentId(id);
    setTournamentCode(code);
    setCurrentPlayerId(playerId);
    setIsHost(false);
    setGameMode("tournament-lobby");
  };

  const handleLeaveLobby = () => {
    sessionStorage.removeItem('tournament_session');
    setTournamentId(null);
    setTournamentCode(null);
    setCurrentPlayerId(null);
    setIsHost(false);
    setGameMode("landing");
  };

  const handleStartGame = () => {
    setGameMode("tournament-game");
  };

  const handleLeaveTournamentGame = () => {
    sessionStorage.removeItem('tournament_session');
    setTournamentId(null);
    setTournamentCode(null);
    setCurrentPlayerId(null);
    setIsHost(false);
    setGameMode("landing");
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
            onJoinTournament={handleJoinTournament}
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

      {gameMode === "join-tournament" && (
        <motion.div
          key="join-tournament"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
        >
          <JoinTournament 
            onBack={() => { setInitialJoinCode(null); setGameMode("landing"); }} 
            onJoined={handleJoinedTournament}
            initialCode={initialJoinCode || undefined}
          />
        </motion.div>
      )}

      {gameMode === "tournament-lobby" && tournamentId && tournamentCode && currentPlayerId && (
        <motion.div
          key="tournament-lobby"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
        >
          <TournamentLobby
            tournamentId={tournamentId}
            tournamentCode={tournamentCode}
            isHost={isHost}
            currentPlayerId={currentPlayerId}
            onBack={handleLeaveLobby}
            onStartGame={handleStartGame}
          />
        </motion.div>
      )}

      {gameMode === "tournament-game" && tournamentId && currentPlayerId && (
        <motion.div
          key="tournament-game"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
        >
          <TournamentGame
            tournamentId={tournamentId}
            currentPlayerId={currentPlayerId}
            onBack={handleLeaveTournamentGame}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Index;
