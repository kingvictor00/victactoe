import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Check, Users, Trophy, Crown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FloatingBackground from "@/components/ui/FloatingBackground";
import ConfirmLeaveDialog from "@/components/ui/ConfirmLeaveDialog";
import { useToast } from "@/hooks/use-toast";

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
  isHost: initialIsHost,
  currentPlayerId,
  onBack,
  onStartGame,
}: TournamentLobbyProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [maxPlayers, setMaxPlayers] = useState<number>(16);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [tournamentName, setTournamentName] = useState("");
  const [tournamentStatus, setTournamentStatus] = useState<string>("waiting");
  const [copied, setCopied] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const { toast } = useToast();

  // Determine if current player is actually the host based on player data
  const isHost = useMemo(() => {
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    return currentPlayer?.is_host ?? initialIsHost;
  }, [players, currentPlayerId, initialIsHost]);

  // Fetch tournament details and subscribe to player changes
  useEffect(() => {
    let isMounted = true;
    
    // Fetch tournament info
    const fetchTournament = async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('name, max_players, is_unlimited, status')
        .eq('id', tournamentId)
        .single();
      
      if (!isMounted) return;
      
      if (data) {
        setTournamentName(data.name);
        setMaxPlayers(data.max_players);
        setIsUnlimited(data.is_unlimited);
        setTournamentStatus(data.status);
        
        // Auto-transition to game when tournament starts
        if (data.status === 'in_progress') {
          console.log('Tournament in progress, transitioning to game...');
          onStartGame();
        }
      }
      if (error) {
        console.error('Error fetching tournament:', error);
      }
    };

    // Fetch current players
    const fetchPlayers = async () => {
      const { data, error } = await supabase
        .from('tournament_players')
        .select('id, player_name, is_host, is_ready, joined_at')
        .eq('tournament_id', tournamentId)
        .order('joined_at', { ascending: true });
      
      if (!isMounted) return;
      
      if (data) {
        setPlayers(data);
      }
      if (error) {
        console.error('Error fetching players:', error);
      }
    };

    fetchTournament();
    fetchPlayers();

    // Subscribe to real-time changes for players
    const playersChannel = supabase
      .channel(`tournament_players_${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_players',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          console.log('Player change detected:', payload);
          // Refetch players when any change occurs
          fetchPlayers();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    // Also subscribe to tournament status changes
    const tournamentChannel = supabase
      .channel(`tournament_status_${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournaments',
          filter: `id=eq.${tournamentId}`,
        },
        (payload) => {
          console.log('Tournament status change:', payload);
          if (!isMounted) return;
          
          const newStatus = (payload.new as { status: string }).status;
          setTournamentStatus(newStatus);
          
          // Immediately transition when status changes to in_progress
          if (newStatus === 'in_progress') {
            console.log('Tournament started via realtime, transitioning to game...');
            onStartGame();
          }
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
      isMounted = false;
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(tournamentChannel);
    };
  }, [tournamentId, tournamentCode, isHost, currentPlayerId, onStartGame]);

  const handleCopy = () => {
    navigator.clipboard.writeText(tournamentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackClick = () => {
    setShowConfirmLeave(true);
  };

  const handleConfirmLeave = () => {
    setShowConfirmLeave(false);
    onBack();
  };

  const handleStartTournament = async () => {
    if (!canStartGame || isStarting) return;
    
    setIsStarting(true);
    
    try {
      // Generate random seed positions for all players
      const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
      
      // Update each player with their seed position AND reset is_ready to false
      for (let i = 0; i < shuffledPlayers.length; i++) {
        const { error } = await supabase
          .from('tournament_players')
          .update({ 
            seed_position: i + 1,
            is_ready: false // Reset ready state for match ready check
          })
          .eq('id', shuffledPlayers[i].id);
        
        if (error) {
          console.error('Error updating player seed:', error);
          throw error;
        }
      }
      
      // Create matches for first round (pair players by seed position)
      for (let i = 0; i < shuffledPlayers.length; i += 2) {
        if (i + 1 < shuffledPlayers.length) {
          const { error: matchError } = await supabase
            .from('tournament_matches')
            .insert({
              tournament_id: tournamentId,
              player1_id: shuffledPlayers[i].id,
              player2_id: shuffledPlayers[i + 1].id,
              round_number: 1,
              status: 'pending',
            });
          
          if (matchError) {
            console.error('Error creating match:', matchError);
            throw matchError;
          }
        }
      }
      
      // Update tournament status to 'in_progress'
      const { error: tournamentError } = await supabase
        .from('tournaments')
        .update({ 
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', tournamentId);
      
      if (tournamentError) {
        console.error('Error starting tournament:', tournamentError);
        throw tournamentError;
      }
      
      toast({
        title: "Tournament Started! 🎮",
        description: `${players.length} players have been seeded. Let the games begin!`,
      });
      
      onStartGame();
    } catch (error) {
      console.error('Failed to start tournament:', error);
      toast({
        title: "Failed to start tournament",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const canStartGame = isHost && players.length >= 2 && tournamentStatus === 'waiting';

  return (
    <div className="min-h-screen bg-background relative">
      <FloatingBackground />
      <div className="container max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleBackClick}
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
        {isHost && tournamentStatus === 'waiting' && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={handleStartTournament}
            disabled={!canStartGame || isStarting}
            className="btn-game-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting Tournament...
              </>
            ) : (
              <>
                <Trophy className="w-5 h-5" />
                {players.length >= 2 ? 'Start Tournament' : `Need at least 2 players`}
              </>
            )}
          </motion.button>
        )}

        {isHost && tournamentStatus === 'started' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="game-card text-center"
          >
            <Trophy className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="font-medium">Tournament Started!</p>
            <p className="text-sm text-muted-foreground">Matches are being prepared...</p>
          </motion.div>
        )}

        {!isHost && tournamentStatus === 'waiting' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center text-muted-foreground"
          >
            Waiting for host to start the tournament...
          </motion.div>
        )}

        {!isHost && tournamentStatus === 'started' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="game-card text-center"
          >
            <Trophy className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="font-medium">Tournament Started!</p>
            <p className="text-sm text-muted-foreground">Get ready for your match...</p>
          </motion.div>
        )}
      </div>

      <ConfirmLeaveDialog
        open={showConfirmLeave}
        onOpenChange={setShowConfirmLeave}
        onConfirm={handleConfirmLeave}
        title="Leave Tournament?"
        description="Are you sure you want to leave? You will be removed from this tournament lobby."
      />
    </div>
  );
}
