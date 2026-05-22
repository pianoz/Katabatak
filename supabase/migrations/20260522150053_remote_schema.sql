


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."lore_type" AS ENUM (
    'nation',
    'region',
    'polis',
    'location',
    'npc',
    'item',
    'faction'
);


ALTER TYPE "public"."lore_type" OWNER TO "postgres";


CREATE TYPE "public"."offer_type" AS ENUM (
    'item',
    'denarius',
    'skill_point',
    'spell'
);


ALTER TYPE "public"."offer_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_user_is_game_member"("p_game_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM game_members
    WHERE game_id = p_game_id
      AND profile_id = auth.uid()
      AND member_status IN ('active', 'invited')
  );
$$;


ALTER FUNCTION "public"."auth_user_is_game_member"("p_game_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id, 
    new.raw_user_meta_data->>'username', -- Grabs username from the signup form
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_game_gm"("p_game_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM games
    WHERE id = p_game_id
      AND gm_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_game_gm"("p_game_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_game_member"("p_game_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_members
    WHERE game_id = p_game_id
      AND profile_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_game_member"("p_game_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_skill_edges_delta"("p_delete_ids" "uuid"[], "p_upsert_edges" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF array_length(p_delete_ids, 1) > 0 THEN
    DELETE FROM skill_edges WHERE id = ANY(p_delete_ids);
  END IF;

  IF jsonb_array_length(p_upsert_edges) > 0 THEN
    INSERT INTO skill_edges (parent_skill_id, child_skill_id)
    SELECT
      (elem->>'parent_skill_id')::uuid,
      (elem->>'child_skill_id')::uuid
    FROM jsonb_array_elements(p_upsert_edges) AS elem
    ON CONFLICT (parent_skill_id, child_skill_id) DO NOTHING;
  END IF;
END;
$$;


ALTER FUNCTION "public"."save_skill_edges_delta"("p_delete_ids" "uuid"[], "p_upsert_edges" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_world_lore"("search_query" "text") RETURNS TABLE("id" integer, "name" character varying, "category" "public"."lore_type", "short_desc" character varying, "long_desc" "text", "attributes" "jsonb", "rank" real)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        world_lore.id, 
        world_lore.name, 
        world_lore.category, 
        world_lore.short_desc, 
        world_lore.long_desc, 
        world_lore.attributes,
        ts_rank(world_lore.search_vector, websearch_to_tsquery('english', search_query)) as rank
    FROM world_lore
    WHERE world_lore.search_vector @@ websearch_to_tsquery('english', search_query)
    ORDER BY rank DESC;
END;
$$;


ALTER FUNCTION "public"."search_world_lore"("search_query" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."action_skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "cooldown" integer,
    "type" "text",
    "use" "text",
    "effect" "jsonb"
);


ALTER TABLE "public"."action_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attributes" (
    "id" bigint NOT NULL,
    "name" "text"
);


ALTER TABLE "public"."attributes" OWNER TO "postgres";


COMMENT ON TABLE "public"."attributes" IS 'all attributes that can be modified or subject to modifiers';



ALTER TABLE "public"."attributes" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."attributes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."campaign_facts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "subject_entity" "text" NOT NULL,
    "fact_summary" "text" NOT NULL,
    "visibility" "text" DEFAULT 'gm_only'::"text" NOT NULL,
    "discovered_at_tick" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaign_facts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."character_action_skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "character_id" "uuid" NOT NULL,
    "action_skill_id" "uuid" NOT NULL
);


ALTER TABLE "public"."character_action_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."character_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "character_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "summary" "text",
    "sold_objects_affected" "jsonb"
);


ALTER TABLE "public"."character_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."character_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "character_id" "uuid",
    "item_id" "uuid",
    "quantity" integer DEFAULT 1,
    "is_equipped" boolean DEFAULT false,
    "custom_notes" "text",
    "acquired_at" timestamp with time zone DEFAULT "now"(),
    "condition" smallint DEFAULT '100'::smallint
);


ALTER TABLE "public"."character_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."character_skills" (
    "character_id" "uuid" NOT NULL,
    "skill_id" "uuid" NOT NULL,
    "current_rank" integer DEFAULT 1,
    "unlocked_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."character_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."character_spells" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "spell_id" bigint,
    "character_id" "uuid"
);


ALTER TABLE "public"."character_spells" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."characters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "health_max" integer DEFAULT 10,
    "current_health" integer DEFAULT 10,
    "essence_max" integer DEFAULT 10,
    "current_essence" integer DEFAULT 10,
    "power_max" integer DEFAULT 10,
    "current_power" integer DEFAULT 10,
    "will_max" integer DEFAULT 10,
    "current_will" integer DEFAULT 10,
    "speed" integer DEFAULT 30,
    "height" integer DEFAULT 170,
    "weight_kgs" integer DEFAULT 80,
    "carrying_capacity" integer DEFAULT 60,
    "current_carry_weight" integer DEFAULT 0,
    "denarius" integer DEFAULT 5,
    "background_primary" "text",
    "background_secondary" "text",
    "physical_description" "text",
    "backstory" "text",
    "level" integer DEFAULT 1,
    "class_archetype" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "unused_skill_points" smallint DEFAULT '0'::smallint NOT NULL,
    "current_location_region" "text" DEFAULT 'Tuur-Thalen'::"text" NOT NULL,
    "current_location_polis" "text" DEFAULT 'none'::"text",
    "current_location_building" "text" DEFAULT 'none'::"text",
    "current_location_local" "text",
    "current_location_text" "text",
    "condition_text" "text" DEFAULT 'normal'::"text",
    "in_game" boolean DEFAULT false
);


ALTER TABLE "public"."characters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "level" integer DEFAULT 1,
    "health_max" integer DEFAULT 10,
    "current_health" integer DEFAULT 10,
    "essence_max" integer DEFAULT 10,
    "current_essence" integer DEFAULT 10,
    "power_max" integer DEFAULT 10,
    "current_power" integer DEFAULT 10,
    "will_max" integer DEFAULT 10,
    "current_will" integer DEFAULT 10,
    "armor_class" integer DEFAULT 0,
    "speed" integer DEFAULT 30,
    "description" "text",
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "attack_damage" integer,
    "attack_cost" integer,
    "defence" integer,
    "defence_cost" integer,
    "strong_attack" integer,
    "strong_defence" integer,
    "strong_cost" integer,
    "attribute_cost_name" "text",
    "created_by" "uuid"
);


ALTER TABLE "public"."creatures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."encounter_creatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "creature_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "level" integer,
    "attack_damage" integer,
    "attack_cost" integer,
    "defence" integer,
    "strong_attack" integer,
    "health_max" integer,
    "current_health" integer,
    "power_max" integer,
    "current_power" integer,
    "will_max" integer,
    "current_will" integer,
    "essence_max" integer,
    "current_essence" integer,
    "is_alive" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."encounter_creatures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "friend_1" "uuid" NOT NULL,
    "friend_2" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "friends_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'friend'::"text"]))),
    CONSTRAINT "no_self_friend" CHECK (("friend_1" <> "friend_2"))
);


ALTER TABLE "public"."friends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid",
    "item_id" "uuid",
    "is_available_in_shop" boolean DEFAULT true,
    "stock_quantity" integer DEFAULT '-1'::integer,
    "custom_price_override" integer,
    "discovery_status" "text" DEFAULT 'hidden'::"text"
);


ALTER TABLE "public"."game_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."game_members" (
    "game_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "character_id" "uuid",
    "role" "text" DEFAULT 'player'::"text",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_status" "text" DEFAULT 'none'::"text" NOT NULL
);


ALTER TABLE "public"."game_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gm_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "session_number" integer DEFAULT 1,
    "is_in_combat" boolean DEFAULT false,
    "current_turn_order" "uuid"[],
    "active_turn_index" integer DEFAULT 0,
    "combat_log" "text"[],
    "is_private" boolean DEFAULT true,
    "join_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "gm_profile_id" "uuid",
    "is_in_session" boolean DEFAULT false NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "starting_level" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "subtype" "text",
    "damage" "text",
    "rarity" "text",
    "short_description" "text",
    "cost_gold" integer DEFAULT 0,
    "weight" integer DEFAULT 0,
    "is_magical" boolean DEFAULT false,
    "required_skill" "uuid",
    "type" "text",
    "defence" smallint DEFAULT '0'::smallint,
    "default_condition" smallint DEFAULT '100'::smallint,
    "coefficient" smallint DEFAULT '1'::smallint,
    "modifier" smallint DEFAULT '0'::smallint,
    "die_count" smallint DEFAULT '1'::smallint,
    "cost" smallint DEFAULT '0'::smallint,
    "cost_attribute_name" "text",
    "modifier_attribute_name" "text",
    "coefficient_attribute_name" "text",
    "consumable" boolean DEFAULT false,
    "action_text" "text",
    "image_url" "text",
    "long_description" "text",
    "hidden" boolean DEFAULT false,
    "strong_damage" integer,
    "strong_defence" integer,
    "strong_cost" integer
);


ALTER TABLE "public"."items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."items"."required_skill" IS 'skill required to wield. Can be null';



COMMENT ON COLUMN "public"."items"."defence" IS 'how many points of damage this item can block';



COMMENT ON COLUMN "public"."items"."default_condition" IS 'default condition of the item from 0-100';



COMMENT ON COLUMN "public"."items"."coefficient" IS 'multiplicative modifier';



COMMENT ON COLUMN "public"."items"."modifier" IS 'additive modifier for item';



COMMENT ON COLUMN "public"."items"."die_count" IS 'die count, default 1';



COMMENT ON COLUMN "public"."items"."cost" IS 'cost to use the item or consume it';



COMMENT ON COLUMN "public"."items"."hidden" IS 'used for hidden items which function as itemless actions';



CREATE TABLE IF NOT EXISTS "public"."npcs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "title" "text",
    "faction" "text",
    "personality_profile" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "attribute_modifiers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "current_location_id" "text" DEFAULT 'none'::"text" NOT NULL,
    "disposition_to_players" integer DEFAULT 0,
    "is_alive" boolean DEFAULT true,
    "last_seen_tick" integer DEFAULT 0
);


ALTER TABLE "public"."npcs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "game_id" "uuid" NOT NULL,
    "character_id" "uuid" NOT NULL,
    "type" "public"."offer_type" NOT NULL,
    "source_id" "uuid",
    "quantity" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "condition" integer,
    "giver_inventory_id" "uuid"
);


ALTER TABLE "public"."pending_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone,
    "username" "text",
    "full_name" "text",
    "avatar_url" "text",
    "is_dev" boolean DEFAULT false,
    CONSTRAINT "username_length" CHECK (("char_length"("username") >= 3))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skill_edges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_skill_id" "uuid",
    "child_skill_id" "uuid",
    "required_rank" integer DEFAULT 1,
    "edge_type" "text" DEFAULT 'prerequisite'::"text"
);


ALTER TABLE "public"."skill_edges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "unlock_hint" "text",
    "unlock_key" "text",
    "is_passive" boolean DEFAULT true,
    "max_rank" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "skill_text" "text",
    "effects" "jsonb" DEFAULT '[]'::"jsonb",
    "min_level" smallint DEFAULT 0 NOT NULL,
    "in_development" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spells" (
    "id" bigint NOT NULL,
    "name" "text",
    "type" "text",
    "subtype" "text",
    "damage" smallint,
    "defence" smallint,
    "modifier" smallint,
    "coefficient" smallint,
    "cost" smallint,
    "cast_time_min" smallint,
    "remain_time_min" smallint,
    "aoe_m" smallint,
    "range_m" integer,
    "active" boolean,
    "cooldown_min" smallint,
    "req_item_1" "uuid",
    "req_item_2" "uuid",
    "req_item_3" "uuid",
    "req_skill_1" "uuid",
    "req_skill_2" "uuid",
    "cost_attribute_name" "text",
    "modifier_attribute_name" "text",
    "coefficient_attribute_name" "text",
    "description" "text"
);


ALTER TABLE "public"."spells" OWNER TO "postgres";


COMMENT ON TABLE "public"."spells" IS 'All spells in the game live here';



ALTER TABLE "public"."spells" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."spells_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."world_lore" (
    "id" integer NOT NULL,
    "name" character varying(150) NOT NULL,
    "category" "public"."lore_type" NOT NULL,
    "short_desc" character varying(255) NOT NULL,
    "long_desc" "text" NOT NULL,
    "attributes" "jsonb" DEFAULT '{}'::"jsonb",
    "search_vector" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"english"'::"regconfig", ((((("name")::"text" || ' '::"text") || ("short_desc")::"text") || ' '::"text") || "long_desc"))) STORED,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."world_lore" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."world_lore_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."world_lore_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."world_lore_id_seq" OWNED BY "public"."world_lore"."id";



ALTER TABLE ONLY "public"."world_lore" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."world_lore_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."action_skills"
    ADD CONSTRAINT "action_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attributes"
    ADD CONSTRAINT "attributes_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."attributes"
    ADD CONSTRAINT "attributes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_facts"
    ADD CONSTRAINT "campaign_facts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."character_action_skills"
    ADD CONSTRAINT "character_action_skills_character_id_action_skill_id_key" UNIQUE ("character_id", "action_skill_id");



ALTER TABLE ONLY "public"."character_action_skills"
    ADD CONSTRAINT "character_action_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."character_history"
    ADD CONSTRAINT "character_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."character_inventory"
    ADD CONSTRAINT "character_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."character_skills"
    ADD CONSTRAINT "character_skills_pkey" PRIMARY KEY ("character_id", "skill_id");



ALTER TABLE ONLY "public"."character_spells"
    ADD CONSTRAINT "character_spells_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."characters"
    ADD CONSTRAINT "characters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creatures"
    ADD CONSTRAINT "creatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."encounter_creatures"
    ADD CONSTRAINT "encounter_creatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friends"
    ADD CONSTRAINT "friends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friends"
    ADD CONSTRAINT "friends_unique" UNIQUE ("friend_1", "friend_2");



ALTER TABLE ONLY "public"."game_items"
    ADD CONSTRAINT "game_items_game_id_item_id_key" UNIQUE ("game_id", "item_id");



ALTER TABLE ONLY "public"."game_items"
    ADD CONSTRAINT "game_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."game_members"
    ADD CONSTRAINT "game_members_game_profile_unique" UNIQUE ("game_id", "profile_id");



ALTER TABLE ONLY "public"."game_members"
    ADD CONSTRAINT "game_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_join_code_key" UNIQUE ("join_code");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."npcs"
    ADD CONSTRAINT "npcs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_offers"
    ADD CONSTRAINT "pending_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."skill_edges"
    ADD CONSTRAINT "skill_edges_parent_child_unique" UNIQUE ("parent_skill_id", "child_skill_id");



ALTER TABLE ONLY "public"."skill_edges"
    ADD CONSTRAINT "skill_edges_parent_skill_id_child_skill_id_key" UNIQUE ("parent_skill_id", "child_skill_id");



ALTER TABLE ONLY "public"."skill_edges"
    ADD CONSTRAINT "skill_edges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."world_lore"
    ADD CONSTRAINT "world_lore_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."world_lore"
    ADD CONSTRAINT "world_lore_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_campaign_facts_game" ON "public"."campaign_facts" USING "btree" ("game_id");



CREATE INDEX "idx_creatures_level" ON "public"."creatures" USING "btree" ("level");



CREATE INDEX "idx_npcs_game_location" ON "public"."npcs" USING "btree" ("game_id", "current_location_id");



CREATE INDEX "idx_pending_offers_character" ON "public"."pending_offers" USING "btree" ("character_id");



CREATE INDEX "info_search_idx" ON "public"."world_lore" USING "gin" ("search_vector");



ALTER TABLE ONLY "public"."campaign_facts"
    ADD CONSTRAINT "campaign_facts_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."character_action_skills"
    ADD CONSTRAINT "character_action_skills_action_skill_id_fkey" FOREIGN KEY ("action_skill_id") REFERENCES "public"."action_skills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."character_action_skills"
    ADD CONSTRAINT "character_action_skills_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."character_history"
    ADD CONSTRAINT "character_history_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id");



ALTER TABLE ONLY "public"."character_inventory"
    ADD CONSTRAINT "character_inventory_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."character_inventory"
    ADD CONSTRAINT "character_inventory_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."character_skills"
    ADD CONSTRAINT "character_skills_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."character_skills"
    ADD CONSTRAINT "character_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."character_spells"
    ADD CONSTRAINT "character_spells_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."character_spells"
    ADD CONSTRAINT "character_spells_spell_id_fkey" FOREIGN KEY ("spell_id") REFERENCES "public"."spells"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."characters"
    ADD CONSTRAINT "characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."creatures"
    ADD CONSTRAINT "creatures_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."encounter_creatures"
    ADD CONSTRAINT "encounter_creatures_creature_id_fkey" FOREIGN KEY ("creature_id") REFERENCES "public"."creatures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."encounter_creatures"
    ADD CONSTRAINT "encounter_creatures_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friends"
    ADD CONSTRAINT "friends_friend_1_fkey" FOREIGN KEY ("friend_1") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friends"
    ADD CONSTRAINT "friends_friend_2_fkey" FOREIGN KEY ("friend_2") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_items"
    ADD CONSTRAINT "game_items_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_items"
    ADD CONSTRAINT "game_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_members"
    ADD CONSTRAINT "game_members_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."game_members"
    ADD CONSTRAINT "game_members_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."game_members"
    ADD CONSTRAINT "game_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_gm_id_fkey" FOREIGN KEY ("gm_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_gm_profile_id_fkey" FOREIGN KEY ("gm_profile_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_coefficient_attribute_name_fkey" FOREIGN KEY ("coefficient_attribute_name") REFERENCES "public"."attributes"("name") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_cost_attribute_name_fkey" FOREIGN KEY ("cost_attribute_name") REFERENCES "public"."attributes"("name") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_modifier_attribute_name_fkey" FOREIGN KEY ("modifier_attribute_name") REFERENCES "public"."attributes"("name") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_required_skill_fkey" FOREIGN KEY ("required_skill") REFERENCES "public"."skills"("id");



ALTER TABLE ONLY "public"."npcs"
    ADD CONSTRAINT "npcs_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_offers"
    ADD CONSTRAINT "pending_offers_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_offers"
    ADD CONSTRAINT "pending_offers_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_offers"
    ADD CONSTRAINT "pending_offers_giver_inventory_id_fkey" FOREIGN KEY ("giver_inventory_id") REFERENCES "public"."character_inventory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."skill_edges"
    ADD CONSTRAINT "skill_edges_child_skill_id_fkey" FOREIGN KEY ("child_skill_id") REFERENCES "public"."skills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."skill_edges"
    ADD CONSTRAINT "skill_edges_parent_skill_id_fkey" FOREIGN KEY ("parent_skill_id") REFERENCES "public"."skills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_coefficient_attribute_name_fkey" FOREIGN KEY ("coefficient_attribute_name") REFERENCES "public"."attributes"("name") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_cost_attribute_name_fkey" FOREIGN KEY ("cost_attribute_name") REFERENCES "public"."attributes"("name") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_modifier_attribute_name_fkey" FOREIGN KEY ("modifier_attribute_name") REFERENCES "public"."attributes"("name") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_req_item_1_fkey" FOREIGN KEY ("req_item_1") REFERENCES "public"."items"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_req_item_2_fkey" FOREIGN KEY ("req_item_2") REFERENCES "public"."items"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_req_item_3_fkey" FOREIGN KEY ("req_item_3") REFERENCES "public"."items"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_req_skill_1_fkey" FOREIGN KEY ("req_skill_1") REFERENCES "public"."skills"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_req_skill_2_fkey" FOREIGN KEY ("req_skill_2") REFERENCES "public"."skills"("id") ON UPDATE CASCADE ON DELETE SET NULL;



CREATE POLICY "Enable insert for authenticated users only" ON "public"."character_spells" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."skill_edges" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."skills" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."spells" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."attributes" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."character_spells" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."spells" FOR SELECT USING (true);



CREATE POLICY "GMs can add items to characters in their games" ON "public"."character_inventory" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."games" "g"
     JOIN "public"."game_members" "gm" ON (("g"."id" = "gm"."game_id")))
  WHERE (("g"."gm_id" = "auth"."uid"()) AND ("gm"."character_id" = "character_inventory"."character_id")))));



CREATE POLICY "GMs can create offers for games they manage" ON "public"."pending_offers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."games" "g"
  WHERE (("g"."id" = "pending_offers"."game_id") AND ("g"."gm_id" = "auth"."uid"())))));



CREATE POLICY "Items are viewable by all players" ON "public"."items" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Players see available game items" ON "public"."game_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."game_members"
  WHERE (("game_members"."game_id" = "game_items"."game_id") AND ("game_members"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Skill edges are readable by everyone" ON "public"."skill_edges" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Skill tree is readable by everyone" ON "public"."skills" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Users can insert their own characters" ON "public"."characters" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile." ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage inventory of their own characters" ON "public"."character_inventory" USING ((EXISTS ( SELECT 1
   FROM "public"."characters"
  WHERE (("characters"."id" = "character_inventory"."character_id") AND ("characters"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage skills for their own characters" ON "public"."character_skills" USING ((EXISTS ( SELECT 1
   FROM "public"."characters"
  WHERE (("characters"."id" = "character_skills"."character_id") AND ("characters"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."characters"
  WHERE (("characters"."id" = "character_skills"."character_id") AND ("characters"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can only edit their own characters" ON "public"."characters" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."action_skills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "action_skills_select" ON "public"."action_skills" FOR SELECT USING (true);



CREATE POLICY "admin Edit" ON "public"."skill_edges" TO "authenticated" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text")) WITH CHECK (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "admin delete" ON "public"."skill_edges" FOR DELETE TO "authenticated" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "admin update" ON "public"."skill_edges" FOR UPDATE TO "authenticated" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text")) WITH CHECK (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "allow auth users to edit skill tree" ON "public"."skills" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_peer_transfer_deletion" ON "public"."character_inventory" FOR DELETE TO "authenticated" USING (("id" IN ( SELECT "pending_offers"."giver_inventory_id"
   FROM "public"."pending_offers"
  WHERE (("pending_offers"."giver_inventory_id" IS NOT NULL) AND ("pending_offers"."character_id" IN ( SELECT "characters"."id"
           FROM "public"."characters"
          WHERE ("characters"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."attributes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated users can create creatures" ON "public"."creatures" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "authenticated users can view creatures" ON "public"."creatures" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."campaign_facts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "character owners can insert peer offers" ON "public"."pending_offers" FOR INSERT TO "authenticated" WITH CHECK (("game_id" IN ( SELECT "gm"."game_id"
   FROM ("public"."game_members" "gm"
     JOIN "public"."characters" "c" ON (("c"."id" = "gm"."character_id")))
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("gm"."member_status" = 'active'::"text")))));



CREATE POLICY "character owners can view their pending offers" ON "public"."pending_offers" FOR SELECT USING (("character_id" IN ( SELECT "characters"."id"
   FROM "public"."characters"
  WHERE ("characters"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."character_action_skills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "character_action_skills_delete" ON "public"."character_action_skills" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "character_action_skills"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "character_action_skills_insert" ON "public"."character_action_skills" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "character_action_skills"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "character_action_skills_select" ON "public"."character_action_skills" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "character_action_skills"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."character_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."character_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."character_skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."character_spells" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."characters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."creatures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."encounter_creatures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friends" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "friends_delete" ON "public"."friends" FOR DELETE TO "authenticated" USING ((("friend_1" = "auth"."uid"()) OR ("friend_2" = "auth"."uid"())));



CREATE POLICY "friends_insert" ON "public"."friends" FOR INSERT TO "authenticated" WITH CHECK ((("friend_1" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."friends" "existing"
  WHERE (("existing"."friend_1" = "friends"."friend_2") AND ("existing"."friend_2" = "auth"."uid"())))))));



CREATE POLICY "friends_select" ON "public"."friends" FOR SELECT TO "authenticated" USING ((("friend_1" = "auth"."uid"()) OR ("friend_2" = "auth"."uid"())));



CREATE POLICY "friends_update" ON "public"."friends" FOR UPDATE TO "authenticated" USING (("friend_2" = "auth"."uid"())) WITH CHECK (("friend_2" = "auth"."uid"()));



ALTER TABLE "public"."game_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."game_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "game_members_delete" ON "public"."game_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "game_members"."game_id") AND ("games"."gm_id" = "auth"."uid"())))));



CREATE POLICY "game_members_insert" ON "public"."game_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "game_members"."game_id") AND ("games"."gm_id" = "auth"."uid"())))));



CREATE POLICY "game_members_select" ON "public"."game_members" FOR SELECT USING ((("profile_id" = "auth"."uid"()) OR "public"."is_game_member"("game_id") OR (EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "game_members"."game_id") AND ("games"."gm_id" = "auth"."uid"()))))));



CREATE POLICY "game_members_update" ON "public"."game_members" FOR UPDATE USING ((("profile_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "game_members"."game_id") AND ("games"."gm_id" = "auth"."uid"()))))));



ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "games_delete" ON "public"."games" FOR DELETE TO "authenticated" USING ((("gm_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "games_insert" ON "public"."games" FOR INSERT TO "authenticated" WITH CHECK ((("gm_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "games_select" ON "public"."games" FOR SELECT TO "authenticated" USING (((("gm_id")::"text" = ("auth"."uid"())::"text") OR "public"."auth_user_is_game_member"("id")));



CREATE POLICY "games_update" ON "public"."games" FOR UPDATE TO "authenticated" USING ((("gm_id")::"text" = ("auth"."uid"())::"text")) WITH CHECK ((("gm_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "gm_manage_encounter_creatures" ON "public"."encounter_creatures" USING ((EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "encounter_creatures"."game_id") AND ("games"."gm_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "encounter_creatures"."game_id") AND ("games"."gm_id" = "auth"."uid"())))));



CREATE POLICY "gm_manage_members" ON "public"."game_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "game_members"."game_id") AND (("games"."gm_id")::"text" = ("auth"."uid"())::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."games"
  WHERE (("games"."id" = "game_members"."game_id") AND (("games"."gm_id")::"text" = ("auth"."uid"())::"text")))));



ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_select_game_members" ON "public"."game_members" FOR SELECT TO "authenticated" USING ("public"."auth_user_is_game_member"("game_id"));



ALTER TABLE "public"."npcs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_offers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "player_delete_own_membership" ON "public"."game_members" FOR DELETE TO "authenticated" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "player_update_own_membership" ON "public"."game_members" FOR UPDATE TO "authenticated" USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."skill_edges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spells" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users can manage their own creatures" ON "public"."creatures" TO "authenticated" USING (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."world_lore" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pending_offers";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."auth_user_is_game_member"("p_game_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_user_is_game_member"("p_game_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_user_is_game_member"("p_game_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_game_gm"("p_game_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_game_gm"("p_game_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_game_gm"("p_game_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_game_member"("p_game_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_game_member"("p_game_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_game_member"("p_game_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_skill_edges_delta"("p_delete_ids" "uuid"[], "p_upsert_edges" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_skill_edges_delta"("p_delete_ids" "uuid"[], "p_upsert_edges" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_skill_edges_delta"("p_delete_ids" "uuid"[], "p_upsert_edges" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_world_lore"("search_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_world_lore"("search_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_world_lore"("search_query" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."action_skills" TO "anon";
GRANT ALL ON TABLE "public"."action_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."action_skills" TO "service_role";



GRANT ALL ON TABLE "public"."attributes" TO "anon";
GRANT ALL ON TABLE "public"."attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."attributes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."attributes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."attributes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."attributes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_facts" TO "anon";
GRANT ALL ON TABLE "public"."campaign_facts" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_facts" TO "service_role";



GRANT ALL ON TABLE "public"."character_action_skills" TO "anon";
GRANT ALL ON TABLE "public"."character_action_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."character_action_skills" TO "service_role";



GRANT ALL ON TABLE "public"."character_history" TO "anon";
GRANT ALL ON TABLE "public"."character_history" TO "authenticated";
GRANT ALL ON TABLE "public"."character_history" TO "service_role";



GRANT ALL ON TABLE "public"."character_inventory" TO "anon";
GRANT ALL ON TABLE "public"."character_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."character_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."character_skills" TO "anon";
GRANT ALL ON TABLE "public"."character_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."character_skills" TO "service_role";



GRANT ALL ON TABLE "public"."character_spells" TO "anon";
GRANT ALL ON TABLE "public"."character_spells" TO "authenticated";
GRANT ALL ON TABLE "public"."character_spells" TO "service_role";



GRANT ALL ON TABLE "public"."characters" TO "anon";
GRANT ALL ON TABLE "public"."characters" TO "authenticated";
GRANT ALL ON TABLE "public"."characters" TO "service_role";



GRANT ALL ON TABLE "public"."creatures" TO "anon";
GRANT ALL ON TABLE "public"."creatures" TO "authenticated";
GRANT ALL ON TABLE "public"."creatures" TO "service_role";



GRANT ALL ON TABLE "public"."encounter_creatures" TO "anon";
GRANT ALL ON TABLE "public"."encounter_creatures" TO "authenticated";
GRANT ALL ON TABLE "public"."encounter_creatures" TO "service_role";



GRANT ALL ON TABLE "public"."friends" TO "anon";
GRANT ALL ON TABLE "public"."friends" TO "authenticated";
GRANT ALL ON TABLE "public"."friends" TO "service_role";



GRANT ALL ON TABLE "public"."game_items" TO "anon";
GRANT ALL ON TABLE "public"."game_items" TO "authenticated";
GRANT ALL ON TABLE "public"."game_items" TO "service_role";



GRANT ALL ON TABLE "public"."game_members" TO "anon";
GRANT ALL ON TABLE "public"."game_members" TO "authenticated";
GRANT ALL ON TABLE "public"."game_members" TO "service_role";



GRANT ALL ON TABLE "public"."games" TO "anon";
GRANT ALL ON TABLE "public"."games" TO "authenticated";
GRANT ALL ON TABLE "public"."games" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON TABLE "public"."npcs" TO "anon";
GRANT ALL ON TABLE "public"."npcs" TO "authenticated";
GRANT ALL ON TABLE "public"."npcs" TO "service_role";



GRANT ALL ON TABLE "public"."pending_offers" TO "anon";
GRANT ALL ON TABLE "public"."pending_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_offers" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."skill_edges" TO "anon";
GRANT ALL ON TABLE "public"."skill_edges" TO "authenticated";
GRANT ALL ON TABLE "public"."skill_edges" TO "service_role";



GRANT ALL ON TABLE "public"."skills" TO "anon";
GRANT ALL ON TABLE "public"."skills" TO "authenticated";
GRANT ALL ON TABLE "public"."skills" TO "service_role";



GRANT ALL ON TABLE "public"."spells" TO "anon";
GRANT ALL ON TABLE "public"."spells" TO "authenticated";
GRANT ALL ON TABLE "public"."spells" TO "service_role";



GRANT ALL ON SEQUENCE "public"."spells_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."spells_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."spells_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."world_lore" TO "anon";
GRANT ALL ON TABLE "public"."world_lore" TO "authenticated";
GRANT ALL ON TABLE "public"."world_lore" TO "service_role";



GRANT ALL ON SEQUENCE "public"."world_lore_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."world_lore_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."world_lore_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


