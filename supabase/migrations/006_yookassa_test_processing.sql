-- Alpha 0.4 — YooKassa TEST verified payment processing
-- This migration mirrors the production Supabase migration applied on 2026-09-08.

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
  tx_id uuid;
  debit_account uuid;
  credit_account uuid;
begin
  select * into p from public.payments where id = p_payment_id for update;
  if p.id is null then raise exception 'payment_not_found'; end if;
  if p.provider <> 'yookassa_test' or p.test_mode is not true then raise exception 'not_yookassa_test_payment'; end if;
  if p.external_payment_id is distinct from p_external_payment_id then raise exception 'external_payment_mismatch'; end if;

  select * into o from public.orders where id = p.order_id for update;
  if o.id is null then raise exception 'order_not_found'; end if;
  if o.test_mode is not true then raise exception 'live_order_blocked'; end if;

  if p.canonical_status = 'succeeded' then
    select id into tx_id from public.ledger_transactions where transaction_key = 'yookassa-test:' || p.external_payment_id;
    return jsonb_build_object('ok',true,'idempotent',true,'order_id',o.id,'order_no',o.order_no,'payment_id',p.id,'ledger_transaction_id',tx_id);
  end if;

  update public.payments
  set canonical_status='succeeded', provider_status=p_provider_status, provider_payload=p_provider_payload, updated_at=now()
  where id=p.id;

  if o.status in ('quoted','awaiting_payment') then
    update public.orders set status='paid', updated_at=now() where id=o.id;
    insert into public.order_events(order_id,event_type,from_status,to_status,actor_user_id,reason,payload)
    values(o.id,'payment.succeeded',o.status,'paid',p_actor_user_id,'Verified YooKassa TEST payment',jsonb_build_object('payment_id',p.id,'external_payment_id',p.external_payment_id,'provider','yookassa_test','test_mode',true));
  elsif o.status <> 'paid' then
    raise exception 'order_not_payable_status:%', o.status;
  end if;

  insert into public.ledger_transactions(transaction_key,source_type,source_id,description,status,occurred_at,created_by)
  values('yookassa-test:' || p.external_payment_id,'payment',p.id,'Verified YooKassa TEST payment for order #' || o.order_no,'draft',now(),p_actor_user_id)
  on conflict (transaction_key) do nothing
  returning id into tx_id;

  if tx_id is null then
    select id into tx_id from public.ledger_transactions where transaction_key='yookassa-test:' || p.external_payment_id;
  else
    select id into debit_account from public.ledger_accounts where code='asset.provider_receivable';
    select id into credit_account from public.ledger_accounts where code='revenue.customer';
    if debit_account is null or credit_account is null then raise exception 'ledger_accounts_missing'; end if;

    insert into public.ledger_entries(transaction_id,account_id,direction,amount,currency,metadata)
    values
      (tx_id,debit_account,'debit',p.amount,p.currency,jsonb_build_object('provider','yookassa_test','external_payment_id',p.external_payment_id,'test_mode',true)),
      (tx_id,credit_account,'credit',p.amount,p.currency,jsonb_build_object('provider','yookassa_test','external_payment_id',p.external_payment_id,'test_mode',true));

    update public.ledger_transactions set status='posted',posted_at=now() where id=tx_id;
  end if;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,reason,metadata)
  values(p_actor_user_id,'payment.yookassa_test_succeeded','payment',p.id::text,'Verified against YooKassa API',jsonb_build_object('order_id',o.id,'order_no',o.order_no,'external_payment_id',p.external_payment_id,'amount',p.amount,'currency',p.currency,'test_mode',true));

  return jsonb_build_object('ok',true,'idempotent',false,'order_id',o.id,'order_no',o.order_no,'payment_id',p.id,'ledger_transaction_id',tx_id);
end;
$$;

revoke all on function public.process_verified_yookassa_test_payment(uuid,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.process_verified_yookassa_test_payment(uuid,text,text,jsonb,uuid) to service_role;
