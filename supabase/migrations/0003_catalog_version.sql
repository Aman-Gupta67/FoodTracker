-- NOT in nutrition-tracker-schema.md — added to satisfy mvp-build-plan.md
-- Phase 1: "Dexie catalog cache with a version stamp so it only re-downloads
-- when the catalog changes." The schema doc doesn't define a mechanism for
-- this, so this is a minimal addition, not a DDL override.
--
-- Bump `version` by hand whenever seeded catalog data changes (a fresh
-- import, a hand-curated fix from out/warnings.csv, a portion calibration).
-- The client compares this against its local Dexie copy and only re-syncs
-- on a mismatch.
create table catalog_version (
  id         smallint primary key default 1,
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  check (id = 1)
);

insert into catalog_version (id, version) values (1, 1);
