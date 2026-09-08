-- Station for Humanity — Alpha 0.3 core schema
-- PostgreSQL / Supabase migration

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
  payable_version integer not null default 1,
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
  occurred_at timestamptz not null default now(),
  posted_at timestamptz not null default now(),
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
  beneficiary_user_id uuid references auth.users(id) on delete restrict,
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
  max_auto_refund numeric(18,2) not null default 0,
  max_live_payment numeric(18,2) not null default 0,
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
  position integer not null,
  title text not null,
  status text not null default 'planned' check (status in ('planned','in_progress','verified','failed','canceled')),
  target_amount numeric(18,2),
  currency text,
  public_evidence_ref text,
  private_evidence jsonb not null default '{}'::jsonb,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  unique(dream_id, position)
);

-- Seed core accounts. These are accounting categories, not bank balances.
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

-- Finance/control tables are service-role only until explicit policies are added.
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

-- Users can read/update their own profile.
create policy "profile self read" on public.profiles for select using (auth.uid() = id);
create policy "profile self update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Users can submit and read their own tickets. Staff/admin access is via service role initially.
create policy "ticket self insert" on public.founding_tickets for insert with check (owner_user_id = auth.uid());
create policy "ticket self read" on public.founding_tickets for select using (owner_user_id = auth.uid() or is_public = true);

-- Public dreams can be read by anyone; private dreams remain service-role/owner controlled later.
create policy "public dreams read" on public.dreams for select using (is_public = true or owner_user_id = auth.uid());
create policy "public dream milestones read" on public.dream_milestones for select using (exists (select 1 from public.dreams d where d.id=dream_id and (d.is_public=true or d.owner_user_id=auth.uid())));

-- Ledger balance validation is performed in transaction posting code.
-- Production migration should add database triggers / deferred checks so every
-- ledger transaction has equal debit and credit totals by currency.
