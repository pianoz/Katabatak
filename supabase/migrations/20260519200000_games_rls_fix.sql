-- Fix games SELECT policy: users should only see games they own or are members of.
-- Fix games DELETE policy: gm_id is text, auth.uid() is uuid — cast to avoid silent type mismatch.

drop policy if exists "games_select" on "public"."games";
drop policy if exists "games_delete" on "public"."games";

create policy "games_select"
  on "public"."games"
  for select
  to authenticated
  using (
    gm_id = auth.uid()
    or id in (
      select game_id from game_members
      where profile_id = auth.uid()
      and member_status in ('active', 'invited')
    )
  );

create policy "games_delete"
  on "public"."games"
  for delete
  to authenticated
  using (gm_id = auth.uid());
