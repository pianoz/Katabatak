-- World NPCs migrated from world_entities (type = 'npc').
-- game_id is NULL — these are global world NPCs visible in every game when the player is at their location.
-- small_summary comes from world_entities.data.short_desc.
-- personality_profile.personality comes from world_entities.data.long_desc.

INSERT INTO public.npcs (
  id, name,
  game_id, following_character_id,
  current_location_id,
  disposition_to_players, is_alive,
  small_summary,
  personality_profile,
  attribute_modifiers
) VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    'Roadwarden Tomas',
    null, null,
    'loc_road_north',
    0, true,
    'A bored government roadwarden leaning on a halberd.',
    '{
      "personality": "Tasked with keeping the peace on the northern road, Tomas is much more interested in taking naps under the shade of the sagebrush than actually looking for bandits.",
      "home_location_id": "loc_road_north",
      "routine": null,
      "memory": { "known_facts": [], "relationship_arc": "Stranger." },
      "current_task": null
    }'::jsonb,
    '{}'::jsonb
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'Aluette',
    null, null,
    'loc_black_flounder_inn',
    50, true,
    'A kind older woman who co-runs the inn.',
    '{
      "personality": "Aluette misses nothing. She manages the books, the kitchen, and keeps the rowdier patrons in check with a mere glance.",
      "home_location_id": "loc_black_flounder_inn",
      "routine": null,
      "memory": { "known_facts": [], "relationship_arc": "Stranger." },
      "current_task": null
    }'::jsonb,
    '{}'::jsonb
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'Alberto',
    null, null,
    'loc_black_flounder_inn',
    50, true,
    'An old, retired fisherman turned innkeeper.',
    '{
      "personality": "Alberto has a thick gray beard and hands scarred by years of handling fishing line. He is quick with a laugh and generous with the ale.",
      "home_location_id": "loc_black_flounder_inn",
      "routine": null,
      "memory": { "known_facts": [], "relationship_arc": "Stranger." },
      "current_task": null
    }'::jsonb,
    '{}'::jsonb
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'Maryanne',
    null, null,
    'loc_maryannes_house',
    50, true,
    'A superstitious, elderly widow who watches the sea.',
    '{
      "personality": "Maryanne lost her husband to a sudden squall decades ago. She spends her days weaving nets and warning travelers not to wander the dunes after sunset.",
      "home_location_id": "loc_maryannes_house",
      "routine": null,
      "memory": { "known_facts": [], "relationship_arc": "Stranger." },
      "current_task": null
    }'::jsonb,
    '{}'::jsonb
  ),
  (
    'a1000000-0000-0000-0000-000000000005',
    'Silas Grevil',
    null, null,
    'loc_grevil_house',
    -50, true,
    'A gaunt, paranoid man with dark circles under his eyes.',
    '{
      "personality": "Silas rarely steps out of his tightly shuttered home. When he does, he mutters to himself about ''the geometry beneath the sand.'' He smells strongly of sulfur and unwashed clothes.",
      "home_location_id": "loc_grevil_house",
      "routine": null,
      "memory": { "known_facts": [], "relationship_arc": "Stranger." },
      "current_task": null
    }'::jsonb,
    '{}'::jsonb
  ),
  (
    'a1000000-0000-0000-0000-000000000006',
    'Mad Marlon',
    null, null,
    'loc_desert_west',
    0, true,
    'A sun-baked wanderer wrapped in tattered rags.',
    '{
      "personality": "Marlon''s skin is like leather from years in the harsh western desert. He claims to have seen the Devil''s Hand move when the moon is full.",
      "home_location_id": "loc_desert_west",
      "routine": null,
      "memory": { "known_facts": [], "relationship_arc": "Stranger." },
      "current_task": null
    }'::jsonb,
    '{}'::jsonb
  )

ON CONFLICT (id) DO NOTHING;
