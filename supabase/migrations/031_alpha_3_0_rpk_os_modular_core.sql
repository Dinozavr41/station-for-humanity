create table if not exists public.rpk_modules (
  code text primary key,
  name text not null,
  description text,
  category text not null,
  default_enabled boolean not null default false,
  sort_order integer not null default 100,
  dependencies text[] not null default '{}'::text[],
  settings_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rpk_workspace_modules (
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  module_code text not null references public.rpk_modules(code) on delete cascade,
  enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  enabled_at timestamptz not null default now(),
  disabled_at timestamptz,
  primary key(workspace_id,module_code)
);

create table if not exists public.rpk_suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  name text not null,
  legal_name text,
  contact_name text,
  phone text,
  email text,
  website text,
  notes text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rpk_price_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  name text not null,
  kind text not null default 'customer' check (kind in ('customer','supplier','internal_cost')),
  currency text not null default 'RUB',
  active boolean not null default true,
  valid_from date,
  valid_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rpk_catalog_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  code text,
  name text not null,
  category text,
  unit text not null default 'шт',
  service boolean not null default false,
  track_stock boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,code)
);

create table if not exists public.rpk_price_list_items (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.rpk_price_lists(id) on delete cascade,
  catalog_item_id uuid not null references public.rpk_catalog_items(id) on delete cascade,
  price numeric(14,2) not null check (price >= 0),
  min_qty numeric(14,3),
  notes text,
  created_at timestamptz not null default now(),
  unique(price_list_id,catalog_item_id,min_qty)
);

create table if not exists public.rpk_supplier_prices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  supplier_id uuid not null references public.rpk_suppliers(id) on delete cascade,
  catalog_item_id uuid not null references public.rpk_catalog_items(id) on delete cascade,
  price numeric(14,2) not null check (price >= 0),
  currency text not null default 'RUB',
  min_qty numeric(14,3),
  valid_from date,
  valid_to date,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rpk_stock_locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  name text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rpk_stock_balances (
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  location_id uuid not null references public.rpk_stock_locations(id) on delete cascade,
  catalog_item_id uuid not null references public.rpk_catalog_items(id) on delete cascade,
  qty numeric(16,3) not null default 0,
  reserved_qty numeric(16,3) not null default 0,
  updated_at timestamptz not null default now(),
  primary key(location_id,catalog_item_id)
);

create table if not exists public.rpk_stock_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  location_id uuid not null references public.rpk_stock_locations(id) on delete restrict,
  catalog_item_id uuid not null references public.rpk_catalog_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('receipt','issue','adjustment','reserve','release')),
  qty numeric(16,3) not null,
  unit_cost numeric(14,2),
  reference_type text,
  reference_id text,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.rpk_deals (
  id uuid primary key default gen_random_uuid(),
  deal_no bigint generated always as identity unique,
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  client_id uuid references public.rpk_clients(id) on delete set null,
  source text,
  source_ref text,
  title text not null,
  stage text not null default 'lead' check (stage in ('lead','qualified','quote','approved','production','ready','won','lost')),
  owner_user_id uuid,
  amount numeric(14,2),
  cost_estimate numeric(14,2),
  margin_estimate numeric(14,2),
  next_action_at timestamptz,
  next_action text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rpk_deal_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.rpk_deals(id) on delete cascade,
  catalog_item_id uuid references public.rpk_catalog_items(id) on delete set null,
  name text not null,
  qty numeric(14,3) not null default 1,
  unit text not null default 'шт',
  price numeric(14,2) not null default 0,
  cost numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rpk_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  deal_id uuid references public.rpk_deals(id) on delete set null,
  client_id uuid references public.rpk_clients(id) on delete set null,
  document_type text not null check (document_type in ('quote','invoice','contract','act','work_order','other')),
  document_no text,
  status text not null default 'draft' check (status in ('draft','issued','sent','accepted','paid','canceled')),
  total numeric(14,2),
  currency text not null default 'RUB',
  storage_path text,
  payload jsonb not null default '{}'::jsonb,
  issued_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rpk_cash_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  deal_id uuid references public.rpk_deals(id) on delete set null,
  direction text not null check (direction in ('in','out')),
  category text,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'RUB',
  occurred_on date not null default current_date,
  counterparty text,
  note text,
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.rpk_recommendations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  recommendation_type text not null,
  module_code text references public.rpk_modules(code) on delete set null,
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  title text not null,
  message text not null,
  evidence jsonb not null default '{}'::jsonb,
  action_code text,
  status text not null default 'open' check (status in ('open','accepted','dismissed','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rpk_deals_workspace_stage on public.rpk_deals(workspace_id,stage,updated_at desc);
create index if not exists idx_rpk_cash_workspace_date on public.rpk_cash_entries(workspace_id,occurred_on desc);
create index if not exists idx_rpk_recommendations_workspace_status on public.rpk_recommendations(workspace_id,status,priority);
create index if not exists idx_rpk_supplier_prices_lookup on public.rpk_supplier_prices(workspace_id,catalog_item_id,supplier_id);

alter table public.rpk_modules enable row level security;
alter table public.rpk_workspace_modules enable row level security;
alter table public.rpk_suppliers enable row level security;
alter table public.rpk_price_lists enable row level security;
alter table public.rpk_catalog_items enable row level security;
alter table public.rpk_price_list_items enable row level security;
alter table public.rpk_supplier_prices enable row level security;
alter table public.rpk_stock_locations enable row level security;
alter table public.rpk_stock_balances enable row level security;
alter table public.rpk_stock_movements enable row level security;
alter table public.rpk_deals enable row level security;
alter table public.rpk_deal_items enable row level security;
alter table public.rpk_documents enable row level security;
alter table public.rpk_cash_entries enable row level security;
alter table public.rpk_recommendations enable row level security;

revoke all on public.rpk_modules,public.rpk_workspace_modules,public.rpk_suppliers,public.rpk_price_lists,public.rpk_catalog_items,public.rpk_price_list_items,public.rpk_supplier_prices,public.rpk_stock_locations,public.rpk_stock_balances,public.rpk_stock_movements,public.rpk_deals,public.rpk_deal_items,public.rpk_documents,public.rpk_cash_entries,public.rpk_recommendations from anon,authenticated;
grant select,insert,update,delete on public.rpk_modules,public.rpk_workspace_modules,public.rpk_suppliers,public.rpk_price_lists,public.rpk_catalog_items,public.rpk_price_list_items,public.rpk_supplier_prices,public.rpk_stock_locations,public.rpk_stock_balances,public.rpk_stock_movements,public.rpk_deals,public.rpk_deal_items,public.rpk_documents,public.rpk_cash_entries,public.rpk_recommendations to service_role;
grant usage,select on all sequences in schema public to service_role;

insert into public.rpk_modules(code,name,description,category,default_enabled,sort_order,dependencies) values
('dashboard','Рабочий стол','Короткая сводка: деньги, сделки, задачи, склад и рекомендации.','core',true,10,'{}'),
('crm','Клиенты и сделки','Мини-CRM без лишней сложности.','core',true,20,'{}'),
('archive','Архив макетов','Старые клиенты, макеты и быстрые переделки.','production',true,30,'{}'),
('design_factory','Design Factory','Баннер 3×6, remake, resize, preflight.','production',true,40,array['archive']),
('documents','Документы','КП, счёт, договор, акт, производственное задание.','sales',true,50,array['crm']),
('price_lists','Прайсы','Прайс-листы для клиентов и себестоимость.','sales',true,60,'{}'),
('suppliers','Поставщики и закупки','Поставщики, закупочные цены и сравнение.','operations',true,70,array['price_lists']),
('inventory','Склад','Материалы, остатки, резервы и движения.','operations',false,80,array['suppliers']),
('cashflow','Деньги','Управленческий приход/расход и маржа. Не заменяет регламентированный бухучёт.','finance',true,90,array['crm']),
('leadbot','Боты и лиды','Telegram / MAX / WhatsApp → единая MiniCRM.','growth',false,100,array['crm']),
('recommendations','Что улучшить','Подсказки Station по фактическому состоянию бизнеса.','growth',true,110,'{}')
on conflict (code) do update set name=excluded.name,description=excluded.description,category=excluded.category,default_enabled=excluded.default_enabled,sort_order=excluded.sort_order,dependencies=excluded.dependencies,updated_at=now();

insert into public.rpk_workspace_modules(workspace_id,module_code,enabled)
select w.id,m.code,m.default_enabled
from public.rpk_workspaces w cross join public.rpk_modules m
where w.slug='focus-biysk'
on conflict (workspace_id,module_code) do nothing;

insert into public.rpk_stock_locations(workspace_id,name)
select id,'Основной склад' from public.rpk_workspaces where slug='focus-biysk'
on conflict do nothing;
