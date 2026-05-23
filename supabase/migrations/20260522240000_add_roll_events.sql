CREATE TABLE IF NOT EXISTS "public"."roll_events" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "character_id" uuid NOT NULL REFERENCES "public"."characters"("id") ON DELETE CASCADE,
    "type" text NOT NULL CHECK (type IN ('attack', 'defence', 'check')),
    "base_roll" integer NOT NULL,
    "modifier" integer NOT NULL DEFAULT 0,
    "total" integer NOT NULL,
    "context" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "rolled_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "roll_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."roll_events" ENABLE ROW LEVEL SECURITY;

-- Character owner can insert their own roll events
CREATE POLICY "Character owner can log rolls"
    ON "public"."roll_events"
    FOR INSERT
    WITH CHECK (
        character_id IN (
            SELECT id FROM "public"."characters" WHERE user_id = auth.uid()
        )
    );

-- All authenticated users can read roll history (AI GM reads this)
CREATE POLICY "Authenticated users can read roll events"
    ON "public"."roll_events"
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE INDEX "roll_events_character_id_idx" ON "public"."roll_events" ("character_id");
CREATE INDEX "roll_events_rolled_at_idx" ON "public"."roll_events" ("rolled_at" DESC);
