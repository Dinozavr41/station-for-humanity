-- Alpha 1.0: channel-neutral LeadBot extensions.
-- Existing Telegram runtime remains backward compatible.

alter table public.leadbot_leads
  add column if not exists source_channel text not null default 'telegram',
  add column if not exists source_event_key text,
  add column if not exists source_chat_id text,
  add column if not exists source_user_id text,
  add column if not exists source_username text;

update public.leadbot_leads
set source_chat_id = coalesce(source_chat_id, telegram_chat_id::text),
    source_user_id = coalesce(source_user_id, telegram_user_id::text),
    source_username = coalesce(source_username, telegram_username)
where source_channel = 'telegram';

create unique index if not exists uq_leadbot_leads_source_event
  on public.leadbot_leads(instance_id, source_channel, source_event_key)
  where source_event_key is not null;

create table if not exists public.leadbot_channel_sessions (
  instance_id uuid not null references public.leadbot_instances(id) on delete cascade,
  channel text not null,
  chat_id text not null,
  user_id text,
  username text,
  flow_code text,
  step_index integer not null default 0,
  mode text not null default 'flow' check (mode in ('flow','faq','idle')),
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(instance_id, channel, chat_id)
);

create table if not exists public.leadbot_channel_receipts (
  instance_id uuid not null references public.leadbot_instances(id) on delete cascade,
  channel text not null,
  event_key text not null,
  received_at timestamptz not null default now(),
  primary key(instance_id, channel, event_key)
);

create index if not exists idx_leadbot_channel_sessions_instance
  on public.leadbot_channel_sessions(instance_id, channel, updated_at desc);

alter table public.leadbot_channel_sessions enable row level security;
alter table public.leadbot_channel_receipts enable row level security;
revoke all on public.leadbot_channel_sessions, public.leadbot_channel_receipts from anon, authenticated;
grant select, insert, update, delete on public.leadbot_channel_sessions, public.leadbot_channel_receipts to service_role;

create or replace function public.leadbot_store_secret(p_instance_id uuid, p_kind text, p_value text)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  allowed text[] := array[
    'bot_token','webhook_secret','manager_chat_id','manager_claim_code',
    'max_bot_token','max_webhook_secret','max_manager_user_id','max_manager_chat_id','max_manager_claim_code',
    'google_sheets_url','crm_url','crm_token','webhook_url','webhook_token',
    'ai_api_key','ai_base_url','ai_model'
  ];
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
  telegram_ready boolean;
  max_ready boolean;
  delivery_ready boolean;
  manager_ready boolean;
  sheets_ready boolean;
  crm_ready boolean;
  webhook_ready boolean;
  ai_ready boolean;
  calculator_ready boolean;
  claim_expires jsonb;
begin
  select * into i from public.leadbot_instances where id=p_instance_id for update;
  if i.id is null then raise exception 'leadbot_instance_not_found'; end if;
  s := public.leadbot_get_secrets(p_instance_id);

  telegram_ready := coalesce(length(s->>'bot_token')>20,false)
                    and coalesce(length(s->>'webhook_secret')>=16,false);
  max_ready := coalesce(length(s->>'max_bot_token')>20,false)
               and coalesce(length(s->>'max_webhook_secret')>=5,false);
  core_ready := telegram_ready or max_ready;
  manager_ready := coalesce(length(s->>'manager_chat_id')>0,false)
                   or coalesce(length(s->>'max_manager_user_id')>0,false)
                   or coalesce(length(s->>'max_manager_chat_id')>0,false);
  sheets_ready := not coalesce((i.features->>'google_sheets')::boolean,false)
                  or coalesce(length(s->>'google_sheets_url')>0,false);
  crm_ready := not coalesce((i.features->>'crm_basic')::boolean,false)
               or coalesce(length(s->>'crm_url')>0,false);
  webhook_ready := not coalesce((i.features->>'webhook_api')::boolean,false)
                   or coalesce(length(s->>'webhook_url')>0,false);
  ai_ready := not coalesce((i.features->>'ai_faq')::boolean,false)
              or (coalesce(length(s->>'ai_api_key')>0,false)
                  and coalesce(length(s->>'ai_base_url')>0,false)
                  and coalesce(length(s->>'ai_model')>0,false));
  calculator_ready := not coalesce((i.features->>'calculator')::boolean,false)
                      or coalesce((i.config#>>'{calculator,configured}')::boolean,false);
  delivery_ready := core_ready and manager_ready and sheets_ready and crm_ready
                    and webhook_ready and ai_ready and calculator_ready;
  claim_expires := i.readiness->'claim_expires_at';

  r := jsonb_build_object(
    'core_ready',core_ready,
    'delivery_ready',delivery_ready,
    'telegram_ready',telegram_ready,
    'max_ready',max_ready,
    'bot_token',coalesce(length(s->>'bot_token')>20,false),
    'webhook_secret',coalesce(length(s->>'webhook_secret')>=16,false),
    'max_bot_token',coalesce(length(s->>'max_bot_token')>20,false),
    'max_webhook_secret',coalesce(length(s->>'max_webhook_secret')>=5,false),
    'manager_chat_id',coalesce(length(s->>'manager_chat_id')>0,false),
    'max_manager',coalesce(length(s->>'max_manager_user_id')>0,false) or coalesce(length(s->>'max_manager_chat_id')>0,false),
    'google_sheets',sheets_ready,
    'crm',crm_ready,
    'webhook_api',webhook_ready,
    'ai_faq',ai_ready,
    'calculator',calculator_ready,
    'checked_at',now()
  );
  if claim_expires is not null then
    r := r || jsonb_build_object('claim_expires_at',claim_expires);
  end if;

  update public.leadbot_instances
  set readiness=r,
      status=case
        when status in ('active','paused','qa','delivered','retired') then status
        when core_ready then 'ready'
        else 'awaiting_credentials'
      end
  where id=p_instance_id;
  return r;
end;
$$;

revoke all on function public.leadbot_store_secret(uuid,text,text) from public, anon, authenticated;
revoke all on function public.leadbot_refresh_readiness(uuid) from public, anon, authenticated;
grant execute on function public.leadbot_store_secret(uuid,text,text) to service_role;
grant execute on function public.leadbot_refresh_readiness(uuid) to service_role;
