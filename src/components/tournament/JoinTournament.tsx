import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Users, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import FloatingBackground from "@/components/ui/FloatingBackground";
import ConfirmLeaveDialog from "@/components/ui/ConfirmLeaveDialog";

interface JoinTournamentProps {
  onBack: () => void;
  onJoined: (tournamentId: string, tournamentCode: string, playerId: string) => void;
}

export default function JoinTournament({ onBack, onJoined }: JoinTournamentProps) {
  const [code, setCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'code' | 'name'>('code');
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [tournamentInfo, setTournamentInfo] = useState<{
    id: string;
    name: string;
    currentPlayers: number;
    maxPlayers: number;
    isUnlimited: boolean;
  } | null>(null);

  const handleCodeSubmit = async () => {
    if (code.length !== 6) {
      setError("Code must be 6 characters");
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      // Find tournament by code
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('id, name, max_players, is_unlimited, status')
        .eq('code', code.toUpperCase())
        .single();

      if (tournamentError || !tournament) {
        setError("Tournament not found. Check the code and try again.");
        setIsJoining(false);
        return;
      }

      if (tournament.status !== 'waiting') {
        setError("This tournament has already started.");
        setIsJoining(false);
        return;
      }

      // Get current player count
      const { count } = await supabase
        .from('tournament_players')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament.id);

      const currentPlayers = count || 0;

      if (!tournament.is_unlimited && currentPlayers >= tournament.max_players) {
        setError("This tournament is full.");
        setIsJoining(false);
        return;
      }

      setTournamentInfo({
        id: tournament.id,
        name: tournament.name,
        currentPlayers,
        maxPlayers: tournament.max_players,
        isUnlimited: tournament.is_unlimited,
      });
      setStep('name');
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim() || !tournamentInfo) return;

    setIsJoining(true);
    setError(null);

    try {
      // Confirm the tournament is still joinable right before inserting.
      // (Prevents edge cases where host starts while a player is on the name step.)
      const { data: latestTournament, error: latestTournamentError } = await supabase
        .from('tournaments')
        .select('status')
        .eq('id', tournamentInfo.id)
        .single();

      if (latestTournamentError || !latestTournament) {
        throw latestTournamentError ?? new Error('Tournament not found');
      }

      if (latestTournament.status !== 'waiting') {
        setError('This tournament has already started.');
        return;
      }

      // Insert player
      const { data: player, error: playerError } = await supabase
        .from('tournament_players')
        .insert({
          tournament_id: tournamentInfo.id,
          player_name: playerName.trim(),
          is_host: false,
        })
        .select()
        .single();

      if (playerError) throw playerError;

      // Save session to localStorage
      const sessionData = {
        tournamentId: tournamentInfo.id,
        tournamentCode: code.toUpperCase(),
        isHost: false,
        currentPlayerId: player.id,
        playerName: playerName.trim(),
        timestamp: Date.now(),
      };
      localStorage.setItem('tournament_session', JSON.stringify(sessionData));

      onJoined(tournamentInfo.id, code.toUpperCase(), player.id);
    } catch (err) {
      setError("Failed to join tournament. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCodeInput = (value: string) => {
    // Only allow alphanumeric, convert to uppercase
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(cleaned);
    setError(null);
  };

  const handleBackClick = () => {
    if (code.trim() || playerName.trim()) {
      setShowConfirmLeave(true);
    } else {
      if (step === 'name') {
        setStep('code');
      } else {
        onBack();
      }
    }
  };

  const handleConfirmLeave = () => {
    setShowConfirmLeave(false);
    if (step === 'name') {
      setStep('code');
    } else {
      onBack();
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <FloatingBackground />
      <div className="container max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={handleBackClick}
            className="p-2 rounded-xl bg-card hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Join Tournament</h1>
        </div>

        {step === 'code' && (
          <>
            {/* Code Input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="game-card mb-6"
            >
              <label className="block text-sm font-medium mb-3">Enter Tournament Code</label>
              
              <div className="flex justify-center gap-2 mb-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className={`w-10 h-12 rounded-lg flex items-center justify-center text-xl font-bold transition-all ${
                      code[index] ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    {code[index] || ''}
                  </div>
                ))}
              </div>
              
              <Input
                type="text"
                value={code}
                onChange={(e) => handleCodeInput(e.target.value)}
                placeholder="Enter 6-character code"
                className="bg-muted border-0 text-center text-lg tracking-widest uppercase"
                maxLength={6}
                autoFocus
              />
              
              {error && (
                <p className="text-destructive text-sm mt-3 text-center">{error}</p>
              )}
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={handleCodeSubmit}
              disabled={code.length !== 6 || isJoining}
              className="btn-game-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? (
                <span className="animate-pulse">Finding tournament...</span>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </>
        )}

        {step === 'name' && tournamentInfo && (
          <>
            {/* Tournament Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="game-card mb-6"
            >
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold">{tournamentInfo.name}</h2>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-1">
                  <Users className="w-4 h-4" />
                  <span>
                    {tournamentInfo.currentPlayers}
                    {!tournamentInfo.isUnlimited && `/${tournamentInfo.maxPlayers}`}
                    {tournamentInfo.isUnlimited && ' ∞'} players
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Name Input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="game-card mb-6"
            >
              <label className="block text-sm font-medium mb-2">Your Display Name</label>
              <Input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name..."
                className="bg-muted border-0"
                maxLength={20}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-2">
                This is how other players will see you
              </p>
              
              {error && (
                <p className="text-destructive text-sm mt-3">{error}</p>
              )}
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={handleJoin}
              disabled={!playerName.trim() || isJoining}
              className="btn-game-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? (
                <span className="animate-pulse">Joining...</span>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  Join Tournament
                </>
              )}
            </motion.button>
          </>
        )}
      </div>

      <ConfirmLeaveDialog
        open={showConfirmLeave}
        onOpenChange={setShowConfirmLeave}
        onConfirm={handleConfirmLeave}
        title="Leave?"
        description="Are you sure you want to go back? Your progress will be lost."
      />
    </div>
  );
}
