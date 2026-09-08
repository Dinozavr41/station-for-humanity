-- Alpha 0.4 hotfix — reconcile YooKassa TEST payment, order and ledger atomically/idempotently.
-- Fixes a sandbox incident where the webhook marked the payment succeeded before
-- the RPC ran, causing the old RPC to return early and skip order/ledger updates.

create or replace function public.process_verified_yookassa_test_payment(
  p_payment_id uuid,
  p_external_payment_id text,
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
  p public.payments%rowtype;
  o public.orders%rowtype;
  tx public.ledger_transactions%rowtype;
  debit_account uuid;
  credit_account uuid;
  debit_total numeric(18,2);
  credit_total numeric(18,2);
  entry_count integer;
  changed_order boolean := false;
begin
  select * into p from public.payments where id = p_payment_id for update;
  if p.id is null then raise exception 'payment_not_found'; end if;
  if p.provider <> 'yookassa_test' or p.test_mode is not true then raise exception 'not_yookassa_test_payment'; end if;
  if p.external_payment_id is distinct from p_external_payment_id then raise exception 'external_payment_mismatch'; end if;

  select * into o from public.orders where id = p.order_id for update;
  if o.id is null then raise exception 'order_not_found'; end if;
  if o.test_mode is not true then raise exception 'live_order_blocked'; end if;

  -- Provider verification happens before this RPC. Reconcile all local state even
  -- if the payment row is already marked succeeded.
  update public.payments
  set canonical_status='succeeded',
      provider_status=p_provider_status,
      provider_payload=p_provider_payload,
      updated_at=now()
  where id=p.id;

  if o.status in ('quoted','awaiting_payment') then
    update public.orders set status='paid', updated_at=now() where id=o.id;
    insert into public.order_events(order_id,event_type,from_status,to_status,actor_user_id,reason,payload)
    values(o.id,'payment.succeeded',o.status,'paid',p_actor_user_id,'Verified YooKassa TEST payment',jsonb_build_object('payment_id',p.id,'external_payment_id',p.external_payment_id,'provider','yookassa_test','test_mode',true));
    changed_order := true;
    o.status := 'paid';
  elsif o.status not in ('paid','in_production','qa','delivered') then
    raise exception 'order_not_payable_status:%', o.status;
  end if;

  insert into public.ledger_transactions(transaction_key,source_type,source_id,description,status,occurred_at,created_by)
  values('yookassa-test:' || p.external_payment_id,'payment',p.id,'Verified YooKassa TEST payment for order #' || o.order_no,'draft',now(),p_actor_user_id)
  on conflict (transaction_key) do nothing;

  select * into tx
  from public.ledger_transactions
  where transaction_key='yookassa-test:' || p.external_payment_id
  for update;

  if tx.id is null then raise exception 'ledger_transaction_missing'; end if;

  select id into debit_account from public.ledger_accounts where code='asset.provider_receivable';
  select id into credit_account from public.ledger_accounts where code='revenue.customer';
  if debit_account is null or credit_account is null then raise exception 'ledger_accounts_missing'; end if;

  select count(*),
         coalesce(sum(case when le.direction='debit' then le.amount else 0 end),0),
         coalesce(sum(case when le.direction='credit' then le.amount else 0 end),0)
  into entry_count, debit_total, credit_total
  from public.ledger_entries le
  where le.transaction_id=tx.id;

  if entry_count = 0 then
    insert into public.ledger_entries(transaction_id,account_id,direction,amount,currency,metadata)
    values
      (tx.id,debit_account,'debit',p.amount,p.currency,jsonb_build_object('provider','yookassa_test','external_payment_id',p.external_payment_id,'test_mode',true)),
      (tx.id,credit_account,'credit',p.amount,p.currency,jsonb_build_object('provider','yookassa_test','external_payment_id',p.external_payment_id,'test_mode',true));
    debit_total := p.amount;
    credit_total := p.amount;
  elsif entry_count <> 2 or debit_total <> p.amount or credit_total <> p.amount then
    raise exception 'ledger_state_mismatch';
  end if;

  if tx.status = 'draft' then
    update public.ledger_transactions set status='posted',posted_at=coalesce(posted_at,now()) where id=tx.id;
  elsif tx.status <> 'posted' then
    raise exception 'ledger_transaction_bad_status:%', tx.status;
  end if;

  if not exists (
    select 1 from public.audit_log
    where action='payment.yookassa_test_succeeded'
      and entity_type='payment'
      and entity_id=p.id::text
  ) then
    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,reason,metadata)
    values(p_actor_user_id,'payment.yookassa_test_succeeded','payment',p.id::text,'Verified against YooKassa API and reconciled locally',jsonb_build_object('order_id',o.id,'order_no',o.order_no,'external_payment_id',p.external_payment_id,'amount',p.amount,'currency',p.currency,'test_mode',true));
  end if;

  return jsonb_build_object('ok',true,'reconciled',true,'order_changed',changed_order,'order_id',o.id,'order_no',o.order_no,'payment_id',p.id,'ledger_transaction_id',tx.id,'debit_total',debit_total,'credit_total',credit_total);
end;
$$;

revoke all on function public.process_verified_yookassa_test_payment(uuid,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.process_verified_yookassa_test_payment(uuid,text,text,jsonb,uuid) to service_role;
