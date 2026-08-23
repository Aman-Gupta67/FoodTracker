-- Enum types, from nutrition-tracker-schema.md §4 verbatim.

create type food_source as enum ('ifct2017', 'fdc', 'off', 'label', 'user');
create type food_state  as enum ('raw', 'cooked', 'prepared', 'packaged');
create type nutrient_unit as enum ('kcal', 'g', 'mg', 'ug');
create type nutrient_category as enum ('macro', 'lipid', 'mineral', 'vitamin');

create type log_ref as enum ('food', 'dish');
create type meal_slot as enum
  ('breakfast', 'morning_snack', 'lunch', 'evening_snack', 'dinner');

create type sex_at_birth   as enum ('male', 'female');
create type activity_level as enum
  ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type body_goal as enum ('lose', 'maintain', 'gain');
