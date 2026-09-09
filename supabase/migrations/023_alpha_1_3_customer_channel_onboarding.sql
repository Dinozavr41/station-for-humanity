-- Alpha 1.3: scoped self-service channel onboarding for LeadBot customers.

create table if not exists public.leadbot_onboarding_links (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.leadbot_instances(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active','completed','revoked')),
  expires_at timestamptz not null,
  created_by uuid,
  attempts integer not null default 0 check (attempts >= 0),
  last_used_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_leadbot_onboarding_instance
  on public.leadbot_onboarding_links(instance_id, created_at desc);
create index if not exists idx_leadbot_onboarding_active_expiry
  on public.leadbot_onboarding_links(status, expires_at);

alter table public.leadbot_onboarding_links enable row level security;
revoke all on public.leadbot_onboarding_links from anon, authenticated;
grant select, insert, update, delete on public.leadbot_onboarding_links to service_role;

comment on table public.leadbot_onboarding_links is
'Scoped bearer links for customer self-service LeadBot channel credential onboarding. Raw tokens are never stored; only SHA-256 hashes.';
