-- action_skills: catalog of activatable skills
create table public.action_skills (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  cooldown  integer,
  type      text,
  use       text,
  effect    jsonb
);

-- character_action_skills: many:many junction between characters and action_skills
create table public.character_action_skills (
  id               uuid primary key default gen_random_uuid(),
  character_id     uuid not null references public.characters(id) on delete cascade,
  action_skill_id  uuid not null references public.action_skills(id) on delete cascade,
  unique (character_id, action_skill_id)
);

alter table public.action_skills enable row level security;
alter table public.character_action_skills enable row level security;

-- action_skills: readable by all authenticated users
create policy "action_skills_select" on public.action_skills
  for select using (true);

-- character_action_skills: readable/writable only by the character's owner
create policy "character_action_skills_select" on public.character_action_skills
  for select using (
    exists (
      select 1 from public.characters c
      where c.id = character_action_skills.character_id
        and c.user_id = auth.uid()
    )
  );

create policy "character_action_skills_insert" on public.character_action_skills
  for insert with check (
    exists (
      select 1 from public.characters c
      where c.id = character_action_skills.character_id
        and c.user_id = auth.uid()
    )
  );

create policy "character_action_skills_delete" on public.character_action_skills
  for delete using (
    exists (
      select 1 from public.characters c
      where c.id = character_action_skills.character_id
        and c.user_id = auth.uid()
    )
  );
