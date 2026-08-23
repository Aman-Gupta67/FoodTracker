-- Personal layer (mutable, RLS-scoped), from
-- nutrition-tracker-schema.md §4.2 verbatim.

-- a composite dish you defined once: 'Rajma chawal'
create table my_dish (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id),
  name         text not null,
  servings      real not null default 1,       -- recipe yields N servings
  yield_grams  real,                           -- cooked weight, if known
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, name)
);

create table my_dish_ingredient (
  id         bigserial primary key,
  dish_id    bigint not null references my_dish(id) on delete cascade,
  food_id    bigint not null references food(id),
  grams      real   not null,                  -- raw weight as added
  sort_order smallint not null default 0
);

create table log_entry (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id),
  consumed_at   timestamptz not null,
  consumed_date date not null,                 -- local date, for daily rollups
  meal          meal_slot not null,
  ref_type      log_ref not null,
  food_id       bigint references food(id),
  dish_id       bigint references my_dish(id),
  portion_id    bigint references food_portion(id),
  quantity      real not null,                 -- multiplier on portion, or grams
  grams         real not null,                 -- RAW-EQUIVALENT grams. drives all nutrient math
  entered_state text not null default 'raw'
                  check (entered_state in ('raw','cooked')),
  entered_grams real not null,                 -- what the user actually typed
  yield_factor  real not null default 1.0,     -- snapshot of resolve_yield() at insert
  note          text,
  created_at    timestamptz not null default now(),
  check ((ref_type = 'food' and food_id is not null and dish_id is null)
      or (ref_type = 'dish' and dish_id is not null and food_id is null))
);
create index log_entry_user_date_idx on log_entry (user_id, consumed_date);

-- snapshot: computed at insert, never recomputed
create table log_entry_nutrient (
  entry_id    bigint   not null references log_entry(id) on delete cascade,
  nutrient_id smallint not null references nutrient(id),
  amount      real     not null,
  primary key (entry_id, nutrient_id)
);

create table profile (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  sex               sex_at_birth not null,
  date_of_birth     date not null,
  height_cm         real not null,
  weight_kg         real not null,
  activity          activity_level not null default 'sedentary',
  goal              body_goal not null default 'maintain',
  goal_rate_kg_week real not null default 0,   -- negative for loss, clamped to ±0.75
  protein_pct       smallint not null default 30,
  carb_pct          smallint not null default 40,
  fat_pct           smallint not null default 30,
  timezone          text not null default 'Asia/Kolkata',
  updated_at        timestamptz not null default now(),
  check (protein_pct + carb_pct + fat_pct = 100),
  check (goal_rate_kg_week between -0.75 and 0.75)
);

-- derived from profile on every save, not hand-entered. see mvp-build-plan.md §4.4
create table daily_target (
  user_id     uuid     not null references auth.users(id),
  nutrient_id smallint not null references nutrient(id),
  target_min  real,
  target_max  real,
  primary key (user_id, nutrient_id)
);
