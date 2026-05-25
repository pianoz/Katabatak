-- Replace the flat world_lore table with a hierarchical world_entities model.
--
-- world_entities  — canonical world data (nations → regions → places → locations/npcs/items).
--                   Written only by the AI GM server (service_role) or dev users.
-- player_entity_mutations — per-player overrides on top of the canonical entity.
--                   Written only by the AI GM server via its tools; players never write directly.
--
-- All player-facing world changes go through GM server tools, not direct DB access.

-- ============================================================
-- 1. Tear down world_lore (policies first, then function, table, enum)
-- ============================================================
DROP POLICY IF EXISTS "authenticated_select_world_lore" ON public.world_lore;
DROP POLICY IF EXISTS "dev_insert_world_lore"           ON public.world_lore;
DROP POLICY IF EXISTS "dev_update_world_lore"           ON public.world_lore;
DROP POLICY IF EXISTS "dev_delete_world_lore"           ON public.world_lore;
DROP FUNCTION  IF EXISTS public.search_world_lore(text);
DROP TABLE     IF EXISTS public.world_lore;
DROP TYPE      IF EXISTS public.lore_type;

-- ============================================================
-- 2. New enum
-- ============================================================
CREATE TYPE public.entity_type AS ENUM (
  'nation', 'region', 'place', 'location', 'npc', 'item'
);

-- ============================================================
-- 3. world_entities — canonical world catalog
-- ============================================================
CREATE TABLE public.world_entities (
    id              VARCHAR(64)  PRIMARY KEY,  -- e.g. 'loc_karkill_flounder_inn'
    name            VARCHAR(255) NOT NULL,
    type            public.entity_type NOT NULL,

    -- Hierarchy: each entity points to its parent (inn → town → region → nation)
    parent_id       VARCHAR(64)  REFERENCES public.world_entities(id) ON DELETE SET NULL,

    -- Denormalised context for fast filtering without joins
    nation_context  VARCHAR(255),
    region_context  VARCHAR(255),
    place_context   VARCHAR(255),

    -- Flexible payload: stats, descriptions, flags, etc.
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Full-text search vector derived from name + context fields
    search_vector   tsvector GENERATED ALWAYS AS (
        to_tsvector('english',
            name || ' ' ||
            COALESCE(nation_context, '') || ' ' ||
            COALESCE(region_context,  '') || ' ' ||
            COALESCE(place_context,   '')
        )
    ) STORED,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entities_type_parent  ON public.world_entities(type, parent_id);
CREATE INDEX idx_entities_filtering    ON public.world_entities(nation_context, region_context, place_context);
CREATE INDEX idx_entities_data_gin     ON public.world_entities USING gin (data);
CREATE INDEX idx_entities_search       ON public.world_entities USING gin (search_vector);

-- ============================================================
-- 4. player_entity_mutations — per-player deltas on top of world_entities
-- ============================================================
CREATE TABLE public.player_entity_mutations (
    id               BIGSERIAL   PRIMARY KEY,
    player_id        UUID        NOT NULL,
    entity_id        VARCHAR(64) REFERENCES public.world_entities(id) ON DELETE CASCADE,

    -- Positional modifiers (e.g. dropped item on a road at 30% progress)
    travel_progress  REAL,          -- 0.0–1.0; NULL unless on a linear path
    spatial_relation VARCHAR(255),  -- e.g. "in the muddy ditch on the left side"

    -- Only the fields that differ from the base entity
    mutations        JSONB NOT NULL DEFAULT '{}'::jsonb,

    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, entity_id)
);

CREATE INDEX idx_player_mutations_lookup ON public.player_entity_mutations(player_id, entity_id);

-- ============================================================
-- 5. Row-level security
-- ============================================================
ALTER TABLE public.world_entities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_entity_mutations ENABLE ROW LEVEL SECURITY;

-- world_entities: authenticated users read; only devs write directly
-- (service_role, used by the GM server, bypasses RLS entirely)
CREATE POLICY "authenticated_select_world_entities" ON public.world_entities
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dev_insert_world_entities" ON public.world_entities
  FOR INSERT TO authenticated
  WITH CHECK (public.is_dev());

CREATE POLICY "dev_update_world_entities" ON public.world_entities
  FOR UPDATE TO authenticated
  USING (public.is_dev())
  WITH CHECK (public.is_dev());

CREATE POLICY "dev_delete_world_entities" ON public.world_entities
  FOR DELETE TO authenticated
  USING (public.is_dev());

-- player_entity_mutations: players read only their own row; only devs write directly
-- (all real mutation writes happen through GM server tools via service_role)
CREATE POLICY "player_select_own_mutations" ON public.player_entity_mutations
  FOR SELECT TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "dev_all_player_mutations" ON public.player_entity_mutations
  TO authenticated
  USING (public.is_dev())
  WITH CHECK (public.is_dev());

-- ============================================================
-- 6. Grants
-- ============================================================
GRANT SELECT           ON public.world_entities          TO anon, authenticated;
GRANT ALL              ON public.world_entities          TO service_role;

GRANT SELECT           ON public.player_entity_mutations TO authenticated;
GRANT ALL              ON public.player_entity_mutations TO service_role;
GRANT USAGE, SELECT    ON SEQUENCE public.player_entity_mutations_id_seq TO service_role;

-- ============================================================
-- 7. Search function for the AI GM
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_world_entities(
  search_query text,
  filter_type  public.entity_type DEFAULT NULL
)
RETURNS SETOF public.world_entities
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM   world_entities
  WHERE  (filter_type IS NULL OR type = filter_type)
    AND  search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', search_query)) DESC
  LIMIT  20;
$$;

REVOKE EXECUTE ON FUNCTION public.search_world_entities(text, public.entity_type) FROM anon;
GRANT  EXECUTE ON FUNCTION public.search_world_entities(text, public.entity_type) TO authenticated, service_role;
