-- Weight-over-time history for the Dashboard's weight trend chart.
-- profile.weight_kg is a single current snapshot — a trend graph needs the
-- value logged per day, not just once. Populated automatically whenever a
-- profile save changes weight (see saveProfileAndTargets), not through a
-- separate logging UI.

create table weight_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id),
  logged_date date not null,
  weight_kg   real not null,
  created_at  timestamptz not null default now(),
  unique (user_id, logged_date)
);
create index weight_log_user_date_idx on weight_log (user_id, logged_date);

alter table weight_log enable row level security;
create policy "weight_log select" on weight_log for select
  to authenticated using (user_id = auth.uid());
create policy "weight_log insert" on weight_log for insert
  to authenticated with check (user_id = auth.uid());
create policy "weight_log update" on weight_log for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "weight_log delete" on weight_log for delete
  to authenticated using (user_id = auth.uid());
