-- Add ON DELETE CASCADE to all game_id FKs that reference games(id).
-- This lets a game row be deleted without violating referential integrity.
-- Character records in the characters table are NOT affected — game_members
-- only holds the link; dropping the link leaves the character intact.

-- game_members
ALTER TABLE public.game_members DROP CONSTRAINT IF EXISTS game_members_game_id_fkey;
ALTER TABLE public.game_members
  ADD CONSTRAINT game_members_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;

-- campaign_facts
ALTER TABLE public.campaign_facts DROP CONSTRAINT IF EXISTS campaign_facts_game_id_fkey;
ALTER TABLE public.campaign_facts
  ADD CONSTRAINT campaign_facts_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;

-- game_items
ALTER TABLE public.game_items DROP CONSTRAINT IF EXISTS game_items_game_id_fkey;
ALTER TABLE public.game_items
  ADD CONSTRAINT game_items_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;

-- npcs
ALTER TABLE public.npcs DROP CONSTRAINT IF EXISTS npcs_game_id_fkey;
ALTER TABLE public.npcs
  ADD CONSTRAINT npcs_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;

-- pending_offers
ALTER TABLE public.pending_offers DROP CONSTRAINT IF EXISTS pending_offers_game_id_fkey;
ALTER TABLE public.pending_offers
  ADD CONSTRAINT pending_offers_game_id_fkey
    FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;
