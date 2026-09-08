-- Alpha 0.5 — YooKassa TEST refunds and refund reconciliation.

alter table public.refunds add column if not exists provider text;
alter table public.refunds add column if not exists provider_status text;
alter table public.refunds add column if not exists provider_payload jsonb not null default '{}'::jsonb;
alter table public.refunds add column if not exists idempotency_key text;
alter table public.refunds add column if not exists test_mode boolean not null default false;
alter table public.refunds add column if not exists verified_at timestamptz;
create unique index if not exists ux_refunds_idempotency_key on public.refunds(idempotency_key) where idempotency_key is not null;
create unique index if not exists ux_refunds_provider_external on public.refunds(provider,external_refund_id) where provider is not null and external_refund_id is not null;

alter table public.system_controls add column if not exists test_refunds_enabled boolean not null default true;
alter table public.system_controls add column if not exists max_test_refund numeric(18,2) not null default 100000 check (max_test_refund >= 0);
update public.system_controls set test_refunds_enabled=true,max_test_refund=100000 where id=1;

create or replace function public.process_verified_yookassa_test_refund(
  p_refund_id uuid,
  p_external_refund_id text,
  p_provider_status text,
  p_provider_payload jsonb default '{}'::jsonb,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.refunds%rowtype;
  p public.payments%rowtype;
  o public.orders%rowtype;
  tx public.ledger_transactions%rowtype;
  debit_account uuid;
  credit_account uuid;
  refunded_total numeric(18,2);
  debit_total numeric(18,2);
  credit_total numeric(18,2);
  entry_count integer;
  is_full boolean := false;
  old_order_status text;
begin
  select * into r from public.refunds where id=p_refund_id for update;
  if r.id is null then raise exception 'refund_not_found'; end if;
  if r.provider <> 'yookassa_test' or r.test_mode is not true then raise exception 'not_yookassa_test_refund'; end if;
  if r.external_refund_id is distinct from p_external_refund_id then raise exception 'external_refund_mismatch'; end if;
  select * into p from public.payments where id=r.payment_id for update;
  if p.id is null then raise exception 'payment_not_found'; end if;
  if p.provider <> 'yookassa_test' or p.test_mode is not true then raise exception 'payment_not_yookassa_test'; end if;
  if p.canonical_status not in ('succeeded','partially_refunded','refunded') then raise exception 'payment_not_refundable_status:%',p.canonical_status; end if;
  select * into o from public.orders where id=p.order_id for update;
  if o.id is null then raise exception 'order_not_found'; end if;
  if o.test_mode is not true then raise exception 'live_order_blocked'; end if;

  update public.refunds set status='succeeded',provider_status=p_provider_status,provider_payload=p_provider_payload,verified_at=coalesce(verified_at,now()),updated_at=now() where id=r.id;
  select coalesce(sum(amount),0) into refunded_total from public.refunds where payment_id=p.id and status='succeeded';
  if refunded_total > p.amount then raise exception 'refund_total_exceeds_payment'; end if;
  is_full := refunded_total = p.amount;
  update public.payments set canonical_status=case when is_full then 'refunded' else 'partially_refunded' end,updated_at=now() where id=p.id;

  old_order_status:=o.status;
  if is_full and o.status <> 'refunded' then
    if o.status not in ('paid','in_production','qa','delivered','manual_review') then raise exception 'order_not_refundable_status:%',o.status; end if;
    update public.orders set status='refunded',updated_at=now() where id=o.id;
    insert into public.order_events(order_id,event_type,from_status,to_status,actor_user_id,reason,payload)
    values(o.id,'refund.succeeded',old_order_status,'refunded',p_actor_user_id,'Verified YooKassa TEST full refund',jsonb_build_object('refund_id',r.id,'external_refund_id',r.external_refund_id,'payment_id',p.id,'amount',r.amount,'currency',r.currency,'test_mode',true));
  elsif not is_full and not exists(select 1 from public.order_events e where e.order_id=o.id and e.event_type='refund.partial_succeeded' and e.payload->>'refund_id'=r.id::text) then
    insert into public.order_events(order_id,event_type,from_status,to_status,actor_user_id,reason,payload)
    values(o.id,'refund.partial_succeeded',o.status,o.status,p_actor_user_id,'Verified YooKassa TEST partial refund',jsonb_build_object('refund_id',r.id,'external_refund_id',r.external_refund_id,'payment_id',p.id,'amount',r.amount,'currency',r.currency,'test_mode',true));
  end if;

  insert into public.ledger_transactions(transaction_key,source_type,source_id,description,status,occurred_at,created_by)
  values('yookassa-test-refund:'||r.external_refund_id,'refund',r.id,'Verified YooKassa TEST refund for order #'||o.order_no,'draft',now(),p_actor_user_id)
  on conflict (transaction_key) do nothing;
  select * into tx from public.ledger_transactions where transaction_key='yookassa-test-refund:'||r.external_refund_id for update;
  if tx.id is null then raise exception 'refund_ledger_transaction_missing'; end if;
  select id into debit_account from public.ledger_accounts where code='revenue.customer';
  select id into credit_account from public.ledger_accounts where code='asset.provider_receivable';
  if debit_account is null or credit_account is null then raise exception 'ledger_accounts_missing'; end if;
  select count(*),coalesce(sum(case when direction='debit' then amount else 0 end),0),coalesce(sum(case when direction='credit' then amount else 0 end),0)
    into entry_count,debit_total,credit_total from public.ledger_entries where transaction_id=tx.id;
  if entry_count=0 then
    insert into public.ledger_entries(transaction_id,account_id,direction,amount,currency,metadata) values
      (tx.id,debit_account,'debit',r.amount,r.currency,jsonb_build_object('provider','yookassa_test','external_refund_id',r.external_refund_id,'payment_id',p.id,'test_mode',true)),
      (tx.id,credit_account,'credit',r.amount,r.currency,jsonb_build_object('provider','yookassa_test','external_refund_id',r.external_refund_id,'payment_id',p.id,'test_mode',true));
    debit_total:=r.amount;credit_total:=r.amount;
  elsif entry_count<>2 or debit_total<>r.amount or credit_total<>r.amount then raise exception 'refund_ledger_state_mismatch'; end if;
  if tx.status='draft' then update public.ledger_transactions set status='posted',posted_at=coalesce(posted_at,now()) where id=tx.id; elsif tx.status<>'posted' then raise exception 'refund_ledger_bad_status:%',tx.status; end if;
  if not exists(select 1 from public.audit_log where action='refund.yookassa_test_succeeded' and entity_type='refund' and entity_id=r.id::text) then
    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,reason,metadata)
    values(p_actor_user_id,'refund.yookassa_test_succeeded','refund',r.id::text,'Verified against YooKassa API and reconciled locally',jsonb_build_object('order_id',o.id,'order_no',o.order_no,'payment_id',p.id,'external_payment_id',p.external_payment_id,'external_refund_id',r.external_refund_id,'amount',r.amount,'currency',r.currency,'full_refund',is_full,'test_mode',true));
  end if;
  return jsonb_build_object('ok',true,'refund_id',r.id,'payment_id',p.id,'order_id',o.id,'order_no',o.order_no,'full_refund',is_full,'refunded_total',refunded_total,'payment_total',p.amount,'ledger_transaction_id',tx.id,'debit_total',debit_total,'credit_total',credit_total);
end;
$$;
revoke all on function public.process_verified_yookassa_test_refund(uuid,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.process_verified_yookassa_test_refund(uuid,text,text,jsonb,uuid) to service_role;
grant select,insert,update on public.refunds to service_role;
