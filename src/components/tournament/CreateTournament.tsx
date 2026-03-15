import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Users, Shuffle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import FloatingBackground from "@/components/ui/FloatingBackground";
import ConfirmLeaveDialog from "@/components/ui/ConfirmLeaveDialog";

interface CreateTournamentProps {
  onBack: () => void;
  onTournamentCreated: (code: string, tournamentId: string, playerId: string) => void;
}

// Powers of 2 from 2 to 256
const PLAYER_OPTIONS = [2, 4, 8, 16, 32, 64, 128, 256];

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function CreateTournament({ onBack, onTournamentCreated }: CreateTournamentProps) {
  const [roomName, setRoomName] = useState("");
  const [hostName, setHostName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState<number | "flexible">(16);
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState<'setup' | 'name'>('setup');
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);

  const handleContinueToName = () => {
    if (!roomName.trim()) return;
    setStep('name');
  };

  const handleCreate = async () => {
    if (!roomName.trim() || !hostName.trim()) return;
    
    setIsCreating(true);
    
    try {
      const code = generateCode();
      
      // Create tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          name: roomName.trim(),
          code,
          max_players: maxPlayers === "flexible" ? 9999 : maxPlayers,
          is_unlimited: maxPlayers === "flexible",
          status: 'waiting'
        })
        .select()
        .single();

      if (tournamentError) throw tournamentError;

      // Add host as first player
      const { data: player, error: playerError } = await supabase
        .from('tournament_players')
        .insert({
          tournament_id: tournament.id,
          player_name: hostName.trim(),
          is_host: true,
        })
        .select()
        .single();

      if (playerError) throw playerError;

      // Save session to sessionStorage for persistence (prevents cross-tab collisions)
      const sessionData = {
        tournamentId: tournament.id,
        tournamentCode: code,
        isHost: true,
        currentPlayerId: player.id,
        playerName: hostName.trim(),
        timestamp: Date.now(),
      };
      sessionStorage.setItem('tournament_session', JSON.stringify(sessionData));

      onTournamentCreated(code, tournament.id, player.id);
    } catch (error) {
      console.error('Error creating tournament:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleBackClick = () => {
    if (roomName.trim() || hostName.trim()) {
      setShowConfirmLeave(true);
    } else {
      if (step === 'name') {
        setStep('setup');
      } else {
        onBack();
      }
    }
  };

  const handleConfirmLeave = () => {
    setShowConfirmLeave(false);
    if (step === 'name') {
      setStep('setup');
    } else {
      onBack();
    }
  };

  if (step === 'name') {
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
            <h1 className="text-xl font-bold">Your Display Name</h1>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="game-card mb-6"
          >
            <label className="block text-sm font-medium mb-2">Enter Your Name</label>
            <Input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Your display name..."
              className="bg-muted border-0"
              maxLength={20}
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-2">
              This is how other players will see you in the tournament
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={handleCreate}
            disabled={!hostName.trim() || isCreating}
            className="btn-game-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <span className="animate-pulse">Creating...</span>
            ) : (
              <>
                <Trophy className="w-5 h-5" />
                Create Tournament
              </>
            )}
          </motion.button>
        </div>

        <ConfirmLeaveDialog
          open={showConfirmLeave}
          onOpenChange={setShowConfirmLeave}
          onConfirm={handleConfirmLeave}
          title="Leave Setup?"
          description="Are you sure you want to go back? Your tournament setup will be lost."
        />
      </div>
    );
  }

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
          <h1 className="text-xl font-bold">Create Tournament</h1>
        </div>

        {/* Room Name Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="game-card mb-6"
        >
          <label className="block text-sm font-medium mb-2">Tournament Name</label>
          <Input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Enter tournament name..."
            className="bg-muted border-0"
            maxLength={50}
          />
        </motion.div>

        {/* Player Count Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="game-card mb-6"
        >
          <label className="block text-sm font-medium mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Number of Players
          </label>
          
          <div className="grid grid-cols-4 gap-2 mb-3">
            {PLAYER_OPTIONS.map((count) => (
              <button
                key={count}
                onClick={() => setMaxPlayers(count)}
                className={`py-2.5 px-2 rounded-xl font-medium text-sm transition-all ${
                  maxPlayers === count
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
          
          {/* n/n Flexible Mode */}
          <button
            onClick={() => setMaxPlayers("flexible")}
            className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              maxPlayers === "flexible"
                ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            <Shuffle className="w-5 h-5" />
            n/256 Mode
          </button>
          
          <p className="text-xs text-muted-foreground mt-3 text-center">
            {maxPlayers === "flexible" 
              ? "Start with any number of players — BYEs are assigned automatically to balance the bracket"
              : maxPlayers === 256
                ? "Maximum supported tournament size (256 players)"
                : `Tournament will accommodate ${maxPlayers} players in bracket format`}
          </p>
        </motion.div>

        {/* Continue Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={handleContinueToName}
          disabled={!roomName.trim()}
          className="btn-game-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
          <ArrowLeft className="w-5 h-5 rotate-180" />
        </motion.button>
      </div>

      <ConfirmLeaveDialog
        open={showConfirmLeave}
        onOpenChange={setShowConfirmLeave}
        onConfirm={handleConfirmLeave}
        title="Leave Setup?"
        description="Are you sure you want to leave? Your tournament setup will be lost."
      />
    </div>
  );
}
