-- Catalog tables (read-mostly, seeded by import), from
-- nutrition-tracker-schema.md §4.1 verbatim.

create table nutrient (
  id            smallint primary key,
  key           text not null unique,          -- 'iron'
  display_name  text not null,
  unit          nutrient_unit not null,
  category      nutrient_category not null,
  sort_order    smallint not null
);

create table food (
  id              bigserial primary key,
  source          food_source not null,
  source_ref      text,                        -- 'B020' | fdc_id | barcode
  name            text not null,               -- curated: 'Rajma, red (raw)'
  source_name     text,                        -- original: 'Rajmah, red'
  scientific_name text,
  food_group      text,
  state           food_state not null default 'raw',
  barcode         text,
  b12_unknown     boolean not null default false,
  is_curated      boolean not null default false,
  tags            text,                        -- 'vegetarian eggetarian ...' free veg filter
  n_regions       smallint,                    -- IFCT sample breadth, confidence proxy
  energy_source   text not null default 'measured'
                    check (energy_source in ('measured','derived_atwater')),
  -- provenance, written from day one even though MVP only ever emits ifct2017/measured
  fetched_via     text,                        -- 'ifct'|'off_api'|'fdc_api'|'llm'|'manual'
  fetch_confidence text                        -- 'measured'|'label'|'estimated'
                    check (fetch_confidence in ('measured','label','estimated')),
  fetch_payload   jsonb,
  confirmed_at    timestamptz,
  search_tsv      tsvector generated always as
                    (to_tsvector('simple', coalesce(name,''))) stored,
  created_at      timestamptz not null default now(),
  unique (source, source_ref)
);
create index food_search_idx on food using gin (search_tsv);
create index food_barcode_idx on food (barcode) where barcode is not null;

create table food_alias (
  food_id  bigint not null references food(id) on delete cascade,
  alias    text not null,                      -- 'rajma', 'razma', 'kidney beans'
  primary key (food_id, alias)
);
create index food_alias_idx on food_alias (alias);

-- amount is per 100 g edible portion, in nutrient.unit
create table food_nutrient (
  food_id     bigint   not null references food(id) on delete cascade,
  nutrient_id smallint not null references nutrient(id),
  amount      real     not null,
  primary key (food_id, nutrient_id)
);

create table food_portion (
  id          bigserial primary key,
  food_id     bigint not null references food(id) on delete cascade,
  label       text   not null,                 -- '1 katori', '1 roti', '1 tbsp'
  grams       real   not null,
  is_default  boolean not null default false,
  is_calibrated boolean not null default false -- true = you weighed it
);
create unique index food_portion_default_idx
  on food_portion (food_id) where is_default;

-- raw↔cooked mass conversion. factor = cooked_grams / raw_grams
-- seeded from out/food_yield.csv (30 food-specific + 20 group defaults)
create table food_yield (
  id            bigserial primary key,
  match_type    text not null check (match_type in ('food','group')),
  match_value   text not null,        -- food.source_ref, or food.food_group
  factor        real not null check (factor > 0),
  note          text,
  is_calibrated boolean not null default false,
  unique (match_type, match_value)
);

-- resolution order: food-specific, then group, then 1.0
create or replace function resolve_yield(p_food_id bigint) returns real
language sql stable as $$
  select coalesce(
    (select y.factor from food_yield y join food f on f.source_ref = y.match_value
      where y.match_type = 'food' and f.id = p_food_id),
    (select y.factor from food_yield y join food f on f.food_group = y.match_value
      where y.match_type = 'group' and f.id = p_food_id),
    1.0);
$$;
