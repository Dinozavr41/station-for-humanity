create table public.factory_products (
  code text primary key,
  name_ru text not null,
  name_en text not null,
  status text not null default 'active' check (status in ('draft','active','paused','retired')),
  currency text not null default 'RUB' check (char_length(currency)=3),
  base_price numeric(12,2) not null check (base_price>=0),
  delivery_days integer not null check (delivery_days>0),
  price_version integer not null default 1 check (price_version>0),
  public_description_ru text not null,
  public_description_en text not null,
  base_scope jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.factory_pricing_rules (
  id bigint generated always as identity primary key,
  product_code text not null references public.factory_products(code) on delete cascade,
  option_code text not null,
  label_ru text not null,
  label_en text not null,
  input_kind text not null check (input_kind in ('boolean','quantity')),
  unit_price numeric(12,2) not null check (unit_price>=0),
  max_quantity integer not null default 1 check (max_quantity>0),
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique(product_code,option_code)
);

create table public.factory_requests (
  id uuid primary key default gen_random_uuid(),
  request_no bigint generated always as identity unique,
  product_code text not null references public.factory_products(code),
  order_id uuid unique references public.orders(id),
  customer_name text not null,
  contact text not null,
  business_type text,
  desired_result text not null,
  selected_options jsonb not null default '{}'::jsonb,
  price_breakdown jsonb not null default '[]'::jsonb,
  amount numeric(12,2) not null check (amount>=0),
  currency text not null check (char_length(currency)=3),
  price_version integer not null check (price_version>0),
  status text not null default 'submitted' check (status in ('submitted','quoted','review','accepted','rejected','canceled')),
  consent boolean not null default false,
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index factory_requests_status_created_idx on public.factory_requests(status,created_at desc);
create index factory_requests_product_created_idx on public.factory_requests(product_code,created_at desc);

create table public.factory_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null default 0 check (hits>=0),
  updated_at timestamptz not null default now()
);

alter table public.factory_products enable row level security;
alter table public.factory_pricing_rules enable row level security;
alter table public.factory_requests enable row level security;
alter table public.factory_rate_limits enable row level security;

revoke all on public.factory_products,public.factory_pricing_rules,public.factory_requests,public.factory_rate_limits from anon,authenticated;
grant all on public.factory_products,public.factory_pricing_rules,public.factory_requests,public.factory_rate_limits to service_role;
grant usage,select on all sequences in schema public to service_role;

insert into public.factory_products(code,name_ru,name_en,status,currency,base_price,delivery_days,price_version,public_description_ru,public_description_en,base_scope)
values (
  'TGBOT_LEADS_V1',
  'SFH LeadBot 1.0',
  'SFH LeadBot 1.0',
  'active','RUB',14900,3,1,
  'Telegram-бот для приёма заявок: меню, анкета клиента, уведомление менеджера, сохранение заявки, развёртывание и исходный код.',
  'Telegram lead-capture bot with menu, customer questionnaire, manager notification, lead storage, deployment and source code.',
  jsonb_build_object(
    'questionnaire_steps',7,
    'manager_notification',true,
    'database_storage',true,
    'deployment',true,
    'source_code',true,
    'handover_guide',true,
    'bugfix_support_days',7
  )
);

insert into public.factory_pricing_rules(product_code,option_code,label_ru,label_en,input_kind,unit_price,max_quantity,sort_order) values
('TGBOT_LEADS_V1','extra_flow','Дополнительный сценарий','Extra conversation flow','quantity',3000,3,10),
('TGBOT_LEADS_V1','google_sheets','Google Таблицы','Google Sheets integration','boolean',4000,1,20),
('TGBOT_LEADS_V1','calculator','Калькулятор цены/подбора','Price or selection calculator','boolean',5000,1,30),
('TGBOT_LEADS_V1','webhook_api','Webhook / внешний API','Webhook / external API','boolean',7000,1,40),
('TGBOT_LEADS_V1','crm_basic','Базовая CRM-интеграция','Basic CRM integration','boolean',12000,1,50),
('TGBOT_LEADS_V1','ai_faq','AI FAQ по базе знаний','AI FAQ over a knowledge base','boolean',12000,1,60),
('TGBOT_LEADS_V1','priority_48h','Приоритетный запуск до 48 часов','Priority delivery within 48 hours','boolean',7000,1,70);

create or replace function public.consume_factory_rate_limit(p_key text,p_max_hits integer default 5,p_window_minutes integer default 60)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v_row public.factory_rate_limits%rowtype; v_now timestamptz:=now();
begin
  if p_key is null or length(p_key)<16 then return false; end if;
  select * into v_row from public.factory_rate_limits where key=p_key for update;
  if not found then
    insert into public.factory_rate_limits(key,window_start,hits,updated_at) values(p_key,v_now,1,v_now);
    return true;
  end if;
  if v_row.window_start < v_now-make_interval(mins=>p_window_minutes) then
    update public.factory_rate_limits set window_start=v_now,hits=1,updated_at=v_now where key=p_key;
    return true;
  end if;
  if v_row.hits>=p_max_hits then return false; end if;
  update public.factory_rate_limits set hits=hits+1,updated_at=v_now where key=p_key;
  return true;
end;$$;
revoke all on function public.consume_factory_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_factory_rate_limit(text,integer,integer) to service_role;

create or replace function public.create_factory_public_order(
  p_product_code text,
  p_customer_name text,
  p_contact text,
  p_business_type text,
  p_desired_result text,
  p_selected_options jsonb,
  p_price_breakdown jsonb,
  p_amount numeric,
  p_currency text,
  p_price_version integer,
  p_source_key text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_request public.factory_requests%rowtype;
  v_order public.orders%rowtype;
  v_quote public.order_quotes%rowtype;
begin
  insert into public.factory_requests(product_code,customer_name,contact,business_type,desired_result,selected_options,price_breakdown,amount,currency,price_version,status,consent,source_key)
  values(p_product_code,p_customer_name,p_contact,nullif(p_business_type,''),p_desired_result,coalesce(p_selected_options,'{}'::jsonb),coalesce(p_price_breakdown,'[]'::jsonb),p_amount,p_currency,p_price_version,'submitted',true,p_source_key)
  returning * into v_request;

  insert into public.orders(title,specification,status,currency,quoted_amount,payable_version,test_mode)
  values(
    'Digital Factory · '||p_product_code||' · '||left(p_customer_name,80),
    jsonb_build_object('factory_request_id',v_request.id,'product_code',p_product_code,'business_type',p_business_type,'desired_result',p_desired_result,'selected_options',p_selected_options,'price_breakdown',p_price_breakdown,'price_version',p_price_version,'commercial',true),
    'quoted',p_currency,p_amount,1,false
  ) returning * into v_order;

  insert into public.order_quotes(order_id,version,amount,currency,status,valid_until,note,issued_at)
  values(v_order.id,1,p_amount,p_currency,'issued',now()+interval '7 days','Automated fixed-scope Digital Factory quote. Live payment remains disabled until control-plane/legal readiness.',now())
  returning * into v_quote;

  update public.factory_requests set order_id=v_order.id,status='quoted',updated_at=now() where id=v_request.id;

  insert into public.order_events(order_id,event_type,from_status,to_status,reason,payload)
  values(v_order.id,'factory.quote_created',null,'quoted','Public Digital Factory pricing engine created a fixed-scope quote',jsonb_build_object('factory_request_id',v_request.id,'quote_id',v_quote.id,'amount',p_amount,'currency',p_currency,'price_version',p_price_version));

  insert into public.audit_log(action,entity_type,entity_id,reason,metadata)
  values('factory.request_submitted','factory_request',v_request.id::text,'Public Digital Factory request submitted and quoted',jsonb_build_object('order_id',v_order.id,'order_no',v_order.order_no,'quote_id',v_quote.id,'quote_no',v_quote.quote_no,'amount',p_amount,'currency',p_currency,'product_code',p_product_code,'price_version',p_price_version));

  return jsonb_build_object(
    'request_id',v_request.id,
    'request_no',v_request.request_no,
    'order_id',v_order.id,
    'order_no',v_order.order_no,
    'quote_id',v_quote.id,
    'quote_no',v_quote.quote_no,
    'amount',p_amount,
    'currency',p_currency,
    'valid_until',v_quote.valid_until
  );
end;$$;
revoke all on function public.create_factory_public_order(text,text,text,text,text,jsonb,jsonb,numeric,text,integer,text) from public,anon,authenticated;
grant execute on function public.create_factory_public_order(text,text,text,text,text,jsonb,jsonb,numeric,text,integer,text) to service_role;