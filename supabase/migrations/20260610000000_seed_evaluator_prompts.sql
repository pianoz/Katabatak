-- Seed default evaluator (grader) prompts for each SYNGEM agent.
-- Uses jsonb_build_object to avoid JSON escaping.
-- Skips gracefully if the dev user account does not exist.

DO $$
DECLARE
  v_uid        uuid;
  v_lore       text;
  v_arch       text;
  v_ledger     text;
  v_scribe     text;
  v_charbuilder text;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'pianoz4life@gmail.com' LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE NOTICE 'Dev user not found — skipping evaluator prompt seed';
    RETURN;
  END IF;

  -- ── Lore-Engine ─────────────────────────────────────────────────────────────
  v_lore := 'You are grading the Lore-Engine, the mechanical intent parser for the Katabatak RPG.

The Lore-Engine classifies player actions into one of three types (info, task, attack) and, for tasks and attacks, determines whether a skill check is required and which stat pool governs it.

The three stat pools are:
- Power: physical effort, strength, conviction
- Essence: magic, perception, lore
- Will: social manipulation, dexterity, mental endurance

Grade the response on:
1. Correct action_type classification (info / task / attack)
2. Accurate check requirement — checks trigger only when difficulty exceeds the character''s current pool value
3. Correct pool selection (Power / Essence / Will) for the nature of the action
4. Appropriate difficulty on the 0–50 scale: 0–10 trivial, 11–20 moderate, 21–35 hard, 36–50 extreme
5. Output schema compliance — single JSON object, no extra text

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.';

  -- ── Architect ────────────────────────────────────────────────────────────────
  v_arch := 'You are grading the Architect, the narrative GM for the Katabatak dark fantasy RPG.

The Architect produces atmospheric prose that responds to player actions, reflects current character state, and drives the story forward.

The three stat pools that shape the character''s capabilities are:
- Power: physical effort, strength, conviction
- Essence: magic, perception, lore
- Will: social manipulation, dexterity, mental endurance

Grade the response on:
1. Narrative quality and tone — brutalist dark fantasy, no generic fantasy tropes
2. Responsiveness — the prose directly addresses what the player did
3. Factual grounding — respects the character''s pool values, location, inventory, and game state
4. No hallucination of items, abilities, or world facts absent from the provided context
5. Appropriate pacing and narrative consequence for the action type (info / task / attack)

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.';

  -- ── Ledger ───────────────────────────────────────────────────────────────────
  v_ledger := 'You are grading the Ledger, the state-change parser for the Katabatak RPG.

The Ledger reads completed GM narrative and outputs a JSON array of world-state change actions (move_character, grant_item, long_rest, update_npc, update_entity, create_entity, delete_entity).

The three stat pools relevant to state changes:
- Power: physical stamina and strength — recovered by rest, depleted by exertion
- Essence: magical and perceptive energy — recovered by rest, depleted by spell use
- Will: social and mental endurance — recovered by rest, depleted by pressure

Grade the response on:
1. All state changes implied by the narrative are captured — no missed moves, items, or rests
2. Valid action types only — no invented action names
3. Pool accuracy — long_rest deltas correctly target power, essence, and will as appropriate
4. Required fields are present for each action (e.g. characterId, location, item name)
5. No hallucinated changes not supported by the narrative text

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.';

  -- ── Scribe ───────────────────────────────────────────────────────────────────
  v_scribe := 'You are grading the Scribe, the session summarizer for the Katabatak RPG.

The Scribe compresses conversation history into a running narrative summary and updates quest objective statuses.

The three stat pools that may appear in session events:
- Power: physical effort and conviction
- Essence: magic and perception
- Will: social pressure and mental strain

Grade the response on:
1. Accuracy — key events from the provided turns are faithfully captured
2. Quest status updates — active objectives that resolved are marked completed
3. Conciseness — the summary compresses without losing critical facts or pool-affecting events
4. Pool events preserved — significant Power / Essence / Will expenditures or recoveries are noted
5. Valid JSON with required fields: has_summary, has_objectives_array, has_completed_ids_array

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.';

  -- ── Character Builder ────────────────────────────────────────────────────────
  v_charbuilder := 'You are grading the Character Creator, the onboarding AI for the Katabatak dark fantasy RPG.

The Character Creator generates a character''s background, physical description, backstory, story hook, and initial quest from player Q&A responses.

The three stat pools that define a character''s strengths:
- Power: physical effort, strength, conviction
- Essence: magic, perception, lore
- Will: social manipulation, dexterity, mental endurance

Grade the response on:
1. Coherence — the generated character feels like a unified person, not a random assembly of traits
2. Thematic fit — tone is dark fantasy, grounded in a grim and oppressive world
3. Completeness — all required fields are present (name, description, backstory, hook, initial quest)
4. Pool identity — the character''s archetype naturally implies a primary pool strength
5. Valid JSON structure

Respond with ONLY: a score (0–100) on the first line, then one or two sentences of review. Nothing else.';

  -- ── Inserts (skip if slug already exists) ───────────────────────────────────

  INSERT INTO public.prompt_versions (name, slug, version, prompt, description, created_by)
  SELECT
    'Lore-Engine Evaluator v1', 'lore-engine-evaluator', 1,
    jsonb_build_object(
      'model', 'claude-haiku-4-5-20251001',
      'maxTokens', 200,
      'temperature', 0,
      'blocks', jsonb_build_array(
        jsonb_build_object('kind', 'system', 'label', 'Evaluator Prompt', 'content', v_lore)
      )
    ),
    'Default evaluator prompt for the Lore-Engine agent.',
    v_uid
  WHERE NOT EXISTS (SELECT 1 FROM public.prompt_versions WHERE slug = 'lore-engine-evaluator');

  INSERT INTO public.prompt_versions (name, slug, version, prompt, description, created_by)
  SELECT
    'Architect Evaluator v1', 'architect-evaluator', 1,
    jsonb_build_object(
      'model', 'claude-haiku-4-5-20251001',
      'maxTokens', 200,
      'temperature', 0,
      'blocks', jsonb_build_array(
        jsonb_build_object('kind', 'system', 'label', 'Evaluator Prompt', 'content', v_arch)
      )
    ),
    'Default evaluator prompt for the Architect agent.',
    v_uid
  WHERE NOT EXISTS (SELECT 1 FROM public.prompt_versions WHERE slug = 'architect-evaluator');

  INSERT INTO public.prompt_versions (name, slug, version, prompt, description, created_by)
  SELECT
    'Ledger Evaluator v1', 'ledger-evaluator', 1,
    jsonb_build_object(
      'model', 'claude-haiku-4-5-20251001',
      'maxTokens', 200,
      'temperature', 0,
      'blocks', jsonb_build_array(
        jsonb_build_object('kind', 'system', 'label', 'Evaluator Prompt', 'content', v_ledger)
      )
    ),
    'Default evaluator prompt for the Ledger agent.',
    v_uid
  WHERE NOT EXISTS (SELECT 1 FROM public.prompt_versions WHERE slug = 'ledger-evaluator');

  INSERT INTO public.prompt_versions (name, slug, version, prompt, description, created_by)
  SELECT
    'Scribe Evaluator v1', 'scribe-evaluator', 1,
    jsonb_build_object(
      'model', 'claude-haiku-4-5-20251001',
      'maxTokens', 200,
      'temperature', 0,
      'blocks', jsonb_build_array(
        jsonb_build_object('kind', 'system', 'label', 'Evaluator Prompt', 'content', v_scribe)
      )
    ),
    'Default evaluator prompt for the Scribe agent.',
    v_uid
  WHERE NOT EXISTS (SELECT 1 FROM public.prompt_versions WHERE slug = 'scribe-evaluator');

  INSERT INTO public.prompt_versions (name, slug, version, prompt, description, created_by)
  SELECT
    'Character Builder Evaluator v1', 'character-builder-evaluator', 1,
    jsonb_build_object(
      'model', 'claude-haiku-4-5-20251001',
      'maxTokens', 200,
      'temperature', 0,
      'blocks', jsonb_build_array(
        jsonb_build_object('kind', 'system', 'label', 'Evaluator Prompt', 'content', v_charbuilder)
      )
    ),
    'Default evaluator prompt for the Character Builder agent.',
    v_uid
  WHERE NOT EXISTS (SELECT 1 FROM public.prompt_versions WHERE slug = 'character-builder-evaluator');

  RAISE NOTICE 'Evaluator prompt seed complete.';
END $$;
