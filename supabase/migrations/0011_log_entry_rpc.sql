-- NOT in nutrition-tracker-schema.md — the schema doc's §5 "Resolution
-- logic" describes this math in prose/pseudocode but doesn't specify
-- whether it runs in SQL or the client. Implemented here as a single RPC
-- rather than client-side TypeScript so that:
--
--   1. The log_entry_nutrient snapshot (CLAUDE.md invariant #3 — "the
--      single most likely thing to be silently broken") always reads
--      food_nutrient / my_dish_ingredient from Postgres at the exact
--      moment of insert, never from a client's Dexie cache that could be
--      a version behind.
--   2. yield_factor resolution (invariant #6, resolve_yield() only) and
--      the nutrient snapshot happen in one transaction — no window where
--      log_entry exists without its nutrient snapshot.
--
-- RLS still applies as normal (security invoker, not definer) — this
-- function does exactly what a client-side insert would do, atomically.

create or replace function create_log_entry(
  p_consumed_at   timestamptz,
  p_consumed_date date,
  p_meal          meal_slot,
  p_ref_type      log_ref,
  p_food_id       bigint,
  p_dish_id       bigint,
  p_portion_id    bigint,
  p_quantity      real,
  p_entered_state text,
  p_entered_grams real,
  p_note          text default null
) returns bigint
language plpgsql
security invoker
as $$
declare
  v_user_id      uuid := auth.uid();
  v_yield_factor real;
  v_grams        real;
  v_entry_id     bigint;
  v_servings     real;
begin
  if v_user_id is null then
    raise exception 'create_log_entry requires an authenticated user';
  end if;

  if p_ref_type = 'food' then
    v_yield_factor := resolve_yield(p_food_id);
    v_grams := case when p_entered_state = 'cooked'
      then p_entered_grams / v_yield_factor
      else p_entered_grams
    end;
  else
    -- Dishes are already composed of raw-equivalent ingredient grams (see
    -- my_dish_ingredient.grams) — no yield conversion at logging time.
    -- grams here is the derived raw-equivalent total for display; nutrient
    -- amounts come from the per-ingredient sum below, not from this value.
    v_yield_factor := 1.0;
    select coalesce(sum(grams), 0) / coalesce(nullif(servings, 0), 1) * p_quantity
      into v_grams
      from my_dish_ingredient di
      join my_dish d on d.id = di.dish_id
      where di.dish_id = p_dish_id;
  end if;

  insert into log_entry (
    user_id, consumed_at, consumed_date, meal, ref_type, food_id, dish_id,
    portion_id, quantity, grams, entered_state, entered_grams, yield_factor, note
  ) values (
    v_user_id, p_consumed_at, p_consumed_date, p_meal, p_ref_type, p_food_id, p_dish_id,
    p_portion_id, p_quantity, v_grams, p_entered_state, p_entered_grams, v_yield_factor, p_note
  ) returning id into v_entry_id;

  if p_ref_type = 'food' then
    insert into log_entry_nutrient (entry_id, nutrient_id, amount)
    select v_entry_id, fn.nutrient_id, fn.amount * v_grams / 100
    from food_nutrient fn
    where fn.food_id = p_food_id;
  else
    select coalesce(servings, 1) into v_servings from my_dish where id = p_dish_id;

    insert into log_entry_nutrient (entry_id, nutrient_id, amount)
    select v_entry_id, fn.nutrient_id, sum(fn.amount * di.grams / 100) / v_servings * p_quantity
    from my_dish_ingredient di
    join food_nutrient fn on fn.food_id = di.food_id
    where di.dish_id = p_dish_id
    group by fn.nutrient_id;
  end if;

  return v_entry_id;
end;
$$;

-- Editing a mistyped quantity must recompute this entry's own snapshot
-- (unlike editing a my_dish recipe, which must NOT touch past entries —
-- that invariant is about my_dish, not about this entry updating itself).
-- Food/dish/portion reference is intentionally not editable here — delete
-- and re-create for that; this covers "fix the quantity/meal/note."
create or replace function update_log_entry(
  p_entry_id      bigint,
  p_meal          meal_slot,
  p_quantity      real,
  p_entered_state text,
  p_entered_grams real,
  p_note          text default null
) returns void
language plpgsql
security invoker
as $$
declare
  v_food_id      bigint;
  v_dish_id      bigint;
  v_ref_type     log_ref;
  v_yield_factor real;
  v_grams        real;
  v_servings     real;
begin
  select ref_type, food_id, dish_id into v_ref_type, v_food_id, v_dish_id
  from log_entry where id = p_entry_id;

  if not found then
    raise exception 'log_entry % not found', p_entry_id;
  end if;

  if v_ref_type = 'food' then
    v_yield_factor := resolve_yield(v_food_id);
    v_grams := case when p_entered_state = 'cooked'
      then p_entered_grams / v_yield_factor
      else p_entered_grams
    end;
  else
    v_yield_factor := 1.0;
    select coalesce(sum(di.grams), 0)
        / coalesce(nullif((select servings from my_dish where id = v_dish_id), 0), 1)
        * p_quantity
      into v_grams
      from my_dish_ingredient di
      where di.dish_id = v_dish_id;
  end if;

  update log_entry set
    meal          = p_meal,
    quantity      = p_quantity,
    grams         = v_grams,
    entered_state = p_entered_state,
    entered_grams = p_entered_grams,
    yield_factor  = v_yield_factor,
    note          = p_note
  where id = p_entry_id;

  delete from log_entry_nutrient where entry_id = p_entry_id;

  if v_ref_type = 'food' then
    insert into log_entry_nutrient (entry_id, nutrient_id, amount)
    select p_entry_id, fn.nutrient_id, fn.amount * v_grams / 100
    from food_nutrient fn
    where fn.food_id = v_food_id;
  else
    select coalesce(servings, 1) into v_servings from my_dish where id = v_dish_id;

    insert into log_entry_nutrient (entry_id, nutrient_id, amount)
    select p_entry_id, fn.nutrient_id, sum(fn.amount * di.grams / 100) / v_servings * p_quantity
    from my_dish_ingredient di
    join food_nutrient fn on fn.food_id = di.food_id
    where di.dish_id = v_dish_id
    group by fn.nutrient_id;
  end if;
end;
$$;
