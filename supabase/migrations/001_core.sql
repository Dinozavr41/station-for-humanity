-- Station for Humanity — Alpha 0.3 core schema (hardened)
-- PostgreSQL / Supabase migration
-- Financial controls default OFF. Client access is deny-by-default.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  country_code text,
  region text,
  role text not null default 'contributor' check (role in ('viewer','contributor','operator','finance','risk','admin','auditor')),
  status text not null default 'active' check (status in ('active','restricted','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.founding_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no bigint generated always as identity unique,
  owner_user_id uuid references auth.users(id) on delete set null,
  role_kind text not null check (role_kind in ('need','build','resource','contribute','dream')),
  public_statement text,
  private_contact jsonb not null default '{}'::jsonb,
  region text,
  status text not null default 'submitted' check (status in ('submitted','review','accepted','rejected','archived')),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity unique,
  customer_user_id uuid references auth.users(id) on delete set null,
  source_ticket_id uuid references public.founding_tickets(id) on delete set null,
  title text not null,
  specification jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','quoted','awaiting_payment','paid','in_production','qa','delivered','canceled','refunded','disputed','manual_review')),
  currency text not null default 'RUB' check (char_length(currency)=3),
  quoted_amount numeric(18,2) check (quoted_amount is null or quoted_amount >= 0),
  payable_version integer not null default 1 check (payable_version > 0),
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  external_payment_id text,
  idempotency_key text not null unique,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (char_length(currency)=3),
  canonical_status text not null default 'created' check (canonical_status in ('created','pending','waiting_for_capture','succeeded','canceled','partially_refunded','refunded','chargeback','manual_review')),
  provider_status text,
  provider_payload jsonb not null default '{}'::jsonb,
  test_mode boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, external_payment_id)
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete restrict,
  provider text not null,
  event_type text not null,
  event_fingerprint text not null unique,
  external_object_id text,
  verified boolean not null default false,
  raw_payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (char_length(currency)=3),
  status text not null default 'requested' check (status in ('requested','approved','processing','succeeded','canceled','failed')),
  reason text not null,
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  external_refund_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','revenue','expense','allocation')),
  currency text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_key text not null unique,
  source_type text not null,
  source_id uuid,
  description text,
  status text not null default 'draft' check (status in ('draft','posted')),
  occurred_at timestamptz not null default now(),
  posted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions(id) on delete restrict,
  account_id uuid not null references public.ledger_accounts(id) on delete restrict,
  direction text not null check (direction in ('debit','credit')),
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (char_length(currency)=3),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.value_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  allocation_kind text not null check (allocation_kind in ('creator','module','infrastructure','platform','dream','builder','opportunity','emergency','reserve')),
  beneficiary_user_id uuid references auth.users(id) on delete set null,
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null check (char_length(currency)=3),
  status text not null default 'accrued' check (status in ('proposed','accrued','approved','paid','reversed')),
  rule_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  beneficiary_user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (char_length(currency)=3),
  status text not null default 'requested' check (status in ('requested','risk_review','approved','processing','succeeded','failed','canceled')),
  destination_ref text,
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  provider text,
  external_payout_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  unique(entity_type, entity_id, action, status)
);

create table if not exists public.system_controls (
  id integer primary key default 1 check (id=1),
  public_registration_enabled boolean not null default true,
  payments_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  auto_refunds_enabled boolean not null default false,
  max_auto_refund numeric(18,2) not null default 0 check (max_auto_refund >= 0),
  max_live_payment numeric(18,2) not null default 0 check (max_live_payment >= 0),
  maintenance_mode boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.system_controls(id) values (1) on conflict (id) do nothing;

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  correlation_id text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.dreams (
  id uuid primary key default gen_random_uuid(),
  dream_no bigint generated always as identity unique,
  owner_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  public_description text,
  status text not null default 'planning' check (status in ('planning','active','paused','completed','canceled')),
  public_progress numeric(5,2) not null default 0 check (public_progress between 0 and 100),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dream_milestones (
  id uuid primary key default gen_random_uuid(),
  dream_id uuid not null references public.dreams(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  status text not null default 'planned' check (status in ('planned','in_progress','verified','failed','canceled')),
  target_amount numeric(18,2) check (target_amount is null or target_amount >= 0),
  currency text check (currency is null or char_length(currency)=3),
  public_evidence_ref text,
  private_evidence jsonb not null default '{}'::jsonb,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  unique(dream_id, position)
);

-- Core indexes, especially ownership columns used by RLS and reconciliation paths.
create index if not exists idx_founding_tickets_owner on public.founding_tickets(owner_user_id);
create index if not exists idx_orders_customer on public.orders(customer_user_id);
create index if not exists idx_orders_ticket on public.orders(source_ticket_id);
create index if not exists idx_order_events_order on public.order_events(order_id);
create index if not exists idx_payments_order on public.payments(order_id);
create index if not exists idx_payment_events_payment on public.payment_events(payment_id);
create index if not exists idx_payment_events_external_object on public.payment_events(provider, external_object_id);
create index if not exists idx_refunds_payment on public.refunds(payment_id);
create index if not exists idx_ledger_entries_transaction on public.ledger_entries(transaction_id);
create index if not exists idx_ledger_entries_account on public.ledger_entries(account_id);
create index if not exists idx_value_allocations_order on public.value_allocations(order_id);
create index if not exists idx_value_allocations_beneficiary on public.value_allocations(beneficiary_user_id);
create index if not exists idx_payouts_beneficiary on public.payouts(beneficiary_user_id);
create index if not exists idx_audit_log_correlation on public.audit_log(correlation_id);
create index if not exists idx_dreams_owner on public.dreams(owner_user_id);
create index if not exists idx_dream_milestones_dream on public.dream_milestones(dream_id);

-- Automatic updated_at maintenance.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_founding_tickets_updated_at on public.founding_tickets;
create trigger trg_founding_tickets_updated_at before update on public.founding_tickets for each row execute function public.set_updated_at();
drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
drop trigger if exists trg_refunds_updated_at on public.refunds;
create trigger trg_refunds_updated_at before update on public.refunds for each row execute function public.set_updated_at();
drop trigger if exists trg_payouts_updated_at on public.payouts;
create trigger trg_payouts_updated_at before update on public.payouts for each row execute function public.set_updated_at();
drop trigger if exists trg_system_controls_updated_at on public.system_controls;
create trigger trg_system_controls_updated_at before update on public.system_controls for each row execute function public.set_updated_at();
drop trigger if exists trg_dreams_updated_at on public.dreams;
create trigger trg_dreams_updated_at before update on public.dreams for each row execute function public.set_updated_at();

-- Every new Auth user gets a non-privileged profile. Authorization role is NOT taken from user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Seed core accounting categories. These are categories, not bank balances.
insert into public.ledger_accounts(code,name,account_type,currency) values
('asset.provider_receivable','Provider Receivable','asset','RUB'),
('asset.bank','Bank','asset','RUB'),
('revenue.customer','Customer Revenue','revenue','RUB'),
('expense.payment_fees','Payment Fees','expense','RUB'),
('allocation.dream','Dream Fund Allocation','allocation','RUB'),
('allocation.builder','Builder & Pension Allocation','allocation','RUB'),
('allocation.opportunity','Opportunity Fund Allocation','allocation','RUB'),
('allocation.emergency','Emergency Fund Allocation','allocation','RUB')
on conflict (code) do nothing;

-- Posted ledger transactions are immutable; entries can only be edited while draft.
create or replace function public.guard_ledger_entry_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tx_id uuid;
  tx_status text;
begin
  tx_id := case when tg_op = 'DELETE' then old.transaction_id else new.transaction_id end;
  select status into tx_status from public.ledger_transactions where id = tx_id;
  if tx_status is null then
    raise exception 'ledger transaction not found';
  end if;
  if tx_status <> 'draft' then
    raise exception 'posted ledger entries are immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.guard_ledger_transaction_posting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.status = 'posted' then
    raise exception 'posted ledger transactions are immutable';
  end if;

  if tg_op = 'UPDATE' and old.status = 'posted' then
    raise exception 'posted ledger transactions are immutable';
  end if;

  if tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'posted' then
    if not exists (select 1 from public.ledger_entries e where e.transaction_id = new.id) then
      raise exception 'cannot post ledger transaction without entries';
    end if;

    if exists (
      select 1
      from public.ledger_entries e
      where e.transaction_id = new.id
      group by e.currency
      having sum(case when e.direction='debit' then e.amount else -e.amount end) <> 0
    ) then
      raise exception 'ledger transaction is not balanced by currency';
    end if;

    new.posted_at := coalesce(new.posted_at, now());
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_ledger_entries on public.ledger_entries;
create trigger trg_guard_ledger_entries
before insert or update or delete on public.ledger_entries
for each row execute function public.guard_ledger_entry_mutation();

drop trigger if exists trg_guard_ledger_transactions on public.ledger_transactions;
create trigger trg_guard_ledger_transactions
before update or delete on public.ledger_transactions
for each row execute function public.guard_ledger_transaction_posting();

-- RLS everywhere in the exposed public schema.
alter table public.profiles enable row level security;
alter table public.founding_tickets enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.refunds enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.value_allocations enable row level security;
alter table public.payouts enable row level security;
alter table public.approvals enable row level security;
alter table public.system_controls enable row level security;
alter table public.audit_log enable row level security;
alter table public.dreams enable row level security;
alter table public.dream_milestones enable row level security;

-- Deny client access by default. service_role is intentionally not revoked.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.founding_tickets from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_events from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.payment_events from anon, authenticated;
revoke all on table public.refunds from anon, authenticated;
revoke all on table public.ledger_accounts from anon, authenticated;
revoke all on table public.ledger_transactions from anon, authenticated;
revoke all on table public.ledger_entries from anon, authenticated;
revoke all on table public.value_allocations from anon, authenticated;
revoke all on table public.payouts from anon, authenticated;
revoke all on table public.approvals from anon, authenticated;
revoke all on table public.system_controls from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;
revoke all on table public.dreams from anon, authenticated;
revoke all on table public.dream_milestones from anon, authenticated;

-- Minimal authenticated client surface.
grant select on table public.profiles to authenticated;
revoke update on table public.profiles from authenticated;
grant update (display_name, country_code, region) on table public.profiles to authenticated;

grant select, insert on table public.founding_tickets to authenticated;
grant usage, select on sequence public.founding_tickets_ticket_no_seq to authenticated;

grant select on table public.orders to authenticated;
grant select on table public.order_events to authenticated;

-- Users can only see their own profile and can only update non-authorization columns.
create policy "profile self read"
on public.profiles for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy "profile self update"
on public.profiles for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id)
with check ((select auth.uid()) is not null and (select auth.uid()) = id);

-- A client may submit only a private, unreviewed ticket for itself.
create policy "ticket self insert"
on public.founding_tickets for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and owner_user_id = (select auth.uid())
  and status = 'submitted'
  and is_public = false
);

-- Never expose public_statement together with private_contact to strangers from this base table.
create policy "ticket self read"
on public.founding_tickets for select
to authenticated
using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

create policy "order customer read"
on public.orders for select
to authenticated
using ((select auth.uid()) is not null and customer_user_id = (select auth.uid()));

create policy "order event customer read"
on public.order_events for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_user_id = (select auth.uid())
  )
);

-- Public dream access will be exposed later through a sanitized API/view.
-- Base dreams and milestones stay service-role only so owner IDs/private evidence cannot leak.

-- Financial system invariant: live money is OFF after migration.
update public.system_controls
set payments_enabled = false,
    payouts_enabled = false,
    auto_refunds_enabled = false,
    max_auto_refund = 0,
    max_live_payment = 0,
    maintenance_mode = false
where id = 1;
