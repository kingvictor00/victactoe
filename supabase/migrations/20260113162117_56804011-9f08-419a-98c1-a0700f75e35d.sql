-- Create tournaments table
CREATE TABLE public.tournaments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    host_id UUID,
    max_players INTEGER NOT NULL DEFAULT 16,
    is_unlimited BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create tournament_players table
CREATE TABLE public.tournament_players (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
    player_name TEXT NOT NULL,
    seed_position INTEGER,
    is_host BOOLEAN NOT NULL DEFAULT false,
    is_ready BOOLEAN NOT NULL DEFAULT false,
    is_eliminated BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(tournament_id, player_name)
);

-- Create index for tournament code lookups
CREATE INDEX idx_tournaments_code ON public.tournaments(code);

-- Enable RLS
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_players ENABLE ROW LEVEL SECURITY;

-- RLS policies for tournaments (public read for joining, anyone can create)
CREATE POLICY "Anyone can view tournaments" 
ON public.tournaments 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create tournaments" 
ON public.tournaments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update tournaments" 
ON public.tournaments 
FOR UPDATE 
USING (true);

-- RLS policies for tournament_players
CREATE POLICY "Anyone can view tournament players" 
ON public.tournament_players 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can join tournaments" 
ON public.tournament_players 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update tournament players" 
ON public.tournament_players 
FOR UPDATE 
USING (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_players;