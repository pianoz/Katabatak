CREATE TABLE IF NOT EXISTS "public"."character_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "character_id" "uuid" NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "taken_at" timestamp with time zone NOT NULL,
    "label" "text",
    CONSTRAINT "character_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "character_snapshots_character_id_fkey"
        FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."character_snapshots" OWNER TO "postgres";

ALTER TABLE "public"."character_snapshots" ENABLE ROW LEVEL SECURITY;

-- Only the character owner can read their snapshots
CREATE POLICY "character_snapshots_owner_select" ON "public"."character_snapshots"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.characters
            WHERE id = character_id AND user_id = auth.uid()
        )
    );

-- Only the character owner can commit a snapshot
CREATE POLICY "character_snapshots_owner_insert" ON "public"."character_snapshots"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.characters
            WHERE id = character_id AND user_id = auth.uid()
        )
    );
