-- Fixes a real bug in create_log_entry's dish branch, caught live:
--   ERROR: column "d.servings" must appear in the GROUP BY clause or be
--   used in an aggregate function
--
-- sum(grams) made the query an implicit aggregate; every other selected
-- column (servings, from the joined my_dish row) then had to be either
-- grouped or wrapped in an aggregate too. Since servings is constant across
-- the joined my_dish_ingredient rows for one dish, max() correctly pulls it
-- out without changing the result. update_log_entry's equivalent used a
-- scalar subquery instead of a join and never hit this.

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
    select coalesce(sum(di.grams), 0) / coalesce(nullif(max(d.servings), 0), 1) * p_quantity
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
