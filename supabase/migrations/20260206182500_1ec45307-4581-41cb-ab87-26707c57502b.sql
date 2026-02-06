-- Add columns for Best of 3 format with bidding to tournament_matches
ALTER TABLE public.tournament_matches
ADD COLUMN IF NOT EXISTS player1_coins integer NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS player2_coins integer NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS player1_score integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS player2_score integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_round integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_bidding_phase boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS player1_bid integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS player2_bid integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bid_winner text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_bid_result jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS phase_deadline timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS match_winner text DEFAULT NULL;

-- Update RLS policy to allow these new columns to be updated
DROP POLICY IF EXISTS "Public can update matches while tournament in progress" ON public.tournament_matches;

CREATE POLICY "Public can update matches while tournament in progress"
ON public.tournament_matches
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = tournament_matches.tournament_id
    AND t.status = 'in_progress'
  )
)
WITH CHECK (
  status = ANY (ARRAY['pending'::text, 'playing'::text, 'completed'::text])
  AND board ~ '^[XO-]{9}$'
  AND current_turn = ANY (ARRAY['X'::text, 'O'::text])
  AND (winner IS NULL OR winner = ANY (ARRAY['X'::text, 'O'::text, 'tie'::text]))
  AND (match_winner IS NULL OR match_winner = ANY (ARRAY['player1'::text, 'player2'::text]))
  AND (bid_winner IS NULL OR bid_winner = ANY (ARRAY['X'::text, 'O'::text]))
  AND player1_coins >= 0 AND player1_coins <= 100
  AND player2_coins >= 0 AND player2_coins <= 100
  AND player1_score >= 0 AND player1_score <= 2
  AND player2_score >= 0 AND player2_score <= 2
  AND current_round >= 1 AND current_round <= 3
  AND EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = tournament_matches.tournament_id
    AND t.status = 'in_progress'
  )
);