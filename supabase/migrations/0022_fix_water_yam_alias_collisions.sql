-- Two confirmed, real misidentifications in AI-parsed meals — a known
-- data-defect correction, same "hand-fix, one at a time, never a blanket
-- auto-correction" precedent CLAUDE.md's known-defects section already
-- establishes for the 36 Atwater-disagreement foods.
--
-- 1. "aalu" (a common alternate spelling of "aloo", Hindi for potato) was
--    only aliased to Yam, ordinary (food_id 247) — a legitimate regional
--    name for that yam species in IFCT, but potato is the overwhelmingly
--    more likely meaning in a food-logging context, and "aloo"/"alu"
--    already correctly resolve to Potato. Moves the alias to the three
--    Potato entries, matching the existing aloo/alu/aalukah pattern there.
delete from food_alias where food_id = 247 and alias = 'aalu';
insert into food_alias (food_id, alias)
select id, 'aalu' from food where id in (235, 236, 237)
on conflict (food_id, alias) do nothing;

-- 2. No "Water" entry exists in the catalog at all, so an AI-parsed
--    "water" ingredient (near-universal in chai/tea/milk recipes) prefix-
--    matched "water yam" (or "watermelon") instead of resolving to
--    anything water-like — silently injecting a starchy tuber's or
--    melon's calories into what should contribute zero nutrition. Adds a
--    real, zero-nutrient Water entry with an exact "water" alias (see the
--    companion src/lib/catalog/search.ts change: exact alias matches now
--    rank before longer merely-prefix ones, so this reliably wins over
--    "watermelon"/"water yam" rather than depending on index-scan order).
insert into food (
  source, source_ref, name, source_name, food_group, state,
  is_curated, energy_source, fetched_via, fetch_confidence, confirmed_at
) values (
  'user', 'water', 'Water', 'Water', 'Beverages', 'raw',
  true, 'measured', 'manual', 'measured', now()
)
on conflict (source, source_ref) do nothing;

insert into food_alias (food_id, alias)
select id, 'water' from food where source = 'user' and source_ref = 'water'
on conflict (food_id, alias) do nothing;

insert into food_nutrient (food_id, nutrient_id, amount)
select f.id, n.id, 0
from food f
cross join nutrient n
where f.source = 'user' and f.source_ref = 'water'
  and n.key in ('energy', 'protein', 'fat', 'carb')
on conflict (food_id, nutrient_id) do nothing;

update catalog_version set version = version + 1 where id = 1;
