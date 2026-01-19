-- Tighten overly-permissive RLS policies (remove `true` checks)

-- tournaments
DROP POLICY IF EXISTS "Anyone can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Anyone can update tournaments" ON public.tournaments;

CREATE POLICY "Public can create tournaments"
ON public.tournaments
FOR INSERT
WITH CHECK (
  code IS NOT NULL
  AND length(code) = 6
  AND name IS NOT NULL
  AND length(name) > 0
  AND max_players >= 2
);

CREATE POLICY "Public can update tournaments until completed"
ON public.tournaments
FOR UPDATE
USING (status <> 'completed')
WITH CHECK (
  status IN ('waiting', 'in_progress', 'completed')
);

-- tournament_players
DROP POLICY IF EXISTS "Anyone can join tournaments" ON public.tournament_players;
DROP POLICY IF EXISTS "Anyone can update tournament players" ON public.tournament_players;

CREATE POLICY "Public can join waiting tournaments"
ON public.tournament_players
FOR INSERT
WITH CHECK (
  player_name IS NOT NULL
  AND length(player_name) > 0
  AND EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = tournament_id
      AND t.status = 'waiting'
  )
);

CREATE POLICY "Players can be updated while tournament active"
ON public.tournament_players
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = tournament_id
      AND t.status IN ('waiting', 'in_progress')
  )
)
WITH CHECK (
  player_name IS NOT NULL
  AND length(player_name) > 0
  AND EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = tournament_id
      AND t.status IN ('waiting', 'in_progress')
  )
);

-- tournament_matches
DROP POLICY IF EXISTS "Anyone can create tournament matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Anyone can update tournament matches" ON public.tournament_matches;

CREATE POLICY "Public can create matches for active tournaments"
ON public.tournament_matches
FOR INSERT
WITH CHECK (
  player1_id IS NOT NULL
  AND player2_id IS NOT NULL
  AND player1_id <> player2_id
  AND round_number >= 1
  AND status IN ('pending', 'playing', 'completed')
  AND board ~ '^[XO-]{9}$'
  AND current_turn IN ('X', 'O')
  AND EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = tournament_id
      AND t.status IN ('waiting', 'in_progress')
  )
);

CREATE POLICY "Public can update matches while tournament in progress"
ON public.tournament_matches
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = tournament_id
      AND t.status = 'in_progress'
  )
)
WITH CHECK (
  status IN ('pending', 'playing', 'completed')
  AND board ~ '^[XO-]{9}$'
  AND current_turn IN ('X', 'O')
  AND (winner IS NULL OR winner IN ('X', 'O', 'tie'))
  AND EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = tournament_id
      AND t.status = 'in_progress'
  )
);
