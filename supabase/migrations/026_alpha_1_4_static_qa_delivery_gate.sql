-- Alpha 1.4: every readiness refresh runs deterministic config QA.
-- A bot cannot become delivery_ready with an invalid configuration.

create or replace function public.leadbot_static_qa(p_config jsonb)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$
declare
  base jsonb;
  errors jsonb;
  m jsonb;
  code text;
begin
  base := public.leadbot_validate_config(p_config);
  errors := coalesce(base->'errors','[]'::jsonb);

  if jsonb_typeof(p_config->'menu')='array' and jsonb_typeof(p_config->'flows')='object' then
    for m in select value from jsonb_array_elements(p_config->'menu') loop
      code := coalesce(m->>'code','');
      if length(coalesce(m->>'label','')) < 2 then
        errors := errors || to_jsonb('menu_label_missing:'||code);
      end if;
      if code <> 'faq' and not (p_config->'flows' ? code) then
        errors := errors || to_jsonb('menu_flow_missing:'||code);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'passed',jsonb_array_length(errors)=0,
    'errors',errors,
    'template_code',p_config#>>'{product_spec,template_code}',
    'compiler',p_config#>>'{product_spec,compiler}'
  );
end;
$$;

revoke all on function public.leadbot_static_qa(jsonb) from public, anon, authenticated;
grant execute on function public.leadbot_static_qa(jsonb) to service_role;

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
  qa jsonb;
  qa_static_passed boolean;
  core_ready boolean;
  channels_ready boolean;
  telegram_requested boolean;
  max_requested boolean;
  whatsapp_requested boolean;
  telegram_ready boolean;
  max_ready boolean;
  whatsapp_ready boolean;
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
  qa := public.leadbot_static_qa(i.config);
  qa_static_passed := coalesce((qa->>'passed')::boolean,false);

  telegram_requested := case when i.features ? 'telegram' then coalesce((i.features->>'telegram')::boolean,false) else true end;
  max_requested := coalesce((i.features->>'max')::boolean,false);
  whatsapp_requested := coalesce((i.features->>'whatsapp')::boolean,false);

  telegram_ready := coalesce(length(s->>'bot_token')>20,false) and coalesce(length(s->>'webhook_secret')>=16,false);
  max_ready := coalesce(length(s->>'max_bot_token')>20,false) and coalesce(length(s->>'max_webhook_secret')>=5,false);
  whatsapp_ready := coalesce(length(s->>'whatsapp_access_token')>20,false)
                    and coalesce(length(s->>'whatsapp_app_secret')>=8,false)
                    and coalesce(length(s->>'whatsapp_verify_token')>=8,false)
                    and coalesce(length(s->>'whatsapp_phone_number_id')>0,false)
                    and coalesce(length(s->>'whatsapp_waba_id')>0,false)
                    and coalesce(length(s->>'whatsapp_graph_version')>=3,false);

  core_ready := telegram_ready or max_ready or whatsapp_ready;
  channels_ready := (not telegram_requested or telegram_ready)
                    and (not max_requested or max_ready)
                    and (not whatsapp_requested or whatsapp_ready);

  manager_ready := coalesce(length(s->>'manager_chat_id')>0,false)
                   or coalesce(length(s->>'max_manager_user_id')>0,false)
                   or coalesce(length(s->>'max_manager_chat_id')>0,false)
                   or coalesce(length(s->>'whatsapp_manager_phone')>0,false);
  sheets_ready := not coalesce((i.features->>'google_sheets')::boolean,false) or coalesce(length(s->>'google_sheets_url')>0,false);
  crm_ready := not coalesce((i.features->>'crm_basic')::boolean,false) or coalesce(length(s->>'crm_url')>0,false);
  webhook_ready := not coalesce((i.features->>'webhook_api')::boolean,false) or coalesce(length(s->>'webhook_url')>0,false);
  ai_ready := not coalesce((i.features->>'ai_faq')::boolean,false) or (
    coalesce(length(s->>'ai_api_key')>0,false) and coalesce(length(s->>'ai_base_url')>0,false) and coalesce(length(s->>'ai_model')>0,false)
  );
  calculator_ready := not coalesce((i.features->>'calculator')::boolean,false) or coalesce((i.config#>>'{calculator,configured}')::boolean,false);

  delivery_ready := qa_static_passed and channels_ready and manager_ready and sheets_ready and crm_ready and webhook_ready and ai_ready and calculator_ready;
  claim_expires := i.readiness->'claim_expires_at';

  r := jsonb_build_object(
    'core_ready',core_ready,
    'channels_ready',channels_ready,
    'delivery_ready',delivery_ready,
    'qa_static_passed',qa_static_passed,
    'qa_errors',coalesce(qa->'errors','[]'::jsonb),
    'config_valid',qa_static_passed,
    'config_compiler',qa->>'compiler',
    'template_code',qa->>'template_code',
    'telegram_requested',telegram_requested,
    'max_requested',max_requested,
    'whatsapp_requested',whatsapp_requested,
    'telegram_ready',telegram_ready,
    'max_ready',max_ready,
    'whatsapp_ready',whatsapp_ready,
    'bot_token',coalesce(length(s->>'bot_token')>20,false),
    'webhook_secret',coalesce(length(s->>'webhook_secret')>=16,false),
    'max_bot_token',coalesce(length(s->>'max_bot_token')>20,false),
    'max_webhook_secret',coalesce(length(s->>'max_webhook_secret')>=5,false),
    'whatsapp_access_token',coalesce(length(s->>'whatsapp_access_token')>20,false),
    'whatsapp_app_secret',coalesce(length(s->>'whatsapp_app_secret')>=8,false),
    'whatsapp_verify_token',coalesce(length(s->>'whatsapp_verify_token')>=8,false),
    'whatsapp_phone_number_id',coalesce(length(s->>'whatsapp_phone_number_id')>0,false),
    'whatsapp_waba_id',coalesce(length(s->>'whatsapp_waba_id')>0,false),
    'whatsapp_graph_version',coalesce(length(s->>'whatsapp_graph_version')>=3,false),
    'manager_chat_id',coalesce(length(s->>'manager_chat_id')>0,false),
    'max_manager',coalesce(length(s->>'max_manager_user_id')>0,false) or coalesce(length(s->>'max_manager_chat_id')>0,false),
    'whatsapp_manager',coalesce(length(s->>'whatsapp_manager_phone')>0,false),
    'google_sheets',sheets_ready,
    'crm',crm_ready,
    'webhook_api',webhook_ready,
    'ai_faq',ai_ready,
    'calculator',calculator_ready,
    'checked_at',now()
  );
  if claim_expires is not null then r := r || jsonb_build_object('claim_expires_at',claim_expires); end if;

  update public.leadbot_instances
  set readiness=r,
      status=case
        when status in ('active','paused','qa','delivered','retired') then status
        when channels_ready and qa_static_passed then 'ready'
        else 'awaiting_credentials'
      end
  where id=p_instance_id;
  return r;
end;
$$;

revoke all on function public.leadbot_refresh_readiness(uuid) from public, anon, authenticated;
grant execute on function public.leadbot_refresh_readiness(uuid) to service_role;

do $$
declare x record;
begin
  for x in select id from public.leadbot_instances loop
    perform public.leadbot_refresh_readiness(x.id);
  end loop;
end $$;
