-- Station Business Opportunity Engine 3.4
-- Cloud/multi-tenant reuse of the proven METAL.AI pipeline idea:
-- DISCOVER -> FETCH -> PARSE -> NORMALIZE -> DEDUPE -> ENRICH -> SCORE -> MATCH -> RECALCULATE -> MANAGER TASKS.

create table if not exists public.business_opportunity_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  vertical_code text,
  adapter_kind text not null default 'manual',
  base_url text,
  active boolean not null default true,
  polling_interval_minutes integer not null default 60 check (polling_interval_minutes >= 15),
  config jsonb not null default '{}'::jsonb,
  terms_note text,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_opportunities (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.business_opportunity_sources(id) on delete set null,
  source_item_id text,
  fingerprint text not null unique,
  vertical_code text not null,
  title text not null,
  description text,
  buyer_name text,
  buyer_contact jsonb not null default '{}'::jsonb,
  city text,
  region text,
  source_url text,
  published_at timestamptz,
  deadline_at timestamptz,
  budget_min numeric,
  budget_max numeric,
  currency text not null default 'RUB',
  detected_services text[] not null default '{}',
  normalized jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  parse_confidence numeric not null default 0 check (parse_confidence >= 0 and parse_confidence <= 1),
  status text not null default 'open' check (status in ('new','open','expired','closed','rejected')),
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_label text
);

create unique index if not exists business_opportunities_source_item_uidx
  on public.business_opportunities(source_id, source_item_id)
  where source_id is not null and source_item_id is not null;
create index if not exists business_opportunities_vertical_status_idx
  on public.business_opportunities(vertical_code,status,discovered_at desc);
create index if not exists business_opportunities_deadline_idx
  on public.business_opportunities(deadline_at) where deadline_at is not null;

create table if not exists public.business_opportunity_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_registry_id uuid not null unique references public.business_workspace_registry(id) on delete cascade,
  enabled boolean not null default true,
  cities text[] not null default '{}',
  regions text[] not null default '{}',
  positive_keywords text[] not null default '{}',
  negative_keywords text[] not null default '{}',
  min_budget numeric,
  min_score integer not null default 45 check (min_score between 0 and 100),
  auto_create_deal boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_opportunity_matches (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.business_opportunities(id) on delete cascade,
  workspace_registry_id uuid not null references public.business_workspace_registry(id) on delete cascade,
  vertical_code text not null,
  score integer not null default 0 check (score between 0 and 100),
  service_score integer not null default 0 check (service_score between 0 and 100),
  geography_score integer not null default 0 check (geography_score between 0 and 100),
  budget_score integer not null default 0 check (budget_score between 0 and 100),
  urgency_score integer not null default 0 check (urgency_score between 0 and 100),
  estimated_revenue numeric,
  estimated_cost numeric,
  estimated_margin numeric,
  matched_services text[] not null default '{}',
  reasons jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new','reviewed','saved','rejected','converted','expired')),
  converted_entity_type text,
  converted_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_scored_at timestamptz,
  unique(opportunity_id,workspace_registry_id)
);
create index if not exists business_opportunity_matches_workspace_idx
  on public.business_opportunity_matches(workspace_registry_id,status,score desc,created_at desc);

create table if not exists public.business_opportunity_events (
  id bigserial primary key,
  opportunity_id uuid references public.business_opportunities(id) on delete cascade,
  workspace_registry_id uuid references public.business_workspace_registry(id) on delete cascade,
  stage text not null,
  event_type text not null,
  actor_user_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists business_opportunity_events_opportunity_idx
  on public.business_opportunity_events(opportunity_id,created_at desc);

alter table public.business_opportunity_sources enable row level security;
alter table public.business_opportunities enable row level security;
alter table public.business_opportunity_profiles enable row level security;
alter table public.business_opportunity_matches enable row level security;
alter table public.business_opportunity_events enable row level security;
revoke all on public.business_opportunity_sources,public.business_opportunities,public.business_opportunity_profiles,public.business_opportunity_matches,public.business_opportunity_events from anon,authenticated;
grant all on public.business_opportunity_sources,public.business_opportunities,public.business_opportunity_profiles,public.business_opportunity_matches,public.business_opportunity_events to service_role;
grant usage,select on sequence public.business_opportunity_events_id_seq to service_role;

insert into public.business_opportunity_sources(code,name,vertical_code,adapter_kind,active,polling_interval_minutes,terms_note)
values
 ('station_network','Station Business Network','rpk','internal',true,60,'Внутренние предложения участников Station.'),
 ('manual_import','Ручной импорт / QA','rpk','manual',true,60,'Служебный источник для импорта и проверки адаптеров.')
on conflict (code) do nothing;

insert into public.rpk_modules(code,name,category,description,default_enabled,dependencies,sort_order)
values ('opportunities','Заказы рядом','growth','Opportunity Engine: найденные заказы, оценка совпадения и перевод в сделку.',true,array['crm']::text[],25)
on conflict (code) do update set name=excluded.name,category=excluded.category,description=excluded.description,dependencies=excluded.dependencies;

insert into public.rpk_workspace_modules(workspace_id,module_code,enabled,enabled_at)
select w.id,'opportunities',true,now() from public.rpk_workspaces w where w.slug='focus-biysk'
on conflict (workspace_id,module_code) do update set enabled=true,enabled_at=coalesce(public.rpk_workspace_modules.enabled_at,now()),disabled_at=null;

insert into public.business_opportunity_profiles(workspace_registry_id,cities,regions,positive_keywords,min_score,auto_create_deal,settings)
select b.id,array['Бийск']::text[],array['Алтайский край','Республика Алтай']::text[],array['баннер','билборд','3×6','3x6','наружная реклама','вывеск','печать','монтаж','оформление фасада','брендирован','стенд','табличк','полиграф','рекламно-информацион','световая конструкция','стел']::text[],45,false,jsonb_build_object('vertical','rpk','workspace_slug','focus-biysk')
from public.business_workspace_registry b where b.source_kind='rpk' and b.slug='focus-biysk'
on conflict (workspace_registry_id) do update set cities=excluded.cities,regions=excluded.regions,positive_keywords=excluded.positive_keywords,settings=excluded.settings,updated_at=now();
