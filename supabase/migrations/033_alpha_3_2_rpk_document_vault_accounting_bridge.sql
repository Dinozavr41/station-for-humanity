alter table public.rpk_documents add column if not exists title text;
alter table public.rpk_documents add column if not exists source_kind text not null default 'generated';
alter table public.rpk_documents add column if not exists source_document_id uuid references public.rpk_documents(id) on delete set null;
alter table public.rpk_documents add column if not exists original_name text;
alter table public.rpk_documents add column if not exists file_ext text;
alter table public.rpk_documents add column if not exists mime_type text;
alter table public.rpk_documents add column if not exists byte_size bigint;
alter table public.rpk_documents add column if not exists sha256 text;
alter table public.rpk_documents add column if not exists indexing_status text not null default 'not_required';
alter table public.rpk_documents add column if not exists extracted_content jsonb not null default '{}'::jsonb;
alter table public.rpk_documents add column if not exists template_family text;
alter table public.rpk_documents add column if not exists document_date date;
alter table public.rpk_documents add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.rpk_documents add column if not exists received_at timestamptz;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='rpk_documents_source_kind_check') then
    alter table public.rpk_documents add constraint rpk_documents_source_kind_check check (source_kind in ('generated','uploaded','email','max','imported','clone'));
  end if;
  if not exists(select 1 from pg_constraint where conname='rpk_documents_indexing_status_check') then
    alter table public.rpk_documents add constraint rpk_documents_indexing_status_check check (indexing_status in ('not_required','queued','indexing','ready','needs_review','failed'));
  end if;
end $$;

create index if not exists idx_rpk_documents_workspace_type_created on public.rpk_documents(workspace_id,document_type,created_at desc);
create index if not exists idx_rpk_documents_workspace_client on public.rpk_documents(workspace_id,client_id,created_at desc);
create index if not exists idx_rpk_documents_source_document on public.rpk_documents(source_document_id) where source_document_id is not null;

create table if not exists public.rpk_accounting_threads (
  id uuid primary key default gen_random_uuid(),
  thread_no bigint generated always as identity unique,
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  deal_id uuid references public.rpk_deals(id) on delete set null,
  client_id uuid references public.rpk_clients(id) on delete set null,
  result_document_id uuid references public.rpk_documents(id) on delete set null,
  request_type text not null default 'invoice' check (request_type in ('invoice','act','contract','reconciliation','payment','other')),
  subject text not null,
  status text not null default 'draft' check (status in ('draft','requested','sent_to_accountant','received','sent_to_client','paid','closed','canceled')),
  preferred_channel text not null default 'email' check (preferred_channel in ('email','max','phone','manual','other')),
  accountant_address text,
  requested_at timestamptz,
  received_at timestamptz,
  completed_at timestamptz,
  due_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rpk_accounting_threads_workspace_status on public.rpk_accounting_threads(workspace_id,status,updated_at desc);

create table if not exists public.rpk_communication_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  accounting_thread_id uuid references public.rpk_accounting_threads(id) on delete cascade,
  deal_id uuid references public.rpk_deals(id) on delete set null,
  client_id uuid references public.rpk_clients(id) on delete set null,
  document_id uuid references public.rpk_documents(id) on delete set null,
  direction text not null check (direction in ('in','out','internal')),
  channel text not null check (channel in ('email','max','phone','manual','system')),
  actor_side text not null default 'rpk' check (actor_side in ('rpk','accountant','client','supplier','system')),
  subject text,
  message_excerpt text,
  external_message_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_rpk_comms_workspace_time on public.rpk_communication_events(workspace_id,occurred_at desc);
create index if not exists idx_rpk_comms_accounting_thread on public.rpk_communication_events(accounting_thread_id,occurred_at desc);

create table if not exists public.rpk_mailbox_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  purpose text not null check (purpose in ('company','accountant','other')),
  provider text not null default 'gmail' check (provider in ('gmail','imap','other')),
  email_address text not null,
  status text not null default 'pending' check (status in ('pending','active','error','disabled')),
  credential_ref text,
  sync_from timestamptz,
  last_sync_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,purpose,email_address)
);

alter table public.rpk_accounting_threads enable row level security;
alter table public.rpk_communication_events enable row level security;
alter table public.rpk_mailbox_connections enable row level security;
revoke all on public.rpk_accounting_threads,public.rpk_communication_events,public.rpk_mailbox_connections from anon,authenticated;
grant select,insert,update,delete on public.rpk_accounting_threads,public.rpk_communication_events,public.rpk_mailbox_connections to service_role;
grant usage,select on all sequences in schema public to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'rpk-documents','rpk-documents',false,104857600,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.spreadsheet','text/csv','text/plain','image/jpeg','image/png','application/octet-stream']::text[]
)
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into public.rpk_modules(code,name,description,category,default_enabled,sort_order,dependencies)
values('accounting_bridge','Связь с бухгалтером','Запросы на счёт/акт/договор и история переписки по email, MAX, телефону или вручную.','finance',true,95,array['documents'])
on conflict (code) do update set name=excluded.name,description=excluded.description,category=excluded.category,default_enabled=excluded.default_enabled,sort_order=excluded.sort_order,dependencies=excluded.dependencies,updated_at=now();

insert into public.rpk_workspace_modules(workspace_id,module_code,enabled)
select w.id,'accounting_bridge',true from public.rpk_workspaces w where w.slug='focus-biysk'
on conflict (workspace_id,module_code) do update set enabled=true,disabled_at=null,enabled_at=now();