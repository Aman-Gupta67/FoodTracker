-- Write path for barcode-scanned Open Food Facts products into the catalog.
-- nutrition-tracker-schema.md §3.3/§3.4 already specifies the OFF import
-- contract (macros only, OFF > * for barcoded packaged goods); this is the
-- runtime equivalent of that seed-time contract, gated behind user
-- confirmation (FoodCandidate.needsConfirmation) instead of a bulk import.
--
-- Unlike create_log_entry (security invoker, relies on RLS), this must be
-- security definer: 0005_rls_policies.sql deliberately gives food/food_nutrient
-- no insert/update/delete policy for any role but service_role, so a plain
-- authenticated insert would be rejected by RLS. search_path is pinned to
-- guard against the standard security-definer search-path hijack, and the
-- auth.uid() check keeps this from being callable by a signed-out session
-- even though it bypasses RLS.

create or replace function confirm_off_food(
  p_barcode          text,
  p_name             text,
  p_source_name      text,
  p_food_group       text,
  p_fetch_confidence text,   -- 'label' | 'estimated'
  p_fetch_payload    jsonb,
  p_nutrients        jsonb   -- [{"key": "energy", "amount": 454}, ...]
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_food_id bigint;
begin
  if auth.uid() is null then
    raise exception 'confirm_off_food requires an authenticated user';
  end if;

  insert into food (
    source, source_ref, name, source_name, food_group, state,
    barcode, fetched_via, fetch_confidence, fetch_payload, confirmed_at, energy_source
  ) values (
    'off', p_barcode, p_name, p_source_name, p_food_group, 'packaged',
    p_barcode, 'off_api', p_fetch_confidence, p_fetch_payload, now(), 'measured'
  )
  on conflict (source, source_ref) do update set
    name             = excluded.name,
    source_name      = excluded.source_name,
    food_group       = excluded.food_group,
    fetch_confidence = excluded.fetch_confidence,
    fetch_payload    = excluded.fetch_payload,
    confirmed_at      = now()
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

grant execute on function confirm_off_food(text, text, text, text, text, jsonb, jsonb) to authenticated;
