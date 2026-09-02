-- Steps can't be read from a PWA directly — no web API reaches HealthKit,
-- even installed to the home screen. The workaround: an iOS Shortcuts
-- automation reads today's step count from Health and POSTs it to
-- /api/steps/sync, authenticated by a per-profile token (a Shortcut can't
-- hold a normal Supabase session/cookie) rather than a real login. The
-- route resolves user_id from the token via the service-role client
-- (src/lib/supabase/admin.ts), same pattern as phone-login.

alter table profile add column steps_sync_token text unique;

create table steps_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id),
  logged_date date not null,
  steps       integer not null check (steps >= 0),
  created_at  timestamptz not null default now(),
  unique (user_id, logged_date)
);
create index steps_log_user_date_idx on steps_log (user_id, logged_date);

alter table steps_log enable row level security;
create policy "steps_log select" on steps_log for select
  to authenticated using (user_id = auth.uid());
create policy "steps_log insert" on steps_log for insert
  to authenticated with check (user_id = auth.uid());
create policy "steps_log update" on steps_log for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "steps_log delete" on steps_log for delete
  to authenticated using (user_id = auth.uid());
