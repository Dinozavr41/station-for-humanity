-- Station RPK OS · Tender Economics V1
-- Additive core. Profit remains NULL until every required cost line is known.

create table if not exists public.rpk_tender_calculations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.business_opportunities(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','review_ready','approved','rejected')),
  tender_price numeric(18,2),
  candidate_bid numeric(18,2),
  currency text not null default 'RUB',
  min_profit numeric(18,2),
  min_margin_pct numeric(7,4),
  direct_cost numeric(18,2) not null default 0,
  platform_fee numeric(18,2) not null default 0,
  other_cost numeric(18,2) not null default 0,
  total_cost numeric(18,2) not null default 0,
  projected_profit numeric(18,2),
  projected_margin_pct numeric(7,4),
  stop_price numeric(18,2),
  cost_coverage_pct numeric(7,4) not null default 0,
  confidence numeric(7,4) not null default 0,
  missing_data jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '{}'::jsonb,
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, opportunity_id)
);

create table if not exists public.rpk_tender_cost_lines (
  id uuid primary key default gen_random_uuid(),
  calculation_id uuid not null references public.rpk_tender_calculations(id) on delete cascade,
  line_no integer not null default 1,
  line_type text not null default 'other' check (line_type in ('material','production','design','installation','logistics','subcontract','platform_fee','financing','tax','risk','other')),
  item_name text not null,
  specification text,
  quantity numeric(18,4),
  unit text,
  unit_cost numeric(18,4),
  total_cost numeric(18,2),
  required boolean not null default true,
  include_in_total boolean not null default true,
  cost_basis text not null default 'estimate' check (cost_basis in ('tender_detected_service','internal_cost','supplier_quote','supplier_price','market_price','official_fee','estimate','manual')),
  source_label text,
  source_url text,
  source_date date,
  valid_to date,
  confidence numeric(7,4) not null default 0 check (confidence >= 0 and confidence <= 1),
  evidence jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(calculation_id, line_no)
);

create table if not exists public.rpk_tender_decisions (
  id uuid primary key default gen_random_uuid(),
  calculation_id uuid not null references public.rpk_tender_calculations(id) on delete cascade,
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  decision text not null check (decision in ('approve','reject','reopen')),
  actor_user_id uuid not null,
  snapshot jsonb not null default '{}'::jsonb,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists rpk_tender_calculations_workspace_idx on public.rpk_tender_calculations(workspace_id, updated_at desc);
create index if not exists rpk_tender_calculations_opportunity_idx on public.rpk_tender_calculations(opportunity_id);
create index if not exists rpk_tender_cost_lines_calc_idx on public.rpk_tender_cost_lines(calculation_id, line_no);
create index if not exists rpk_tender_decisions_calc_idx on public.rpk_tender_decisions(calculation_id, created_at desc);

alter table public.rpk_tender_calculations enable row level security;
alter table public.rpk_tender_cost_lines enable row level security;
alter table public.rpk_tender_decisions enable row level security;
revoke all on public.rpk_tender_calculations from anon, authenticated;
revoke all on public.rpk_tender_cost_lines from anon, authenticated;
revoke all on public.rpk_tender_decisions from anon, authenticated;
grant all on public.rpk_tender_calculations to service_role;
grant all on public.rpk_tender_cost_lines to service_role;
grant all on public.rpk_tender_decisions to service_role;

insert into public.rpk_modules(code,name,description,category,default_enabled,sort_order,dependencies,settings_schema)
values (
  'tender_economics',
  'Экономика тендеров',
  'Себестоимость, источники цен, прибыль, STOP PRICE и решение директора.',
  'sales',true,35,
  array['opportunities','suppliers','price_lists']::text[],
  '{}'::jsonb
)
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  dependencies=excluded.dependencies,
  default_enabled=true;

insert into public.rpk_workspace_modules(workspace_id,module_code,enabled,enabled_at)
select w.id,'tender_economics',true,now()
from public.rpk_workspaces w
where w.slug='focus-biysk'
on conflict (workspace_id,module_code) do update set
  enabled=true,
  enabled_at=coalesce(public.rpk_workspace_modules.enabled_at,now()),
  disabled_at=null;

-- Acceptance case: existing Focus opportunity B0309261727418.
-- Uses natural keys only; if the opportunity is absent, no seed row is created.
with target as (
  select w.id as workspace_id,o.id as opportunity_id,coalesce(o.budget_max,o.budget_min) as tender_price,
         o.source_item_id,o.normalized
  from public.rpk_workspaces w
  join public.business_opportunities o on o.source_item_id='B0309261727418'
  where w.slug='focus-biysk'
  order by o.updated_at desc nulls last
  limit 1
)
insert into public.rpk_tender_calculations(workspace_id,opportunity_id,tender_price,currency,assumptions)
select workspace_id,opportunity_id,tender_price,'RUB',
       jsonb_build_object('source_platform',normalized->>'source_platform','tender_id',source_item_id,'vat_in_price',true,'documents_required',true)
from target
on conflict(workspace_id,opportunity_id) do update set
  tender_price=excluded.tender_price,
  assumptions=excluded.assumptions,
  updated_at=now();

with c as (
  select tc.id
  from public.rpk_tender_calculations tc
  join public.rpk_workspaces w on w.id=tc.workspace_id
  join public.business_opportunities o on o.id=tc.opportunity_id
  where w.slug='focus-biysk' and o.source_item_id='B0309261727418'
  limit 1
), lines(line_no,line_type,item_name,specification,total_cost,cost_basis,source_label,source_url,source_date,confidence,evidence,notes) as (
  values
  (1,'production','Изготовление вывесок','Требуется разбор ТЗ',null::numeric,'tender_detected_service','Тендер B0309261727418','https://synapsenet.ru/zakupki/roseltorg/b0309261727418%231--altajskij-kraj-vipolnenie-rabot-po-izgotovleniyu-i','2026-09-03'::date,0.95::numeric,'[{"kind":"tender_detection","service":"вывески"}]'::jsonb,'Цена блокируется до разбора ТЗ/КП'),
  (2,'production','Изготовление стел','Требуется разбор ТЗ',null::numeric,'tender_detected_service','Тендер B0309261727418','https://synapsenet.ru/zakupki/roseltorg/b0309261727418%231--altajskij-kraj-vipolnenie-rabot-po-izgotovleniyu-i','2026-09-03'::date,0.95::numeric,'[{"kind":"tender_detection","service":"стелы"}]'::jsonb,'Цена блокируется до разбора ТЗ/КП'),
  (3,'production','Изготовление указателей','Требуется разбор ТЗ',null::numeric,'tender_detected_service','Тендер B0309261727418','https://synapsenet.ru/zakupki/roseltorg/b0309261727418%231--altajskij-kraj-vipolnenie-rabot-po-izgotovleniyu-i','2026-09-03'::date,0.95::numeric,'[{"kind":"tender_detection","service":"указатели"}]'::jsonb,'Цена блокируется до разбора ТЗ/КП'),
  (4,'installation','Монтаж','Требуется количество адресов, высота и способ монтажа из ТЗ',null::numeric,'tender_detected_service','Тендер B0309261727418','https://synapsenet.ru/zakupki/roseltorg/b0309261727418%231--altajskij-kraj-vipolnenie-rabot-po-izgotovleniyu-i','2026-09-03'::date,0.95::numeric,'[{"kind":"tender_detection","service":"монтаж"}]'::jsonb,'Цена блокируется до разбора ТЗ/КП'),
  (5,'platform_fee','Комиссия Росэлторг при победе','0,8% НМЦ, максимум 75 000 ₽ без НДС; для процедуры 14,2 млн ₽ действует максимум. НДС 2026: 22%.',91500::numeric,'official_fee','Росэлторг · тарифы секции «Коммерческие закупки»','https://www.roseltorg.ru/rates/corp-common','2026-09-10'::date,1::numeric,'[{"kind":"formula","base_fee":75000,"vat_rate":0.22,"total":91500,"effective_for_procedures_from":"2026-04-01"}]'::jsonb,'Плата возникает у победителя; перед подачей подтвердить форму процедуры на первичной площадке'),
  (6,'tax','Налоги / НДС по режиму ООО «Фокус»','Подтвердить налоговый режим и способ учета входного НДС',null::numeric,'estimate',null,null,null::date,0::numeric,'[]'::jsonb,'Указать реальную сумму или 0 ₽ с подтверждением директора/бухгалтера'),
  (7,'financing','Финансирование / гарантии / обеспечение','Проверить аванс, отсрочку, обеспечение заявки/договора, стоимость гарантии и заемных денег',null::numeric,'estimate',null,null,null::date,0::numeric,'[]'::jsonb,'Если затрат нет — зафиксировать 0 ₽ и источник решения'),
  (8,'logistics','Логистика и выезды на монтаж','Нужны адреса объектов, количество выездов, транспорт и возможная спецтехника',null::numeric,'estimate',null,null,null::date,0::numeric,'[]'::jsonb,'Цена блокируется до разбора ТЗ')
)
insert into public.rpk_tender_cost_lines(calculation_id,line_no,line_type,item_name,specification,total_cost,required,include_in_total,cost_basis,source_label,source_url,source_date,confidence,evidence,notes)
select c.id,l.line_no,l.line_type,l.item_name,l.specification,l.total_cost,true,true,l.cost_basis,l.source_label,l.source_url,l.source_date,l.confidence,l.evidence,l.notes
from c cross join lines l
on conflict(calculation_id,line_no) do nothing;
