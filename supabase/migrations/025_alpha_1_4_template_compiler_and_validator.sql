-- Alpha 1.4: deterministic configuration compiler for repeatable client provisioning.
-- AI may suggest future drafts, but production config is compiled and validated by rules.

create or replace function public.leadbot_build_config(
  p_customer_name text,
  p_business_type text,
  p_desired_result text,
  p_selected_options jsonb,
  p_currency text
)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$
declare
  hay text := lower(coalesce(p_business_type,'') || ' ' || coalesce(p_desired_result,''));
  template_code text := 'generic_service';
  menu jsonb;
  flows jsonb;
  faq jsonb;
  calculator_enabled boolean := coalesce((p_selected_options->>'calculator')::boolean,false);
begin
  if hay ~ '(реклам|рпк|билборд|баннер|вывес|наружн)' then
    template_code := 'advertising';
    menu := jsonb_build_array(
      jsonb_build_object('code','placement','label','Разместить рекламу'),
      jsonb_build_object('code','production','label','Изготовить рекламу'),
      jsonb_build_object('code','callback','label','Связаться с менеджером'),
      jsonb_build_object('code','faq','label','Задать вопрос')
    );
    flows := jsonb_build_object(
      'placement',jsonb_build_object('title','Размещение рекламы','questions',jsonb_build_array(
        jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
        jsonb_build_object('key','format','text','Какой формат или вид размещения вас интересует?','type','text'),
        jsonb_build_object('key','location','text','Где желательно разместить рекламу: район, улица или направление?','type','text'),
        jsonb_build_object('key','period','text','На какой период или даты планируется размещение?','type','text'),
        jsonb_build_object('key','creative','text','Макет уже готов или требуется разработка?','type','text'),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      )),
      'production',jsonb_build_object('title','Изготовление рекламы','questions',jsonb_build_array(
        jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
        jsonb_build_object('key','product','text','Что нужно изготовить: баннер, вывеску, табличку или другое?','type','text'),
        jsonb_build_object('key','dimensions','text','Укажите примерные размеры и количество.','type','text'),
        jsonb_build_object('key','installation','text','Нужен монтаж?','type','choice','options',jsonb_build_array('Да','Нет','Нужно обсудить')),
        jsonb_build_object('key','deadline','text','К какому сроку нужен результат?','type','text'),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      )),
      'callback',jsonb_build_object('title','Связаться с менеджером','questions',jsonb_build_array(
        jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
        jsonb_build_object('key','comment','text','Что нужно обсудить?','type','text'),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      ))
    );
    faq := jsonb_build_array(
      jsonb_build_object('q','Сколько стоит размещение?','a','Стоимость зависит от поверхности, формата и периода. Менеджер подтвердит актуальную цену после заявки.'),
      jsonb_build_object('q','Какие поверхности свободны?','a','Доступность меняется. Оставьте район и даты — менеджер проверит актуальные варианты.')
    );

  elsif hay ~ '(автосервис|сто|ремонт авто|шиномонтаж|автомобил)' then
    template_code := 'auto_service';
    menu := jsonb_build_array(
      jsonb_build_object('code','service','label','Записаться на сервис'),
      jsonb_build_object('code','diagnostic','label','Описать неисправность'),
      jsonb_build_object('code','callback','label','Связаться с мастером'),
      jsonb_build_object('code','faq','label','Задать вопрос')
    );
    flows := jsonb_build_object(
      'service',jsonb_build_object('title','Запись на сервис','questions',jsonb_build_array(
        jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
        jsonb_build_object('key','car','text','Марка, модель и год автомобиля?','type','text'),
        jsonb_build_object('key','service','text','Какая услуга нужна?','type','text'),
        jsonb_build_object('key','preferred_time','text','Когда удобно приехать?','type','text'),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      )),
      'diagnostic',jsonb_build_object('title','Неисправность','questions',jsonb_build_array(
        jsonb_build_object('key','car','text','Марка, модель и год автомобиля?','type','text'),
        jsonb_build_object('key','symptoms','text','Опишите проблему или симптомы.','type','text'),
        jsonb_build_object('key','drivable','text','Автомобиль сейчас на ходу?','type','choice','options',jsonb_build_array('Да','Нет','Не уверен')),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      )),
      'callback',jsonb_build_object('title','Связаться с мастером','questions',jsonb_build_array(
        jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
        jsonb_build_object('key','comment','text','Что нужно обсудить?','type','text'),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      ))
    );
    faq := jsonb_build_array(
      jsonb_build_object('q','Можно узнать цену ремонта?','a','Точная стоимость зависит от диагностики и работ. Бот соберёт данные, мастер подтвердит расчёт.'),
      jsonb_build_object('q','Как записаться?','a','Выберите «Записаться на сервис», укажите автомобиль, услугу и удобное время.')
    );

  elsif hay ~ '(потолк|окн|двер|ремонт|строител|монтаж|отоплен|сантех|электр|ворот)' then
    template_code := 'construction_service';
    menu := jsonb_build_array(
      jsonb_build_object('code','estimate','label','Рассчитать / вызвать замерщика'),
      jsonb_build_object('code','service','label','Заказать работу'),
      jsonb_build_object('code','callback','label','Связаться с менеджером'),
      jsonb_build_object('code','faq','label','Задать вопрос')
    );
    flows := jsonb_build_object(
      'estimate',jsonb_build_object('title','Расчёт и замер','questions',jsonb_build_array(
        jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
        jsonb_build_object('key','service','text','Что нужно сделать?','type','text'),
        jsonb_build_object('key','object','text','Что за объект: квартира, дом, офис или другое?','type','text'),
        jsonb_build_object('key','dimensions','text','Укажите примерные размеры, площадь или объём работ.','type','text'),
        jsonb_build_object('key','location','text','Где находится объект?','type','text'),
        jsonb_build_object('key','deadline','text','Когда желательно выполнить работу?','type','text'),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      )),
      'service',jsonb_build_object('title','Заказать работу','questions',jsonb_build_array(
        jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
        jsonb_build_object('key','task','text','Коротко опишите задачу.','type','text'),
        jsonb_build_object('key','location','text','Где находится объект?','type','text'),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      )),
      'callback',jsonb_build_object('title','Связаться с менеджером','questions',jsonb_build_array(
        jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
        jsonb_build_object('key','comment','text','Что нужно обсудить?','type','text'),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      ))
    );
    faq := jsonb_build_array(
      jsonb_build_object('q','Можно получить предварительный расчёт?','a','Да. Бот соберёт исходные данные, а менеджер подтвердит расчёт после проверки.'),
      jsonb_build_object('q','Выезжаете на замер?','a','Оставьте адрес и задачу — менеджер подтвердит возможность и время выезда.')
    );

  elsif hay ~ '(мебел|кухн|шкаф|гардероб)' then
    template_code := 'furniture';
    menu := jsonb_build_array(
      jsonb_build_object('code','order','label','Рассчитать мебель'),
      jsonb_build_object('code','measure','label','Вызвать замерщика'),
      jsonb_build_object('code','callback','label','Связаться с менеджером'),
      jsonb_build_object('code','faq','label','Задать вопрос')
    );
    flows := jsonb_build_object(
      'order',jsonb_build_object('title','Расчёт мебели','questions',jsonb_build_array(
        jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
        jsonb_build_object('key','product','text','Что нужно: кухня, шкаф, гардеробная или другое?','type','text'),
        jsonb_build_object('key','dimensions','text','Укажите примерные размеры.','type','text'),
        jsonb_build_object('key','style','text','Есть пожелания по стилю, цвету или материалам?','type','text'),
        jsonb_build_object('key','budget','text','Есть ориентир по бюджету?','type','text'),
        jsonb_build_object('key','location','text','Где находится объект?','type','text'),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      )),
      'measure',jsonb_build_object('title','Вызов замерщика','questions',jsonb_build_array(
        jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
        jsonb_build_object('key','product','text','Что планируете заказать?','type','text'),
        jsonb_build_object('key','location','text','Адрес или район объекта?','type','text'),
        jsonb_build_object('key','preferred_time','text','Когда удобно принять замерщика?','type','text'),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      )),
      'callback',jsonb_build_object('title','Связаться с менеджером','questions',jsonb_build_array(
        jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
        jsonb_build_object('key','comment','text','Что нужно обсудить?','type','text'),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      ))
    );
    faq := jsonb_build_array(
      jsonb_build_object('q','Можно посчитать стоимость?','a','Бот соберёт размеры и пожелания. Менеджер подготовит предварительный расчёт.'),
      jsonb_build_object('q','Можно вызвать замерщика?','a','Да. Выберите соответствующий пункт и оставьте адрес, время и контакт.')
    );

  else
    menu := jsonb_build_array(
      jsonb_build_object('code','lead','label','Оставить заявку'),
      jsonb_build_object('code','callback','label','Связаться с менеджером'),
      jsonb_build_object('code','faq','label','Задать вопрос')
    );
    flows := jsonb_build_object(
      'lead',jsonb_build_object('title','Новая заявка','questions',jsonb_build_array(
        jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
        jsonb_build_object('key','service','text','Какая услуга или товар вас интересует?','type','text'),
        jsonb_build_object('key','task','text','Коротко опишите задачу или желаемый результат.','type','text'),
        jsonb_build_object('key','location','text','В каком городе или где нужна услуга?','type','text'),
        jsonb_build_object('key','deadline','text','Когда желательно получить результат?','type','text'),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      )),
      'callback',jsonb_build_object('title','Связаться с менеджером','questions',jsonb_build_array(
        jsonb_build_object('key','name','text','Как к вам обращаться?','type','text'),
        jsonb_build_object('key','comment','text','Что нужно обсудить?','type','text'),
        jsonb_build_object('key','contact','text','Оставьте телефон или удобный способ связи.','type','text')
      ))
    );
    faq := jsonb_build_array(
      jsonb_build_object('q','Как оставить заявку?','a','Выберите «Оставить заявку» и ответьте на несколько вопросов — менеджер получит карточку.'),
      jsonb_build_object('q','Когда со мной свяжутся?','a','Менеджер увидит заявку в Station MiniCRM и свяжется по указанному контакту.')
    );
  end if;

  return jsonb_build_object(
    'welcome',format('Здравствуйте! Это автоматический помощник %s. Помогу быстро оформить обращение. Выберите действие:',coalesce(nullif(trim(p_customer_name),''),'компании')),
    'menu',menu,
    'flows',flows,
    'faq',faq,
    'calculator',jsonb_build_object('enabled',calculator_enabled,'configured',false,'currency',coalesce(nullif(p_currency,''),'RUB')),
    'product_spec',jsonb_build_object(
      'customer_name',p_customer_name,
      'business_type',p_business_type,
      'desired_result',p_desired_result,
      'template_code',template_code,
      'compiler','deterministic_v1',
      'source','digital_factory_template_compiler'
    )
  );
end;
$$;

create or replace function public.leadbot_validate_config(p_config jsonb)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$
declare
  errors jsonb := '[]'::jsonb;
  item jsonb;
  flow_item jsonb;
  q jsonb;
  code text;
  has_contact boolean := false;
begin
  if jsonb_typeof(p_config) <> 'object' then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('config_not_object'));
  end if;
  if length(coalesce(p_config->>'welcome','')) < 10 then errors := errors || '"welcome_missing"'::jsonb; end if;
  if jsonb_typeof(p_config->'menu') <> 'array' or jsonb_array_length(p_config->'menu') < 2 or jsonb_array_length(p_config->'menu') > 10 then
    errors := errors || '"menu_invalid"'::jsonb;
  end if;
  if jsonb_typeof(p_config->'flows') <> 'object' then
    errors := errors || '"flows_invalid"'::jsonb;
  else
    for code, flow_item in select key,value from jsonb_each(p_config->'flows') loop
      if code !~ '^[a-z][a-z0-9_]{1,40}$' then errors := errors || to_jsonb('bad_flow_code:'||code); end if;
      if jsonb_typeof(flow_item->'questions') <> 'array' or jsonb_array_length(flow_item->'questions') < 1 or jsonb_array_length(flow_item->'questions') > 12 then
        errors := errors || to_jsonb('questions_invalid:'||code);
      else
        for q in select value from jsonb_array_elements(flow_item->'questions') loop
          if coalesce(q->>'key','') !~ '^[a-z][a-z0-9_]{1,40}$' then errors := errors || to_jsonb('bad_question_key:'||code); end if;
          if length(coalesce(q->>'text','')) < 5 then errors := errors || to_jsonb('question_text_missing:'||code); end if;
          if coalesce(q->>'type','') not in ('text','number','choice') then errors := errors || to_jsonb('question_type_invalid:'||code); end if;
          if q->>'key' = 'contact' then has_contact := true; end if;
          if q->>'type'='choice' and (jsonb_typeof(q->'options') <> 'array' or jsonb_array_length(q->'options') < 2 or jsonb_array_length(q->'options') > 12) then
            errors := errors || to_jsonb('choice_options_invalid:'||code);
          end if;
        end loop;
      end if;
    end loop;
  end if;
  if not has_contact then errors := errors || '"contact_question_missing"'::jsonb; end if;
  if jsonb_typeof(p_config->'faq') <> 'array' then errors := errors || '"faq_invalid"'::jsonb; end if;

  return jsonb_build_object('valid',jsonb_array_length(errors)=0,'errors',errors);
end;
$$;

create or replace function public.leadbot_compile_new_instance_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.factory_requests%rowtype;
  compiled jsonb;
  validation jsonb;
begin
  if new.product_code <> 'TGBOT_LEADS_V1' or new.factory_request_id is null then return new; end if;
  select * into r from public.factory_requests where id=new.factory_request_id;
  if r.id is null then raise exception 'factory_request_not_found_for_compile'; end if;

  compiled := public.leadbot_build_config(r.customer_name,r.business_type,r.desired_result,r.selected_options,r.currency);
  validation := public.leadbot_validate_config(compiled);
  if not coalesce((validation->>'valid')::boolean,false) then
    raise exception 'leadbot_generated_config_invalid:%', validation->'errors';
  end if;

  new.config := compiled;
  new.readiness := coalesce(new.readiness,'{}'::jsonb) || jsonb_build_object(
    'config_valid',true,
    'config_compiler','deterministic_v1',
    'template_code',compiled#>>'{product_spec,template_code}'
  );
  return new;
end;
$$;

revoke all on function public.leadbot_build_config(text,text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.leadbot_validate_config(jsonb) from public, anon, authenticated;
revoke all on function public.leadbot_compile_new_instance_trigger() from public, anon, authenticated;
grant execute on function public.leadbot_build_config(text,text,text,jsonb,text) to service_role;
grant execute on function public.leadbot_validate_config(jsonb) to service_role;

drop trigger if exists trg_leadbot_compile_new_instance on public.leadbot_instances;
create trigger trg_leadbot_compile_new_instance
before insert on public.leadbot_instances
for each row execute function public.leadbot_compile_new_instance_trigger();
