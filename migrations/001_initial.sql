create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists agent_runs (
  id uuid primary key,
  user_id uuid not null references app_users(id) on delete cascade,
  prompt text not null,
  status text not null default 'queued',
  tasks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_runs_user_created_idx on agent_runs (user_id, created_at desc);
