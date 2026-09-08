-- Alpha 0.6: autonomous financial watchdog, incident queue and health snapshot.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(), provider text not null default 'yookassa_test', trigger_source text not null,
  status text not null default 'running' check (status in ('running','succeeded','failed','partial')),
  started_at timestamptz not null default now(), finished_at timestamptz,
  checked_payments integer not null default 0, checked_refunds integer not null default 0,
  changed_payments integer not null default 0, changed_refunds integer not null default 0,
  error_count integer not null default 0, incident_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb, actor_user_id uuid, created_at timestamptz not null default now()
);
create index if not exists idx_reconciliation_runs_started on public.reconciliation_runs(started_at desc);
create index if not exists idx_reconciliation_runs_status on public.reconciliation_runs(status,started_at desc);
alter table public.reconciliation_runs enable row level security;
revoke all on public.reconciliation_runs from anon,authenticated;
grant all on public.reconciliation_runs to service_role;

create table if not exists public.reconciliation_incidents (
  id uuid primary key default gen_random_uuid(), fingerprint text not null unique, provider text not null default 'yookassa_test',
  kind text not null, entity_type text not null, entity_id text,
  order_id uuid references public.orders(id) on delete set null, payment_id uuid references public.payments(id) on delete set null,
  refund_id uuid references public.refunds(id) on delete set null,
  severity text not null default 'warning' check (severity in ('info','warning','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  title text not null, details jsonb not null default '{}'::jsonb, occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  acknowledged_at timestamptz, acknowledged_by uuid, resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_reconciliation_incidents_status on public.reconciliation_incidents(status,severity,last_seen_at desc);
create index if not exists idx_reconciliation_incidents_order on public.reconciliation_incidents(order_id);
create index if not exists idx_reconciliation_incidents_payment on public.reconciliation_incidents(payment_id);
alter table public.reconciliation_incidents enable row level security;
revoke all on public.reconciliation_incidents from anon,authenticated;
grant all on public.reconciliation_incidents to service_role;

create table if not exists public.watchdog_config (
  id integer primary key default 1 check (id=1), enabled boolean not null default true,
  token_hash text not null, interval_seconds integer not null default 300 check (interval_seconds between 60 and 86400),
  updated_at timestamptz not null default now()
);
alter table public.watchdog_config enable row level security;
revoke all on public.watchdog_config from anon,authenticated;
grant all on public.watchdog_config to service_role;

do $$
declare v_token text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name='sfh_watchdog_token' limit 1;
  if v_token is null then
    v_token:=encode(extensions.gen_random_bytes(32),'hex');
    perform vault.create_secret(v_token,'sfh_watchdog_token','Station for Humanity server watchdog token');
  end if;
  insert into public.watchdog_config(id,enabled,token_hash,interval_seconds,updated_at)
  values(1,true,encode(extensions.digest(v_token,'sha256'),'hex'),300,now())
  on conflict(id) do update set token_hash=excluded.token_hash,enabled=true,interval_seconds=excluded.interval_seconds,updated_at=now();
end $$;

create or replace function public.verify_watchdog_token(p_token text) returns boolean
language sql security definer set search_path=''
as $$ select coalesce((select enabled and encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')=token_hash from public.watchdog_config where id=1),false); $$;
revoke all on function public.verify_watchdog_token(text) from public,anon,authenticated;
grant execute on function public.verify_watchdog_token(text) to service_role;

create or replace function public.get_financial_health_snapshot() returns jsonb
language sql security definer set search_path=''
as $$
with ledger_totals as (
  select lt.id,lt.source_type,lt.source_id,lt.status,count(le.id) entry_count,
    coalesce(sum(case when le.direction='debit' then le.amount else 0 end),0)::numeric debit_total,
    coalesce(sum(case when le.direction='credit' then le.amount else 0 end),0)::numeric credit_total
  from public.ledger_transactions lt left join public.ledger_entries le on le.transaction_id=lt.id
  group by lt.id,lt.source_type,lt.source_id,lt.status
), metrics as (
  select
    (select count(*) from ledger_totals where status='posted' and (entry_count<>2 or abs(debit_total-credit_total)>0.0001))::int ledger_imbalances,
    (select count(*) from public.payments p where p.provider='yookassa_test' and p.test_mode=true and p.canonical_status in ('succeeded','refunded') and not exists(select 1 from ledger_totals lt where lt.source_type='payment' and lt.source_id=p.id and lt.status='posted' and lt.entry_count=2 and abs(lt.debit_total-p.amount)<=0.0001 and abs(lt.credit_total-p.amount)<=0.0001))::int missing_payment_ledgers,
    (select count(*) from public.refunds r where r.provider='yookassa_test' and r.test_mode=true and r.status='succeeded' and not exists(select 1 from ledger_totals lt where lt.source_type='refund' and lt.source_id=r.id and lt.status='posted' and lt.entry_count=2 and abs(lt.debit_total-r.amount)<=0.0001 and abs(lt.credit_total-r.amount)<=0.0001))::int missing_refund_ledgers,
    (select count(*) from public.orders o join public.payments p on p.order_id=o.id and p.provider='yookassa_test' and p.test_mode=true where (p.canonical_status='succeeded' and o.status in ('draft','quoted','awaiting_payment')) or (p.canonical_status='refunded' and o.status<>'refunded') or (o.status='refunded' and p.canonical_status<>'refunded'))::int order_payment_mismatches,
    (select count(*) from public.payments p join public.orders o on o.id=p.order_id where p.provider='yookassa_test' and p.test_mode=true and p.canonical_status in ('pending','waiting_for_capture') and o.status='awaiting_payment' and p.updated_at<now()-interval '20 minutes')::int stale_pending,
    (select count(*) from public.reconciliation_incidents where status in ('open','acknowledged'))::int open_incidents,
    (select count(*) from public.reconciliation_incidents where status in ('open','acknowledged') and severity='critical')::int critical_incidents
), controls as (
  select payments_enabled,payouts_enabled,auto_refunds_enabled,max_live_payment,test_payments_enabled,test_refunds_enabled,max_test_payment,max_test_refund from public.system_controls where id=1
), last_run as (
  select id,status,trigger_source,started_at,finished_at,error_count,incident_count,summary from public.reconciliation_runs order by started_at desc limit 1
)
select jsonb_build_object(
 'status',case when (select payments_enabled or payouts_enabled or max_live_payment>0 from controls) or (select ledger_imbalances+missing_payment_ledgers+missing_refund_ledgers+critical_incidents from metrics)>0 then 'critical' when (select order_payment_mismatches+stale_pending+open_incidents from metrics)>0 then 'warning' else 'healthy' end,
 'metrics',to_jsonb(metrics),'controls',to_jsonb(controls),'last_run',coalesce((select to_jsonb(last_run) from last_run),'null'::jsonb),'generated_at',now())
from metrics,controls;
$$;
revoke all on function public.get_financial_health_snapshot() from public,anon,authenticated;
grant execute on function public.get_financial_health_snapshot() to service_role;
