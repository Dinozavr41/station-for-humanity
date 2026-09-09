-- Alpha 1.2: turn the LeadBot pilot into a repeatable fleet product.

update public.factory_products
set name_ru='SFH MultiChannel LeadBot 1.2',
    name_en='SFH MultiChannel LeadBot 1.2',
    price_version=2,
    public_description_ru='Автоматический менеджер заявок для бизнеса. Telegram входит в базу; MAX и WhatsApp подключаются как дополнительные каналы и работают через единую MiniCRM.',
    public_description_en='Automated business lead manager. Telegram is included; MAX and WhatsApp can be connected as additional channels into one MiniCRM.',
    base_scope=coalesce(base_scope,'{}'::jsonb) || jsonb_build_object(
      'channels', jsonb_build_array('telegram'),
      'multichannel_ready', true,
      'canonical_minicrm', true
    ),
    updated_at=now()
where code='TGBOT_LEADS_V1';

insert into public.factory_pricing_rules(product_code,option_code,label_ru,label_en,input_kind,unit_price,max_quantity,active,sort_order)
select 'TGBOT_LEADS_V1','channel_max','Канал MAX','MAX channel','boolean',3000,1,true,5
where not exists (
  select 1 from public.factory_pricing_rules where product_code='TGBOT_LEADS_V1' and option_code='channel_max'
);

insert into public.factory_pricing_rules(product_code,option_code,label_ru,label_en,input_kind,unit_price,max_quantity,active,sort_order)
select 'TGBOT_LEADS_V1','channel_whatsapp','Канал WhatsApp Business','WhatsApp Business channel','boolean',5000,1,true,6
where not exists (
  select 1 from public.factory_pricing_rules where product_code='TGBOT_LEADS_V1' and option_code='channel_whatsapp'
);

create or replace function public.provision_leadbot_instance(p_factory_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.factory_requests%rowtype;
  o public.orders%rowtype;
  existing_id uuid;
  instance_id uuid;
  max_enabled boolean;
  whatsapp_enabled boolean;
  telegram_enabled boolean := true;
  channels jsonb;
  features jsonb;
  cfg jsonb;
  slug text;
begin
  select * into r from public.factory_requests where id=p_factory_request_id for update;
  if r.id is null then raise exception 'factory_request_not_found'; end if;
  if r.product_code <> 'TGBOT_LEADS_V1' then raise exception 'unsupported_product'; end if;
  if r.order_id is null then raise exception 'factory_order_missing'; end if;

  select id into existing_id from public.leadbot_instances where factory_request_id=r.id limit 1;
  if existing_id is not null then return existing_id; end if;

  select * into o from public.orders where id=r.order_id for update;
  if o.id is null then raise exception 'order_not_found'; end if;

  max_enabled := coalesce((r.selected_options->>'channel_max')::boolean,false);
  whatsapp_enabled := coalesce((r.selected_options->>'channel_whatsapp')::boolean,false);
  channels := jsonb_build_array('telegram');
  if max_enabled then channels := channels || '"max"'::jsonb; end if;
  if whatsapp_enabled then channels := channels || '"whatsapp"'::jsonb; end if;

  features := jsonb_build_object(
    'telegram', true,
    'max', max_enabled,
    'whatsapp', whatsapp_enabled,
    'google_sheets', coalesce((r.selected_options->>'google_sheets')::boolean,false),
    'crm_basic', coalesce((r.selected_options->>'crm_basic')::boolean,false),
    'webhook_api', coalesce((r.selected_options->>'webhook_api')::boolean,false),
    'ai_faq', coalesce((r.selected_options->>'ai_faq')::boolean,false),
    'calculator', coalesce((r.selected_options->>'calculator')::boolean,false),
    'extra_flow', coalesce((r.selected_options->>'extra_flow')::integer,0),
    'priority_48h', coalesce((r.selected_options->>'priority_48h')::boolean,false)
  );

  cfg := jsonb_build_object(
    'welcome', format('Здравствуйте! Это автоматический помощник %s. Помогу быстро оформить заявку. Выберите действие:', r.customer_name),
    'menu', jsonb_build_array(
      jsonb_build_object('code','lead','label','Оставить заявку'),
      jsonb_build_object('code','callback','label','Связаться с менеджером'),
      jsonb_build_object('code','faq','label','Задать вопрос')
    ),
    'flows', jsonb_build_object(
      'lead', jsonb_build_object(
        'title','Новая заявка',
        'questions', jsonb_build_array(
          jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
          jsonb_build_object('key','service','text','Какая услуга или товар вас интересует?','type','text'),
          jsonb_build_object('key','task','text','Коротко опишите задачу или желаемый результат.','type','text'),
          jsonb_build_object('key','location','text','Где находится объект или в каком городе нужна услуга?','type','text'),
          jsonb_build_object('key','deadline','text','Когда желательно получить результат?','type','text'),
          jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
        )
      ),
      'callback', jsonb_build_object(
        'title','Связаться с менеджером',
        'questions', jsonb_build_array(
          jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
          jsonb_build_object('key','comment','text','Что нужно обсудить с менеджером?','type','text'),
          jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
        )
      )
    ),
    'faq', jsonb_build_array(
      jsonb_build_object('q','Как оставить заявку?','a','Выберите «Оставить заявку», ответьте на несколько вопросов — менеджер получит заполненную карточку.'),
      jsonb_build_object('q','Когда со мной свяжутся?','a','После отправки заявки менеджер увидит её в Station MiniCRM и свяжется с вами по указанному контакту.')
    ),
    'calculator', jsonb_build_object('enabled',coalesce((r.selected_options->>'calculator')::boolean,false),'configured',false,'currency',r.currency),
    'product_spec', jsonb_build_object(
      'customer_name',r.customer_name,
      'business_type',r.business_type,
      'desired_result',r.desired_result,
      'channels',channels,
      'source','digital_factory_auto_provision'
    )
  );

  slug := format('ord-%s-leadbot', lpad(o.order_no::text,6,'0'));

  insert into public.leadbot_instances(
    order_id,factory_request_id,product_code,public_slug,status,business_name,business_type,config,features,readiness
  ) values (
    o.id,r.id,r.product_code,slug,'awaiting_credentials',r.customer_name,r.business_type,cfg,features,
    jsonb_build_object(
      'core_ready',false,'delivery_ready',false,
      'telegram_ready',false,'max_ready',false,'whatsapp_ready',false,
      'provisioned_at',now(),'channels',channels
    )
  ) returning id into instance_id;

  update public.orders
  set status=case when status in ('draft','quoted','awaiting_payment','paid') then 'in_production' else status end,
      specification=coalesce(specification,'{}'::jsonb) || jsonb_build_object(
        'production',jsonb_build_object(
          'module','SFH MultiChannel LeadBot 1.2',
          'instance_id',instance_id,
          'public_slug',slug,
          'channels',channels,
          'build_status','awaiting_channel_credentials',
          'auto_provisioned',true,
          'provisioned_at',now()
        )
      ),
      updated_at=now()
  where id=o.id;

  insert into public.order_events(order_id,event_type,from_status,to_status,reason,payload)
  values(
    o.id,'leadbot.auto_provisioned',o.status,
    case when o.status in ('draft','quoted','awaiting_payment','paid') then 'in_production' else o.status end,
    'Digital Factory automatically provisioned a multichannel LeadBot instance.',
    jsonb_build_object('instance_id',instance_id,'factory_request_id',r.id,'channels',channels,'features',features)
  );

  insert into public.audit_log(action,entity_type,entity_id,reason,metadata)
  values(
    'leadbot.auto_provisioned','leadbot_instance',instance_id::text,
    'Accepted Digital Factory request automatically provisioned.',
    jsonb_build_object('order_id',o.id,'order_no',o.order_no,'request_id',r.id,'request_no',r.request_no,'channels',channels)
  );

  return instance_id;
end;
$$;

revoke all on function public.provision_leadbot_instance(uuid) from public, anon, authenticated;
grant execute on function public.provision_leadbot_instance(uuid) to service_role;

create or replace function public.factory_request_auto_provision_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.status='accepted' and old.status is distinct from 'accepted' and new.product_code='TGBOT_LEADS_V1' then
    perform public.provision_leadbot_instance(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.factory_request_auto_provision_trigger() from public, anon, authenticated;

drop trigger if exists trg_factory_request_auto_provision on public.factory_requests;
create trigger trg_factory_request_auto_provision
after update of status on public.factory_requests
for each row execute function public.factory_request_auto_provision_trigger();
