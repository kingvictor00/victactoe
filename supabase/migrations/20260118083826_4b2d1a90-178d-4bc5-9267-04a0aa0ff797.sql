-- Create tournament_matches table to store game state for multiplayer sync
CREATE TABLE public.tournament_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES public.tournament_players(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES public.tournament_players(id) ON DELETE CASCADE,
  board TEXT NOT NULL DEFAULT '---------',
  current_turn TEXT NOT NULL DEFAULT 'X',
  winner TEXT,
  winning_line TEXT,
  round_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- Policies for tournament matches
CREATE POLICY "Anyone can view tournament matches"
ON public.tournament_matches
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create tournament matches"
ON public.tournament_matches
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update tournament matches"
ON public.tournament_matches
FOR UPDATE
USING (true);

-- Enable realtime for tournament_matches
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches;

-- Index for faster queries
CREATE INDEX idx_tournament_matches_tournament_id ON public.tournament_matches(tournament_id);
CREATE INDEX idx_tournament_matches_players ON public.tournament_matches(player1_id, player2_id);