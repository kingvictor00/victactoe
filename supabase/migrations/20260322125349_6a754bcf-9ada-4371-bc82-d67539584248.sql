
ALTER TABLE public.tournament_players
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_heartbeat timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS session_token text,
  ADD COLUMN IF NOT EXISTS device_id text;
