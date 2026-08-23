-- RLS, implementing the rules described in nutrition-tracker-schema.md §4.3.
-- The schema doc states the *rules* in prose, not literal policy SQL — this
-- file is that translation.

-- Catalog tables: read-only to authenticated. No insert/update/delete policy
-- is defined for them, so only the service role (which bypasses RLS
-- entirely on Supabase) can write — exactly "writable only by service role."
alter table nutrient enable row level security;
create policy "nutrient read" on nutrient for select to authenticated using (true);

alter table food enable row level security;
create policy "food read" on food for select to authenticated using (true);

alter table food_alias enable row level security;
create policy "food_alias read" on food_alias for select to authenticated using (true);

alter table food_nutrient enable row level security;
create policy "food_nutrient read" on food_nutrient for select to authenticated using (true);

alter table food_portion enable row level security;
create policy "food_portion read" on food_portion for select to authenticated using (true);

alter table food_yield enable row level security;
create policy "food_yield read" on food_yield for select to authenticated using (true);

alter table catalog_version enable row level security;
create policy "catalog_version read" on catalog_version for select to authenticated using (true);

-- Personal tables: standard `user_id = auth.uid()` policy on all four verbs.

alter table my_dish enable row level security;
create policy "my_dish select" on my_dish for select
  to authenticated using (user_id = auth.uid());
create policy "my_dish insert" on my_dish for insert
  to authenticated with check (user_id = auth.uid());
create policy "my_dish update" on my_dish for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "my_dish delete" on my_dish for delete
  to authenticated using (user_id = auth.uid());

alter table log_entry enable row level security;
create policy "log_entry select" on log_entry for select
  to authenticated using (user_id = auth.uid());
create policy "log_entry insert" on log_entry for insert
  to authenticated with check (user_id = auth.uid());
create policy "log_entry update" on log_entry for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "log_entry delete" on log_entry for delete
  to authenticated using (user_id = auth.uid());

alter table profile enable row level security;
create policy "profile select" on profile for select
  to authenticated using (user_id = auth.uid());
create policy "profile insert" on profile for insert
  to authenticated with check (user_id = auth.uid());
create policy "profile update" on profile for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profile delete" on profile for delete
  to authenticated using (user_id = auth.uid());

alter table daily_target enable row level security;
create policy "daily_target select" on daily_target for select
  to authenticated using (user_id = auth.uid());
create policy "daily_target insert" on daily_target for insert
  to authenticated with check (user_id = auth.uid());
create policy "daily_target update" on daily_target for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "daily_target delete" on daily_target for delete
  to authenticated using (user_id = auth.uid());

-- log_entry_nutrient has no user_id — schema doc §4.3 explicitly calls this
-- out and says the policy "must join through log_entry."
alter table log_entry_nutrient enable row level security;
create policy "log_entry_nutrient select" on log_entry_nutrient for select
  to authenticated using (
    exists (select 1 from log_entry e where e.id = entry_id and e.user_id = auth.uid())
  );
create policy "log_entry_nutrient insert" on log_entry_nutrient for insert
  to authenticated with check (
    exists (select 1 from log_entry e where e.id = entry_id and e.user_id = auth.uid())
  );
create policy "log_entry_nutrient update" on log_entry_nutrient for update
  to authenticated using (
    exists (select 1 from log_entry e where e.id = entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from log_entry e where e.id = entry_id and e.user_id = auth.uid())
  );
create policy "log_entry_nutrient delete" on log_entry_nutrient for delete
  to authenticated using (
    exists (select 1 from log_entry e where e.id = entry_id and e.user_id = auth.uid())
  );

-- my_dish_ingredient is the same shape (no user_id, parent has one) but the
-- schema doc's §4.3 prose only names log_entry_nutrient explicitly — this is
-- an omission, not an intentional exception. Left unpoliced, either RLS
-- stays off (any authenticated user could read/write every user's dish
-- ingredients) or gets enabled with zero policies (owners locked out of
-- their own data). Applying the same join-through pattern here.
alter table my_dish_ingredient enable row level security;
create policy "my_dish_ingredient select" on my_dish_ingredient for select
  to authenticated using (
    exists (select 1 from my_dish d where d.id = dish_id and d.user_id = auth.uid())
  );
create policy "my_dish_ingredient insert" on my_dish_ingredient for insert
  to authenticated with check (
    exists (select 1 from my_dish d where d.id = dish_id and d.user_id = auth.uid())
  );
create policy "my_dish_ingredient update" on my_dish_ingredient for update
  to authenticated using (
    exists (select 1 from my_dish d where d.id = dish_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from my_dish d where d.id = dish_id and d.user_id = auth.uid())
  );
create policy "my_dish_ingredient delete" on my_dish_ingredient for delete
  to authenticated using (
    exists (select 1 from my_dish d where d.id = dish_id and d.user_id = auth.uid())
  );
