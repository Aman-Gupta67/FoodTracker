-- NOT in nutrition-tracker-schema.md — supports a deliberate, explicit
-- change to the auth model (2026-08-23): replacing magic-link email auth
-- with unverified phone-number login for this single-user/personal app.
--
-- This table is ONLY ever touched by a server route using the Supabase
-- service_role key (which bypasses RLS). RLS is enabled with zero policies
-- granted to anon/authenticated, so no client can read or write it
-- directly — the same "catalog-write" pattern used elsewhere, just with
-- reads locked out too since there's nothing here a client should see.
create table phone_login (
  phone_number text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table phone_login enable row level security;
