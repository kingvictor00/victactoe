-- Enable realtime for tournament_players table (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'tournament_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_players;
  END IF;
END $$;