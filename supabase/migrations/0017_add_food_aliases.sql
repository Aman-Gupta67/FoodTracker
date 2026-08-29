-- Write path for user-approved LLM-suggested aliases, same pattern as
-- confirm_off_food/confirm_llm_food: 0005_rls_policies.sql gives
-- food_alias no insert policy for any role but service_role, so this must
-- be security definer. Aliases are only ever written here after a human
-- reviews and approves each one (the LLM never writes directly) — same
-- confirmation principle as the food-candidate write paths.

create or replace function add_food_aliases(
  p_food_id bigint,
  p_aliases text[]
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'add_food_aliases requires an authenticated user';
  end if;

  insert into food_alias (food_id, alias)
  select p_food_id, alias
  from unnest(p_aliases) as alias
  on conflict (food_id, alias) do nothing;

  update catalog_version set version = version + 1 where id = 1;
end;
$$;

grant execute on function add_food_aliases(bigint, text[]) to authenticated;
