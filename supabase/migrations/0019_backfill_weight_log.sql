-- weight_log (0018) only gets a row going forward, on the next profile save
-- (see saveProfileAndTargets) — anyone who set their weight before that
-- shipped has zero rows, so the Dashboard's weight trend chart has nothing
-- to plot until they happen to re-save their profile. Backfill one row per
-- existing profile, dated today (no earlier history exists to backfill).
insert into weight_log (user_id, logged_date, weight_kg)
select user_id, current_date, weight_kg
from profile
where weight_kg is not null
on conflict (user_id, logged_date) do nothing;
