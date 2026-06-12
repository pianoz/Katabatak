-- Add buffer_count to npcs to support the NPC knowledge hydration tier (Ticket 6).
-- Counts down from 5 each turn; knowledge is injected into GM context only while > 0.
-- Reset to 5 by the lore engine whenever a player directly addresses an NPC in conversation.
-- Zeroed on character location change to evict knowledge immediately on scene transition.

ALTER TABLE public.npcs
  ADD COLUMN IF NOT EXISTS buffer_count INT NOT NULL DEFAULT 0;
