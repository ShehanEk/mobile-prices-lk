-- The specs lease: one specs run at a time, whichever machine starts it (the
-- home PC or GitHub), like the scrape and normalize leases in 0000.
--
-- The predicate names the two older kinds instead of 'specs' on purpose.
-- drizzle-kit applies all pending migrations in one transaction, and Postgres
-- cannot use an enum value in the transaction that added it (0002 adds
-- 'specs'). Casting to text to dodge that is refused in an index predicate
-- (functions in index predicate must be marked IMMUTABLE). So this index covers
-- every kind that has no lease of its own, which today is only 'specs'; a new
-- kind with its own lease needs to be added to this list in a later migration.
CREATE UNIQUE INDEX "pipeline_runs_active_specs_idx"
  ON "pipeline_runs" ("kind")
  WHERE "status" = 'running' AND "dry_run" = false AND "kind" NOT IN ('scrape', 'normalize');
