alter table agent_runs
  add column if not exists result jsonb not null default '{}'::jsonb;
