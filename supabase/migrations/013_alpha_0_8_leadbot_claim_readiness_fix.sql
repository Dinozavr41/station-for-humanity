create or replace function public.leadbot_refresh_readiness(p_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  i public.leadbot_instances%rowtype;
  s jsonb;
  r jsonb;
  core_ready boolean;
  delivery_ready boolean;
  manager_ready boolean;
  sheets_ready boolean;
  crm_ready boolean;
  webhook_ready boolean;
  ai_ready boolean;
  calculator_ready boolean;
  claim_expires jsonb;
begin
  select * into i from public.leadbot_instances where id=p_instance_id for update;
  if i.id is null then raise exception 'leadbot_instance_not_found'; end if;
  s := public.leadbot_get_secrets(p_instance_id);
  core_ready := coalesce(length(s->>'bot_token')>20,false) and coalesce(length(s->>'webhook_secret')>=16,false);
  manager_ready := coalesce(length(s->>'manager_chat_id')>0,false);
  sheets_ready := not coalesce((i.features->>'google_sheets')::boolean,false) or coalesce(length(s->>'google_sheets_url')>0,false);
  crm_ready := not coalesce((i.features->>'crm_basic')::boolean,false) or coalesce(length(s->>'crm_url')>0,false);
  webhook_ready := not coalesce((i.features->>'webhook_api')::boolean,false) or coalesce(length(s->>'webhook_url')>0,false);
  ai_ready := not coalesce((i.features->>'ai_faq')::boolean,false) or (coalesce(length(s->>'ai_api_key')>0,false) and coalesce(length(s->>'ai_base_url')>0,false) and coalesce(length(s->>'ai_model')>0,false));
  calculator_ready := not coalesce((i.features->>'calculator')::boolean,false) or coalesce((i.config#>>'{calculator,configured}')::boolean,false);
  delivery_ready := core_ready and manager_ready and sheets_ready and crm_ready and webhook_ready and ai_ready and calculator_ready;
  claim_expires := i.readiness->'claim_expires_at';
  r := jsonb_build_object(
    'core_ready',core_ready,'delivery_ready',delivery_ready,
    'bot_token',coalesce(length(s->>'bot_token')>20,false),
    'webhook_secret',coalesce(length(s->>'webhook_secret')>=16,false),
    'manager_chat_id',manager_ready,
    'google_sheets',sheets_ready,'crm',crm_ready,'webhook_api',webhook_ready,'ai_faq',ai_ready,'calculator',calculator_ready,
    'checked_at',now()
  );
  if claim_expires is not null then r := r || jsonb_build_object('claim_expires_at',claim_expires); end if;
  update public.leadbot_instances
  set readiness=r,
      status=case when status in ('active','paused','qa','delivered','retired') then status when core_ready then 'ready' else 'awaiting_credentials' end
  where id=p_instance_id;
  return r;
end;
$$;

revoke all on function public.leadbot_refresh_readiness(uuid) from public, anon, authenticated;
grant execute on function public.leadbot_refresh_readiness(uuid) to service_role;