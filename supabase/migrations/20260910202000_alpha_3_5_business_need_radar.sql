-- Station Business Need Radar 3.5
-- SIGNAL -> CLASSIFY -> PREDICT NEED -> SCORE -> HUMAN REVIEW -> PROMOTE TO OPPORTUNITY -> CRM

create table if not exists public.business_need_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
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

create table if not exists public.business_need_rules (
  id uuid primary key default gen_random_uuid(),
  vertical_code text not null,
  event_type text not null,
  name text not null,
  trigger_terms text[] not null default '{}',
  predicted_services text[] not null default '{}',
  base_probability numeric not null check (base_probability >= 0 and base_probability <= 1),
  lead_days_min integer not null default 0,
  lead_days_max integer not null default 30 check (lead_days_max >= lead_days_min),
  active boolean not null default true,
  rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(vertical_code,event_type)
);

create table if not exists public.business_need_signals (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.business_need_sources(id) on delete set null,
  source_item_id text,
  fingerprint text not null unique,
  event_type text not null,
  entity_name text not null,
  entity_type text,
  title text not null,
  description text,
  city text,
  region text,
  address text,
  event_at timestamptz,
  source_url text,
  source_label text,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  evidence jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','expired','rejected')),
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists business_need_signals_source_item_uidx on public.business_need_signals(source_id,source_item_id) where source_id is not null and source_item_id is not null;
create index if not exists business_need_signals_event_idx on public.business_need_signals(event_type,status,detected_at desc);

create table if not exists public.business_need_predictions (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.business_need_signals(id) on delete cascade,
  workspace_registry_id uuid not null references public.business_workspace_registry(id) on delete cascade,
  vertical_code text not null,
  rule_id uuid references public.business_need_rules(id) on delete set null,
  need_probability numeric not null default 0 check (need_probability >= 0 and need_probability <= 1),
  score integer not null default 0 check (score between 0 and 100),
  relevance_score integer not null default 0 check (relevance_score between 0 and 100),
  geography_score integer not null default 0 check (geography_score between 0 and 100),
  recency_score integer not null default 0 check (recency_score between 0 and 100),
  predicted_services text[] not null default '{}',
  need_window_start timestamptz,
  need_window_end timestamptz,
  reasons jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new','reviewed','saved','rejected','promoted','expired')),
  promoted_opportunity_id uuid references public.business_opportunities(id) on delete set null,
  last_scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(signal_id,workspace_registry_id)
);
create index if not exists business_need_predictions_workspace_idx on public.business_need_predictions(workspace_registry_id,status,score desc,created_at desc);

create table if not exists public.business_need_events (
  id bigserial primary key,
  signal_id uuid references public.business_need_signals(id) on delete cascade,
  prediction_id uuid references public.business_need_predictions(id) on delete cascade,
  workspace_registry_id uuid references public.business_workspace_registry(id) on delete cascade,
  stage text not null,
  event_type text not null,
  actor_user_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists business_need_events_signal_idx on public.business_need_events(signal_id,created_at desc);

alter table public.business_opportunities add column if not exists opportunity_kind text not null default 'direct_demand';
alter table public.business_opportunities add column if not exists origin_need_signal_id uuid references public.business_need_signals(id) on delete set null;

alter table public.business_need_sources enable row level security;
alter table public.business_need_rules enable row level security;
alter table public.business_need_signals enable row level security;
alter table public.business_need_predictions enable row level security;
alter table public.business_need_events enable row level security;
revoke all on public.business_need_sources,public.business_need_rules,public.business_need_signals,public.business_need_predictions,public.business_need_events from anon,authenticated;
grant all on public.business_need_sources,public.business_need_rules,public.business_need_signals,public.business_need_predictions,public.business_need_events to service_role;
grant usage,select on sequence public.business_need_events_id_seq to service_role;

insert into public.business_need_sources(code,name,adapter_kind,active,polling_interval_minutes,terms_note)
values
 ('station_manual_signal','Station · ручной сигнал / QA','manual',true,60,'Служебный источник для проверки Need Radar.'),
 ('station_business_network_signal','Station Business Network · события бизнеса','internal',true,60,'Сигналы от добровольно опубликованных событий участников Station.')
on conflict(code) do nothing;

insert into public.business_need_rules(vertical_code,event_type,name,trigger_terms,predicted_services,base_probability,lead_days_min,lead_days_max,rationale)
values
 ('rpk','business_opening','Открытие новой точки',array['открытие','новый магазин','новый ресторан','открылся','открывается','новая точка']::text[],array['вывеска','навигация','оформление фасада','таблички','полиграфия']::text[],0.85,0,21,'Новой физической точке обычно нужны идентификация фасада и навигация.'),
 ('rpk','new_branch_or_move','Новый филиал или переезд',array['новый филиал','переезд','новый офис','новый адрес','открывает филиал']::text[],array['вывеска','навигация','таблички','брендирование','полиграфия']::text[],0.82,0,30,'Переезд или филиал создают потребность в оформлении новой площадки.'),
 ('rpk','construction_completion','Стройка или сдача объекта',array['строительство','сдача объекта','ввод в эксплуатацию','торговый центр','жилой комплекс','благоустройство']::text[],array['навигация','стенды','таблички','баннеры','вывеска']::text[],0.76,7,180,'Перед сдачей и запуском объекта возникает спрос на навигацию и визуальное оформление.'),
 ('rpk','rebrand_or_rename','Ребрендинг или смена названия',array['ребрендинг','смена названия','новый бренд','обновление фирменного стиля']::text[],array['вывеска','брендирование','полиграфия','оформление фасада']::text[],0.90,0,30,'При смене бренда физические и печатные носители обычно требуют замены.'),
 ('rpk','event_announced','Анонс мероприятия',array['фестиваль','форум','выставка','ярмарка','конференция','соревнования','мероприятие']::text[],array['баннеры','стенды','указатели','полиграфия','брендирование']::text[],0.72,0,45,'Офлайн-мероприятия регулярно требуют временного рекламного оформления.'),
 ('rpk','new_company','Новая компания',array['зарегистрирована компания','новое предприятие','новая компания','создано общество']::text[],array['вывеска','таблички','полиграфия']::text[],0.50,7,45,'Регистрация компании — слабый ранний сигнал; физическая точка не гарантирована.')
on conflict(vertical_code,event_type) do update set name=excluded.name,trigger_terms=excluded.trigger_terms,predicted_services=excluded.predicted_services,base_probability=excluded.base_probability,lead_days_min=excluded.lead_days_min,lead_days_max=excluded.lead_days_max,rationale=excluded.rationale,active=true,updated_at=now();

insert into public.rpk_modules(code,name,category,description,default_enabled,dependencies,sort_order)
values ('need_radar','Need Radar','growth','Ранние сигналы будущей потребности: открытия, стройки, филиалы, ребрендинг и события.',true,array['opportunities']::text[],24)
on conflict(code) do update set name=excluded.name,category=excluded.category,description=excluded.description,dependencies=excluded.dependencies;

insert into public.rpk_workspace_modules(workspace_id,module_code,enabled,enabled_at)
select w.id,'need_radar',true,now() from public.rpk_workspaces w where w.slug='focus-biysk'
on conflict(workspace_id,module_code) do update set enabled=true,enabled_at=coalesce(public.rpk_workspace_modules.enabled_at,now()),disabled_at=null;
