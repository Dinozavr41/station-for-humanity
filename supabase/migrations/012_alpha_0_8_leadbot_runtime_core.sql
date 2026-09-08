create table if not exists public.leadbot_instances (
  id uuid primary key default gen_random_uuid(),
  instance_no bigint generated always as identity unique,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  factory_request_id uuid unique references public.factory_requests(id) on delete set null,
  product_code text not null,
  public_slug text not null unique,
  status text not null default 'awaiting_credentials' check (status in ('building','awaiting_credentials','ready','active','paused','qa','delivered','retired')),
  business_name text not null,
  business_type text,
  config jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  readiness jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  delivered_at timestamptz
);

create table if not exists public.leadbot_update_receipts (
  instance_id uuid not null references public.leadbot_instances(id) on delete cascade,
  update_id bigint not null,
  received_at timestamptz not null default now(),
  primary key(instance_id, update_id)
);

create table if not exists public.leadbot_sessions (
  instance_id uuid not null references public.leadbot_instances(id) on delete cascade,
  chat_id bigint not null,
  flow_code text,
  step_index integer not null default 0,
  mode text not null default 'flow' check (mode in ('flow','faq','idle')),
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(instance_id, chat_id)
);

create table if not exists public.leadbot_leads (
  id uuid primary key default gen_random_uuid(),
  lead_no bigint generated always as identity,
  instance_id uuid not null references public.leadbot_instances(id) on delete restrict,
  telegram_update_id bigint,
  telegram_chat_id bigint,
  telegram_user_id bigint,
  telegram_username text,
  flow_code text not null,
  contact text,
  answers jsonb not null default '{}'::jsonb,
  estimate jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new','contacted','qualified','won','lost','spam')),
  sync_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(instance_id, lead_no)
);

create table if not exists public.leadbot_events (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.leadbot_instances(id) on delete cascade,
  lead_id uuid references public.leadbot_leads(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.leadbot_outbox (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.leadbot_instances(id) on delete cascade,
  lead_id uuid not null references public.leadbot_leads(id) on delete cascade,
  sink text not null check (sink in ('google_sheets','crm','webhook')),
  status text not null default 'pending' check (status in ('pending','processing','succeeded','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lead_id, sink)
);

create index if not exists idx_leadbot_leads_instance_created on public.leadbot_leads(instance_id, created_at desc);
create index if not exists idx_leadbot_events_instance_created on public.leadbot_events(instance_id, created_at desc);
create index if not exists idx_leadbot_outbox_pending on public.leadbot_outbox(status, next_attempt_at) where status in ('pending','failed');

alter table public.leadbot_instances enable row level security;
alter table public.leadbot_update_receipts enable row level security;
alter table public.leadbot_sessions enable row level security;
alter table public.leadbot_leads enable row level security;
alter table public.leadbot_events enable row level security;
alter table public.leadbot_outbox enable row level security;

revoke all on public.leadbot_instances, public.leadbot_update_receipts, public.leadbot_sessions, public.leadbot_leads, public.leadbot_events, public.leadbot_outbox from anon, authenticated;
grant select, insert, update, delete on public.leadbot_instances, public.leadbot_update_receipts, public.leadbot_sessions, public.leadbot_leads, public.leadbot_events, public.leadbot_outbox to service_role;
grant usage, select on all sequences in schema public to service_role;

create trigger trg_leadbot_instances_updated_at before update on public.leadbot_instances for each row execute function public.set_updated_at();
create trigger trg_leadbot_sessions_updated_at before update on public.leadbot_sessions for each row execute function public.set_updated_at();
create trigger trg_leadbot_leads_updated_at before update on public.leadbot_leads for each row execute function public.set_updated_at();
create trigger trg_leadbot_outbox_updated_at before update on public.leadbot_outbox for each row execute function public.set_updated_at();

create or replace function public.leadbot_store_secret(p_instance_id uuid, p_kind text, p_value text)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  allowed text[] := array['bot_token','webhook_secret','manager_chat_id','manager_claim_code','google_sheets_url','crm_url','crm_token','webhook_url','webhook_token','ai_api_key','ai_base_url','ai_model'];
  secret_name text;
  sid uuid;
begin
  if p_instance_id is null or not exists(select 1 from public.leadbot_instances where id=p_instance_id) then
    raise exception 'leadbot_instance_not_found';
  end if;
  if not (p_kind = any(allowed)) then raise exception 'unsupported_secret_kind'; end if;
  if p_value is null or length(trim(p_value))=0 or length(p_value)>10000 then raise exception 'invalid_secret_value'; end if;
  secret_name := 'leadbot_' || replace(p_instance_id::text,'-','') || '_' || p_kind;
  select id into sid from vault.secrets where name=secret_name limit 1;
  if sid is null then
    perform vault.create_secret(p_value,secret_name,'Station for Humanity LeadBot secret',null);
  else
    perform vault.update_secret(sid,p_value,secret_name,'Station for Humanity LeadBot secret',null);
  end if;
  return true;
end;
$$;

create or replace function public.leadbot_get_secrets(p_instance_id uuid)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select coalesce(jsonb_object_agg(replace(ds.name, 'leadbot_' || replace(p_instance_id::text,'-','') || '_',''), ds.decrypted_secret),'{}'::jsonb)
  from vault.decrypted_secrets ds
  where ds.name like ('leadbot_' || replace(p_instance_id::text,'-','') || '_%');
$$;

create or replace function public.leadbot_refresh_readiness(p_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  i public.leadbot_instances%rowtype;
  s jsonb;
  r jsonb;
  core_ready boolean;
  delivery_ready boolean;
  manager_ready boolean;
  sheets_ready boolean;
  crm_ready boolean;
  webhook_ready boolean;
  ai_ready boolean;
  calculator_ready boolean;
begin
  select * into i from public.leadbot_instances where id=p_instance_id for update;
  if i.id is null then raise exception 'leadbot_instance_not_found'; end if;
  s := public.leadbot_get_secrets(p_instance_id);
  core_ready := coalesce(length(s->>'bot_token')>20,false) and coalesce(length(s->>'webhook_secret')>=16,false);
  manager_ready := coalesce(length(s->>'manager_chat_id')>0,false);
  sheets_ready := not coalesce((i.features->>'google_sheets')::boolean,false) or coalesce(length(s->>'google_sheets_url')>0,false);
  crm_ready := not coalesce((i.features->>'crm_basic')::boolean,false) or coalesce(length(s->>'crm_url')>0,false);
  webhook_ready := not coalesce((i.features->>'webhook_api')::boolean,false) or coalesce(length(s->>'webhook_url')>0,false);
  ai_ready := not coalesce((i.features->>'ai_faq')::boolean,false) or (coalesce(length(s->>'ai_api_key')>0,false) and coalesce(length(s->>'ai_base_url')>0,false) and coalesce(length(s->>'ai_model')>0,false));
  calculator_ready := not coalesce((i.features->>'calculator')::boolean,false) or coalesce((i.config#>>'{calculator,configured}')::boolean,false);
  delivery_ready := core_ready and manager_ready and sheets_ready and crm_ready and webhook_ready and ai_ready and calculator_ready;
  r := jsonb_build_object(
    'core_ready',core_ready,'delivery_ready',delivery_ready,
    'bot_token',coalesce(length(s->>'bot_token')>20,false),
    'webhook_secret',coalesce(length(s->>'webhook_secret')>=16,false),
    'manager_chat_id',manager_ready,
    'google_sheets',sheets_ready,'crm',crm_ready,'webhook_api',webhook_ready,'ai_faq',ai_ready,'calculator',calculator_ready,
    'checked_at',now()
  );
  update public.leadbot_instances
  set readiness=r,
      status=case when status in ('active','paused','qa','delivered','retired') then status when core_ready then 'ready' else 'awaiting_credentials' end
  where id=p_instance_id;
  return r;
end;
$$;

revoke all on function public.leadbot_store_secret(uuid,text,text) from public, anon, authenticated;
revoke all on function public.leadbot_get_secrets(uuid) from public, anon, authenticated;
revoke all on function public.leadbot_refresh_readiness(uuid) from public, anon, authenticated;
grant execute on function public.leadbot_store_secret(uuid,text,text) to service_role;
grant execute on function public.leadbot_get_secrets(uuid) to service_role;
grant execute on function public.leadbot_refresh_readiness(uuid) to service_role;