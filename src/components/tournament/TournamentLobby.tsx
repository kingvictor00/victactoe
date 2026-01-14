import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Check, Users, Trophy, Crown, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import FloatingBackground from "@/components/ui/FloatingBackground";

interface Player {
  id: string;
  player_name: string;
  is_host: boolean;
  is_ready: boolean;
  joined_at: string;
}

interface TournamentLobbyProps {
  tournamentId: string;
  tournamentCode: string;
  isHost: boolean;
  currentPlayerId: string;
  onBack: () => void;
  onStartGame: () => void;
}

// Generate a simple avatar based on player name
function generateAvatar(name: string): { backgroundColor: string; initials: string } {
  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--secondary))',
    'hsl(340, 75%, 55%)',
    'hsl(210, 75%, 55%)',
    'hsl(150, 75%, 45%)',
    'hsl(45, 85%, 55%)',
    'hsl(280, 65%, 55%)',
    'hsl(15, 85%, 55%)',
  ];
  
  // Simple hash of name to get consistent color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colorIndex = Math.abs(hash) % colors.length;
  const initials = name.slice(0, 2).toUpperCase();
  
  return {
    backgroundColor: colors[colorIndex],
    initials,
  };
}

export default function TournamentLobby({
  tournamentId,
  tournamentCode,
  isHost,
  currentPlayerId,
  onBack,
  onStartGame,
}: TournamentLobbyProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [maxPlayers, setMaxPlayers] = useState<number>(16);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [tournamentName, setTournamentName] = useState("");
  const [copied, setCopied] = useState(false);

  // Fetch tournament details and subscribe to player changes
  useEffect(() => {
    // Fetch tournament info
    const fetchTournament = async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('name, max_players, is_unlimited')
        .eq('id', tournamentId)
        .single();
      
      if (data) {
        setTournamentName(data.name);
        setMaxPlayers(data.max_players);
        setIsUnlimited(data.is_unlimited);
      }
    };

    // Fetch current players
    const fetchPlayers = async () => {
      const { data } = await supabase
        .from('tournament_players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('joined_at', { ascending: true });
      
      if (data) {
        setPlayers(data);
      }
    };

    fetchTournament();
    fetchPlayers();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`tournament_${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_players',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          // Refetch players when any change occurs
          fetchPlayers();
        }
      )
      .subscribe();

    // Persist session to localStorage
    const sessionData = {
      tournamentId,
      tournamentCode,
      isHost,
      currentPlayerId,
      timestamp: Date.now(),
    };
    localStorage.setItem('tournament_session', JSON.stringify(sessionData));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, tournamentCode, isHost, currentPlayerId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(tournamentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canStartGame = isHost && players.length >= 2;

  return (
    <div className="min-h-screen bg-background relative">
      <FloatingBackground />
      <div className="container max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-card hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{tournamentName}</h1>
            <p className="text-sm text-muted-foreground">Tournament Lobby</p>
          </div>
        </div>

        {/* Code Display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="game-card mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Share this code</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="flex justify-center gap-2">
            {tournamentCode.split('').map((char, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="w-10 h-12 rounded-lg bg-muted flex items-center justify-center text-xl font-bold"
              >
                {char}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Player Count */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="game-card mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span className="font-medium">Players</span>
            </div>
            <div className="text-xl font-bold">
              {players.length}
              {!isUnlimited && (
                <span className="text-muted-foreground">/{maxPlayers}</span>
              )}
              {isUnlimited && (
                <span className="text-muted-foreground text-sm ml-1">∞</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Players List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="game-card mb-6"
        >
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Participants
          </h3>
          
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {players.map((player, index) => {
              const avatar = generateAvatar(player.player_name);
              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    player.id === currentPlayerId ? 'bg-primary/10 ring-1 ring-primary' : 'bg-muted'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: avatar.backgroundColor }}
                  >
                    {avatar.initials}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{player.player_name}</span>
                      {player.is_host && (
                        <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                      {player.id === currentPlayerId && (
                        <span className="text-xs text-primary">(You)</span>
                      )}
                    </div>
                  </div>
                  
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                </motion.div>
              );
            })}
            
            {players.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Waiting for players to join...
              </div>
            )}
          </div>
        </motion.div>

        {/* Start Button (Host only) */}
        {isHost && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={onStartGame}
            disabled={!canStartGame}
            className="btn-game-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trophy className="w-5 h-5" />
            {canStartGame ? 'Start Tournament' : `Need at least 2 players`}
          </motion.button>
        )}

        {!isHost && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center text-muted-foreground"
          >
            Waiting for host to start the tournament...
          </motion.div>
        )}
      </div>
    </div>
  );
}
