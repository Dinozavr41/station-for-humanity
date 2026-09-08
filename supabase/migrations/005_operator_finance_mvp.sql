-- Alpha 0.3 operator + finance MVP
-- Quote history, explicit test-payment controls and atomic mock-payment posting.

alter table public.orders add column if not exists test_mode boolean not null default false;
alter table public.system_controls add column if not exists operator_console_enabled boolean not null default true;
alter table public.system_controls add column if not exists test_payments_enabled boolean not null default true;
alter table public.system_controls add column if not exists max_test_payment numeric(18,2) not null default 100000 check (max_test_payment >= 0);

create table if not exists public.order_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_no bigint generated always as identity unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  version integer not null check (version > 0),
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (char_length(currency)=3),
  status text not null default 'draft' check (status in ('draft','issued','accepted','expired','superseded','canceled')),
  valid_until timestamptz,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  issued_at timestamptz,
  unique(order_id, version)
);

create index if not exists idx_order_quotes_order on public.order_quotes(order_id);
create index if not exists idx_order_quotes_created_by on public.order_quotes(created_by);
create index if not exists idx_order_quotes_approved_by on public.order_quotes(approved_by);

alter table public.order_quotes enable row level security;
revoke all on table public.order_quotes from anon, authenticated;
grant select, insert, update on table public.order_quotes to service_role;
grant usage, select on sequence public.order_quotes_quote_no_seq to service_role;

grant select, insert, update on table public.orders to service_role;
grant select, insert on table public.order_events to service_role;
grant select, insert, update on table public.payments to service_role;
grant select, insert on table public.payment_events to service_role;
grant select, insert on table public.ledger_transactions to service_role;
grant select, insert on table public.ledger_entries to service_role;
grant select on table public.ledger_accounts to service_role;
grant select, insert on table public.value_allocations to service_role;
grant select, insert on table public.audit_log to service_role;
grant select, update on table public.founding_tickets to service_role;
grant select on table public.profiles to service_role;
grant select, update on table public.system_controls to service_role;
grant usage, select on sequence public.orders_order_no_seq to service_role;

create or replace function public.process_mock_payment(p_payment_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments%rowtype;
  o public.orders%rowtype;
  controls public.system_controls%rowtype;
  tx_id uuid;
  receivable_id uuid;
  revenue_id uuid;
begin
  select * into controls from public.system_controls where id=1 for update;
  if not controls.test_payments_enabled then raise exception 'test payments disabled'; end if;

  select * into p from public.payments where id=p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  if p.provider <> 'mock' or not p.test_mode then raise exception 'not a mock test payment'; end if;
  if p.amount > controls.max_test_payment then raise exception 'test payment exceeds limit'; end if;
  if p.canonical_status = 'succeeded' then
    return jsonb_build_object('ok',true,'payment_id',p.id,'already_processed',true);
  end if;
  if p.canonical_status not in ('created','pending') then raise exception 'invalid payment status'; end if;

  select * into o from public.orders where id=p.order_id for update;
  if not found then raise exception 'order not found'; end if;
  if not o.test_mode then raise exception 'mock payment requires test order'; end if;
  if o.status not in ('quoted','awaiting_payment') then raise exception 'order not payable'; end if;

  update public.payments
    set canonical_status='succeeded', provider_status='mock_succeeded', updated_at=now()
    where id=p.id;
  update public.orders set status='paid', updated_at=now() where id=o.id;

  insert into public.order_events(order_id,event_type,from_status,to_status,actor_user_id,reason,payload)
  values(o.id,'payment.succeeded',o.status,'paid',p_actor_user_id,'Atomic mock payment acceptance',jsonb_build_object('payment_id',p.id,'test_mode',true));

  insert into public.ledger_transactions(transaction_key,source_type,source_id,description,status,occurred_at,created_by)
  values('mock-payment:'||p.id::text,'payment',p.id,'Mock payment succeeded for test order #'||o.order_no,'draft',now(),p_actor_user_id)
  returning id into tx_id;

  select id into receivable_id from public.ledger_accounts where code='asset.provider_receivable';
  select id into revenue_id from public.ledger_accounts where code='revenue.customer';
  if receivable_id is null or revenue_id is null then raise exception 'ledger accounts missing'; end if;

  insert into public.ledger_entries(transaction_id,account_id,direction,amount,currency,metadata) values
    (tx_id,receivable_id,'debit',p.amount,p.currency,jsonb_build_object('payment_id',p.id,'test_mode',true)),
    (tx_id,revenue_id,'credit',p.amount,p.currency,jsonb_build_object('payment_id',p.id,'test_mode',true));

  update public.ledger_transactions set status='posted' where id=tx_id;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,correlation_id,reason,after_state,metadata)
  values(p_actor_user_id,'payment.mock_succeeded','payment',p.id::text,'PAY-'||p.id::text,'Mock payment acceptance',jsonb_build_object('order_id',o.id,'amount',p.amount,'currency',p.currency),jsonb_build_object('test_mode',true,'ledger_transaction_id',tx_id));

  return jsonb_build_object('ok',true,'payment_id',p.id,'order_id',o.id,'ledger_transaction_id',tx_id,'amount',p.amount,'currency',p.currency);
end;
$$;

revoke all on function public.process_mock_payment(uuid,uuid) from public, anon, authenticated;
grant execute on function public.process_mock_payment(uuid,uuid) to service_role;

update public.system_controls
set payments_enabled=false,
    payouts_enabled=false,
    auto_refunds_enabled=false,
    max_live_payment=0,
    operator_console_enabled=true,
    test_payments_enabled=true
where id=1;