-- Write path for LLM-decomposed natural-language-logging candidates,
-- mirroring 0013_confirm_off_food.sql's pattern (security definer, since
-- 0005_rls_policies.sql gives food/food_nutrient no insert policy for any
-- role but service_role; search_path pinned against the standard
-- security-definer hijack; auth.uid() gate).
--
-- Unlike OFF (keyed by a real barcode), an LLM-estimated food has no
-- natural stable external key, so source_ref is a deterministic slug of
-- the name — confirming "the same" LLM food again updates in place via
-- the (source, source_ref) upsert instead of accumulating duplicate rows.

create or replace function confirm_llm_food(
  p_name          text,
  p_food_group    text,
  p_state         food_state,
  p_fetch_payload jsonb,
  p_nutrients     jsonb  -- [{"key": "energy", "amount": 250}, ...]
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_food_id    bigint;
  v_source_ref text;
begin
  if auth.uid() is null then
    raise exception 'confirm_llm_food requires an authenticated user';
  end if;

  v_source_ref := lower(regexp_replace(trim(p_name), '\s+', '_', 'g'));

  insert into food (
    source, source_ref, name, source_name, food_group, state,
    fetched_via, fetch_confidence, fetch_payload, confirmed_at, energy_source
  ) values (
    'llm', v_source_ref, p_name, p_name, p_food_group, p_state,
    'llm', 'estimated', p_fetch_payload, now(), 'measured'
  )
  on conflict (source, source_ref) do update set
    name          = excluded.name,
    food_group    = excluded.food_group,
    state         = excluded.state,
    fetch_payload = excluded.fetch_payload,
    confirmed_at  = now()
  returning id into v_food_id;

  insert into food_nutrient (food_id, nutrient_id, amount)
  select v_food_id, n.id, x.amount
  from jsonb_to_recordset(p_nutrients) as x(key text, amount real)
  join nutrient n on n.key = x.key
  on conflict (food_id, nutrient_id) do update set amount = excluded.amount;

  update catalog_version set version = version + 1 where id = 1;

  return v_food_id;
end;
$$;

grant execute on function confirm_llm_food(text, text, food_state, jsonb, jsonb) to authenticated;
