-- Station RPK OS · 44-FZ Tender Desk
-- Official EIS-only combat contour. Commercial/223-FZ opportunities stay outside this module.

insert into public.business_opportunity_sources(code,name,vertical_code,adapter_kind,base_url,active,polling_interval_minutes,config,terms_note,updated_at)
values ('eis_44fz','ЕИС · 44-ФЗ','rpk','rss','https://zakupki.gov.ru',true,30,'{"law":"44-FZ","paid_commercial_platforms":false}'::jsonb,'Официальный публичный источник ЕИС. Боевой контур Station принимает здесь только закупки по 44-ФЗ.',now())
on conflict (code) do update set
  name=excluded.name,vertical_code=excluded.vertical_code,adapter_kind=excluded.adapter_kind,base_url=excluded.base_url,
  active=true,polling_interval_minutes=excluded.polling_interval_minutes,config=excluded.config,terms_note=excluded.terms_note,updated_at=now();

insert into public.rpk_modules(code,name,description,category,default_enabled,sort_order,dependencies,settings_schema)
values ('tender_44fz','Тендеры 44-ФЗ','Боевой радар ЕИС: поиск только 44-ФЗ, импорт в расчёт, STOP PRICE и решение владельца.','growth',true,30,array['opportunities','tender_economics']::text[],'{}'::jsonb)
on conflict (code) do update set
  name=excluded.name,description=excluded.description,category=excluded.category,default_enabled=true,
  sort_order=excluded.sort_order,dependencies=excluded.dependencies;

insert into public.rpk_workspace_modules(workspace_id,module_code,enabled,enabled_at)
select w.id,'tender_44fz',true,now() from public.rpk_workspaces w where w.slug='focus-biysk'
on conflict (workspace_id,module_code) do update set enabled=true,enabled_at=coalesce(public.rpk_workspace_modules.enabled_at,now()),disabled_at=null;

update public.business_opportunity_profiles p
set settings=coalesce(p.settings,'{}'::jsonb) || jsonb_build_object(
  'tender_policy',jsonb_build_object('laws',jsonb_build_array('44-FZ'),'official_eis_only',true,'paid_commercial_platforms',false)
),updated_at=now()
from public.business_workspace_registry r
where p.workspace_registry_id=r.id and r.slug='focus-biysk';
