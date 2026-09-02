-- Logging N AI-parsed items one at a time (N confirm_llm_food calls + N
-- create_log_entry calls, each its own round trip) is what made "Log this"
-- on a 10-ingredient meal take ~1 minute. Both are replaced by a single
-- round trip apiece — confirm_llm_foods_bulk and create_log_entries_bulk
-- below — each doing the same per-item work as its singular predecessor,
-- looped in one transaction, so a partial failure now means NOTHING was
-- written (transaction rollback) rather than a half-logged meal that needs
-- careful retry bookkeeping.
--
-- ai_meal_group also gives the Home screen a way to show everything logged
-- from one "Describe what you ate" action as a single collapsible row
-- instead of N separate entries — every log_entry created by
-- create_log_entries_bulk shares one ai_group_id.

create table ai_meal_group (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  description text not null,
  created_at  timestamptz not null default now()
);

alter table ai_meal_group enable row level security;
create policy "ai_meal_group select" on ai_meal_group for select
  to authenticated using (user_id = auth.uid());
create policy "ai_meal_group insert" on ai_meal_group for insert
  to authenticated with check (user_id = auth.uid());
create policy "ai_meal_group delete" on ai_meal_group for delete
  to authenticated using (user_id = auth.uid());

alter table log_entry add column ai_group_id uuid references ai_meal_group(id);
create index log_entry_ai_group_idx on log_entry (ai_group_id) where ai_group_id is not null;

-- Bulk version of confirm_llm_food (0016) — same per-item upsert logic
-- (on conflict (source, source_ref), idempotent to call again), looped
-- instead of called N times. p_items: [{"idx":0,"name":...,"foodGroup":...,
-- "state":...,"fetchPayload":...,"nutrients":[{"key":...,"amount":...}]}].
-- idx is caller-assigned and echoed back rather than relying on any
-- ordering guarantee from jsonb_to_recordset.
create or replace function confirm_llm_foods_bulk(
  p_items jsonb
) returns table(idx int, food_id bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
-- The `food_id` OUT parameter (from returns table) otherwise shadows the
-- food_nutrient.food_id column inside `on conflict (food_id, ...)` below,
-- which Postgres refuses to disambiguate on its own ("column reference
-- food_id is ambiguous") — this pragma tells plpgsql to prefer the table
-- column over the same-named variable wherever both are visible.
#variable_conflict use_column
declare
  v_item       record;
  v_food_id    bigint;
  v_source_ref text;
begin
  if auth.uid() is null then
    raise exception 'confirm_llm_foods_bulk requires an authenticated user';
  end if;

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(
      idx int, name text, food_group text, state food_state,
      fetch_payload jsonb, nutrients jsonb
    )
  loop
    v_source_ref := lower(regexp_replace(trim(v_item.name), '\s+', '_', 'g'));

    insert into food (
      source, source_ref, name, source_name, food_group, state,
      fetched_via, fetch_confidence, fetch_payload, confirmed_at, energy_source
    ) values (
      'llm', v_source_ref, v_item.name, v_item.name, v_item.food_group, v_item.state,
      'llm', 'estimated', v_item.fetch_payload, now(), 'measured'
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
    from jsonb_to_recordset(v_item.nutrients) as x(key text, amount real)
    join nutrient n on n.key = x.key
    on conflict (food_id, nutrient_id) do update set amount = excluded.amount;

    idx := v_item.idx;
    food_id := v_food_id;
    return next;
  end loop;

  update catalog_version set version = version + 1 where id = 1;
end;
$$;

grant execute on function confirm_llm_foods_bulk(jsonb) to authenticated;

-- Bulk version of create_log_entry (0011/0012)'s food branch only — the AI
-- flow never logs dishes this way, so the dish branch isn't replicated
-- here. Same yield resolution + nutrient-snapshot logic per item, looped.
-- p_entries: [{"idx":0,"foodId":1,"portionId":null,"quantity":40,
-- "enteredState":"raw","enteredGrams":40,"consumedAt":"...",
-- "consumedDate":"...","meal":"dinner","note":null}, ...].
-- p_description, when given, creates one ai_meal_group row and stamps its
-- id onto every entry created in this call.
create or replace function create_log_entries_bulk(
  p_entries     jsonb,
  p_description text default null
) returns table(idx int, entry_id bigint)
language plpgsql
security invoker
as $$
-- Same reasoning as confirm_llm_foods_bulk above — the `entry_id` OUT
-- parameter would otherwise shadow log_entry_nutrient.entry_id anywhere
-- both are visible in the same statement.
#variable_conflict use_column
declare
  v_user_id      uuid := auth.uid();
  v_group_id     uuid;
  v_item         record;
  v_yield_factor real;
  v_grams        real;
  v_entry_id     bigint;
begin
  if v_user_id is null then
    raise exception 'create_log_entries_bulk requires an authenticated user';
  end if;

  if p_description is not null then
    insert into ai_meal_group (user_id, description)
    values (v_user_id, p_description)
    returning id into v_group_id;
  end if;

  for v_item in
    select * from jsonb_to_recordset(p_entries) as x(
      idx int, food_id bigint, portion_id bigint, quantity real,
      entered_state text, entered_grams real, consumed_at timestamptz,
      consumed_date date, meal meal_slot, note text
    )
  loop
    v_yield_factor := resolve_yield(v_item.food_id);
    v_grams := case when v_item.entered_state = 'cooked'
      then v_item.entered_grams / v_yield_factor
      else v_item.entered_grams
    end;

    insert into log_entry (
      user_id, consumed_at, consumed_date, meal, ref_type, food_id, dish_id,
      portion_id, quantity, grams, entered_state, entered_grams, yield_factor,
      note, ai_group_id
    ) values (
      v_user_id, v_item.consumed_at, v_item.consumed_date, v_item.meal, 'food',
      v_item.food_id, null, v_item.portion_id, v_item.quantity, v_grams,
      v_item.entered_state, v_item.entered_grams, v_yield_factor, v_item.note,
      v_group_id
    ) returning id into v_entry_id;

    insert into log_entry_nutrient (entry_id, nutrient_id, amount)
    select v_entry_id, fn.nutrient_id, fn.amount * v_grams / 100
    from food_nutrient fn
    where fn.food_id = v_item.food_id;

    idx := v_item.idx;
    entry_id := v_entry_id;
    return next;
  end loop;
end;
$$;

grant execute on function create_log_entries_bulk(jsonb, text) to authenticated;
