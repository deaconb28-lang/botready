-- 0012 — a run says which engine answered it.
--
-- prompt_runs recorded the model string and nothing about which engine it
-- belonged to, which was fine while there was one. The visibility figures the
-- agency plan sells are share-of-voice numbers, and a share of voice that
-- silently mixes engines — or silently drops to one when a key expires — is
-- the kind of number that moves for a reason nobody can find.
--
-- Backfilled to 'claude' because that is what every existing row is: the probe
-- has only ever asked Anthropic. Not a guess, a fact about the rows.
--
-- The id is text and matches packages/core/engines.json rather than being an
-- enum, for the reason in constraint 3: adding an engine has to be a data
-- edit, and an enum makes it a migration.

alter table prompt_runs add column if not exists engine_id text not null default 'claude';

create index if not exists prompt_runs_engine_idx on prompt_runs (engine_id, ran_at desc);

comment on column prompt_runs.engine_id is
  'Which answer engine produced this run. Must exist in packages/core/engines.json.';
