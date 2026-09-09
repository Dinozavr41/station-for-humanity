-- Alpha 1.4: one atomic server transaction for accept -> provision -> onboarding handoff.

create or replace function public.accept_factory_leadbot_request(
  p_request_id uuid,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.factory_requests%rowtype;
  i public.leadbot_instances%rowtype;
  raw_token text;
  token_hash text;
  expires timestamptz;
  link_id uuid;
begin
  select * into r from public.factory_requests where id=p_request_id for update;
  if r.id is null then raise exception 'request_not_found'; end if;
  if r.product_code <> 'TGBOT_LEADS_V1' then raise exception 'unsupported_product'; end if;
  if r.status not in ('quoted','submitted','review') then raise exception 'invalid_transition:%',r.status; end if;

  update public.factory_requests
  set status='accepted',updated_at=now()
  where id=r.id;

  -- AFTER UPDATE trigger provisions the LeadBot synchronously in this transaction.
  select * into i from public.leadbot_instances where factory_request_id=r.id limit 1;
  if i.id is null then raise exception 'leadbot_auto_provision_missing'; end if;

  update public.leadbot_onboarding_links
  set status='revoked'
  where instance_id=i.id and status='active';

  raw_token := encode(extensions.gen_random_bytes(32),'hex');
  token_hash := encode(extensions.digest(raw_token,'sha256'),'hex');
  expires := now() + interval '72 hours';

  insert into public.leadbot_onboarding_links(
    instance_id,token_hash,status,expires_at,created_by,metadata
  ) values (
    i.id,token_hash,'active',expires,p_actor_user_id,
    jsonb_build_object(
      'created_from','factory_accept_atomic',
      'request_no',r.request_no,
      'order_id',i.order_id,
      'public_slug',i.public_slug
    )
  ) returning id into link_id;

  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,reason,metadata)
  values(
    p_actor_user_id,'factory.request_accepted','factory_request',r.id::text,
    'Factory request accepted; LeadBot auto-provisioned and customer onboarding handoff created atomically.',
    jsonb_build_object(
      'request_no',r.request_no,
      'order_id',i.order_id,
      'instance_id',i.id,
      'link_id',link_id,
      'expires_at',expires,
      'template_code',i.config#>>'{product_spec,template_code}',
      'config_compiler',i.config#>>'{product_spec,compiler}'
    )
  );

  return jsonb_build_object(
    'request_id',r.id,
    'request_no',r.request_no,
    'instance_id',i.id,
    'public_slug',i.public_slug,
    'template_code',i.config#>>'{product_spec,template_code}',
    'raw_token',raw_token,
    'link_id',link_id,
    'expires_at',expires
  );
end;
$$;

revoke all on function public.accept_factory_leadbot_request(uuid,uuid) from public, anon, authenticated;
grant execute on function public.accept_factory_leadbot_request(uuid,uuid) to service_role;
