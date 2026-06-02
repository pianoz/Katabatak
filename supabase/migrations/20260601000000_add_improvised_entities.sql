-- improvised_entities: character-scoped entities created by the Architect's improvisations.
-- Keeps the canonical world_entities table clean while allowing per-character narrative fabric.
-- Composite PK (character_id, id) means the same slug can exist independently per character.

CREATE TABLE "public"."improvised_entities" (
    "id"             VARCHAR(64)               NOT NULL,
    "character_id"   UUID                      NOT NULL REFERENCES "public"."characters"("id") ON DELETE CASCADE,
    "name"           VARCHAR(255)              NOT NULL,
    "type"           "public"."entity_type"    NOT NULL,
    "parent_id"      VARCHAR(64)               REFERENCES "public"."world_entities"("id") ON DELETE SET NULL,
    "nation_context" VARCHAR(255),
    "region_context" VARCHAR(255),
    "place_context"  VARCHAR(255),
    "data"           JSONB                     NOT NULL DEFAULT '{}',
    "created_at"     TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("character_id", "id")
);

CREATE INDEX "idx_improvised_entities_lookup"
    ON "public"."improvised_entities"("character_id", "parent_id");

ALTER TABLE "public"."improvised_entities" ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (filtered by character_id in application code).
-- Writes are service-role only (GM server bypasses RLS entirely).
CREATE POLICY "authenticated users can select improvised entities"
    ON "public"."improvised_entities"
    FOR SELECT
    TO "authenticated"
    USING (true);
