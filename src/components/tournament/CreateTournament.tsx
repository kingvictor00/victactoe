import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Check, Users, Trophy, Infinity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import FloatingBackground from "@/components/ui/FloatingBackground";

interface CreateTournamentProps {
  onBack: () => void;
  onTournamentCreated: (code: string, tournamentId: string) => void;
}

const PLAYER_OPTIONS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36];

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
  const [maxPlayers, setMaxPlayers] = useState<number | "unlimited">(16);
  const [isCreating, setIsCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!roomName.trim()) return;
    
    setIsCreating(true);
    
    try {
      const code = generateCode();
      
      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          name: roomName.trim(),
          code,
          max_players: maxPlayers === "unlimited" ? 9999 : maxPlayers,
          is_unlimited: maxPlayers === "unlimited",
          status: 'waiting'
        })
        .select()
        .single();

      if (error) throw error;

      setCreatedCode(code);
      onTournamentCreated(code, data.id);
    } catch (error) {
      console.error('Error creating tournament:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = () => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (createdCode) {
    return (
      <div className="min-h-screen bg-background relative">
        <FloatingBackground />
        <div className="container max-w-lg mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="game-card text-center"
          >
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-6">
              <Trophy className="w-8 h-8 text-primary-foreground" />
            </div>
            
            <h2 className="text-2xl font-bold mb-2">Tournament Created!</h2>
            <p className="text-muted-foreground mb-6">Share this code with your friends</p>
            
            <div className="relative mb-6">
              <div className="flex justify-center gap-2 mb-4">
                {createdCode.split('').map((char, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="w-12 h-14 rounded-xl bg-muted flex items-center justify-center text-2xl font-bold"
                  >
                    {char}
                  </motion.div>
                ))}
              </div>
              
              <button
                onClick={handleCopy}
                className="btn-game-secondary flex items-center justify-center gap-2 mx-auto"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy Code
                  </>
                )}
              </button>
            </div>
            
            <div className="text-sm text-muted-foreground mb-6">
              <p><span className="font-medium text-foreground">{roomName}</span></p>
              <p className="mt-1">
                {maxPlayers === "unlimited" ? "Unlimited players" : `Up to ${maxPlayers} players`}
              </p>
            </div>
            
            <button
              onClick={onBack}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Home
            </button>
          </motion.div>
        </div>
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
            onClick={onBack}
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
          
          <div className="grid grid-cols-5 gap-2 mb-3">
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
          
          {/* Unlimited Option */}
          <button
            onClick={() => setMaxPlayers("unlimited")}
            className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              maxPlayers === "unlimited"
                ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            <Infinity className="w-5 h-5" />
            Unlimited Players
          </button>
          
          <p className="text-xs text-muted-foreground mt-3 text-center">
            {maxPlayers === "unlimited" 
              ? "Any number of players can join until you start the tournament"
              : `Tournament will start when ${maxPlayers} players join`}
          </p>
        </motion.div>

        {/* Create Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={handleCreate}
          disabled={!roomName.trim() || isCreating}
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
    </div>
  );
}
