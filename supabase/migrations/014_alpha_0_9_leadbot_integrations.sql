-- Alpha 0.9 — LeadBot integration layer: protected Google Sheets pull feed,
-- built-in SFH MiniCRM, protected client API readiness and outbox normalization.

create or replace function public.leadbot_store_secret(p_instance_id uuid, p_kind text, p_value text)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  allowed text[] := array['bot_token','webhook_secret','manager_chat_id','manager_claim_code','google_sheets_url','google_sheets_token','crm_url','crm_token','webhook_url','webhook_token','ai_api_key','ai_base_url','ai_model'];
  secret_name text;
  sid uuid;
begin
  if p_instance_id is null or not exists(select 1 from public.leadbot_instances where id=p_instance_id) then raise exception 'leadbot_instance_not_found'; end if;
  if not (p_kind = any(allowed)) then raise exception 'unsupported_secret_kind'; end if;
  if p_value is null or length(trim(p_value))=0 or length(p_value)>10000 then raise exception 'invalid_secret_value'; end if;
  secret_name := 'leadbot_' || replace(p_instance_id::text,'-','') || '_' || p_kind;
  select id into sid from vault.secrets where name=secret_name limit 1;
  if sid is null then perform vault.create_secret(p_value,secret_name,'Station for Humanity LeadBot secret',null);
  else perform vault.update_secret(sid,p_value,secret_name,'Station for Humanity LeadBot secret',null); end if;
  return true;
end;
$$;
revoke all on function public.leadbot_store_secret(uuid,text,text) from public,anon,authenticated;
grant execute on function public.leadbot_store_secret(uuid,text,text) to service_role;

create or replace function public.leadbot_refresh_readiness(p_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare i public.leadbot_instances%rowtype; s jsonb; r jsonb; core_ready boolean; delivery_ready boolean; manager_ready boolean; sheets_ready boolean; crm_ready boolean; webhook_ready boolean; ai_ready boolean; calculator_ready boolean; claim_expires jsonb;
begin
  select * into i from public.leadbot_instances where id=p_instance_id for update;
  if i.id is null then raise exception 'leadbot_instance_not_found'; end if;
  s := public.leadbot_get_secrets(p_instance_id);
  core_ready := coalesce(length(s->>'bot_token')>20,false) and coalesce(length(s->>'webhook_secret')>=16,false);
  manager_ready := coalesce(length(s->>'manager_chat_id')>0,false);
  sheets_ready := not coalesce((i.features->>'google_sheets')::boolean,false)
                  or (coalesce(i.config#>>'{sheets,mode}','')='pull_feed_v1' and coalesce(length(s->>'google_sheets_token')>20,false))
                  or coalesce(length(s->>'google_sheets_url')>0,false);
  crm_ready := not coalesce((i.features->>'crm_basic')::boolean,false) or coalesce(i.config#>>'{crm,mode}','')='internal_sfh_v1' or coalesce(length(s->>'crm_url')>0,false);
  webhook_ready := not coalesce((i.features->>'webhook_api')::boolean,false) or (coalesce((i.config#>>'{api,enabled}')::boolean,false) and coalesce(length(s->>'webhook_token')>20,false)) or coalesce(length(s->>'webhook_url')>0,false);
  ai_ready := not coalesce((i.features->>'ai_faq')::boolean,false) or (coalesce(length(s->>'ai_api_key')>0,false) and coalesce(length(s->>'ai_base_url')>0,false) and coalesce(length(s->>'ai_model')>0,false));
  calculator_ready := not coalesce((i.features->>'calculator')::boolean,false) or coalesce((i.config#>>'{calculator,configured}')::boolean,false);
  delivery_ready := core_ready and manager_ready and sheets_ready and crm_ready and webhook_ready and ai_ready and calculator_ready;
  claim_expires := i.readiness->'claim_expires_at';
  r := jsonb_build_object('core_ready',core_ready,'delivery_ready',delivery_ready,'bot_token',coalesce(length(s->>'bot_token')>20,false),'webhook_secret',coalesce(length(s->>'webhook_secret')>=16,false),'manager_chat_id',manager_ready,'google_sheets',sheets_ready,'crm',crm_ready,'webhook_api',webhook_ready,'ai_faq',ai_ready,'calculator',calculator_ready,'checked_at',now());
  if claim_expires is not null then r := r || jsonb_build_object('claim_expires_at',claim_expires); end if;
  update public.leadbot_instances set readiness=r,status=case when status in ('active','paused','qa','delivered','retired') then status when core_ready then 'ready' else 'awaiting_credentials' end where id=p_instance_id;
  return r;
end;
$$;
revoke all on function public.leadbot_refresh_readiness(uuid) from public,anon,authenticated;
grant execute on function public.leadbot_refresh_readiness(uuid) to service_role;

create or replace function public.leadbot_outbox_pull_feed_normalize()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare mode text; api_enabled boolean;
begin
  if new.sink='google_sheets' then
    select config#>>'{sheets,mode}' into mode from public.leadbot_instances where id=new.instance_id;
    if mode='pull_feed_v1' then
      new.status:='succeeded'; new.last_error:=null; new.response:=jsonb_build_object('mode','pull_feed_v1','note','Google Sheet reads canonical leads from protected SFH feed');
    end if;
  elsif new.sink='crm' then
    select config#>>'{crm,mode}' into mode from public.leadbot_instances where id=new.instance_id;
    if mode='internal_sfh_v1' then
      new.status:='succeeded'; new.last_error:=null; new.response:=jsonb_build_object('mode','internal_sfh_v1','note','Lead persisted in SFH MiniCRM');
    end if;
  elsif new.sink='webhook' then
    select coalesce((config#>>'{api,enabled}')::boolean,false) into api_enabled from public.leadbot_instances where id=new.instance_id;
    if api_enabled then
      new.status:='succeeded'; new.last_error:=null; new.response:=jsonb_build_object('mode','client_api_v1','note','Lead exposed through protected read-only SFH client API; outbound webhook optional');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leadbot_outbox_pull_feed_normalize on public.leadbot_outbox;
create trigger trg_leadbot_outbox_pull_feed_normalize before insert or update on public.leadbot_outbox for each row execute function public.leadbot_outbox_pull_feed_normalize();
