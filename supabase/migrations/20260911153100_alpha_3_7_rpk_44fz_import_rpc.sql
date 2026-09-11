-- Station RPK OS · guarded import from the official 44-FZ EIS radar.

create or replace function public.rpk_44fz_import_candidate(p_workspace_slug text, p_candidate jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_w public.rpk_workspaces%rowtype;
  v_registry public.business_workspace_registry%rowtype;
  v_role text;
  v_source_id uuid;
  v_opp_id uuid;
  v_calc_id uuid;
  v_title text := left(trim(coalesce(p_candidate->>'title','')),800);
  v_description text := left(trim(coalesce(p_candidate->>'description','')),12000);
  v_url text := left(trim(coalesce(p_candidate->>'source_url','')),2000);
  v_item text := nullif(left(trim(coalesce(p_candidate->>'purchase_number',p_candidate->>'id','')),500),'');
  v_category text := left(trim(coalesce(p_candidate->>'category','banner')),40);
  v_budget numeric;
  v_published timestamptz;
  v_deadline timestamptz;
  v_fingerprint text;
  v_result jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_w from public.rpk_workspaces where slug=p_workspace_slug;
  if v_w.id is null then raise exception 'WORKSPACE_NOT_FOUND'; end if;
  select * into v_registry from public.business_workspace_registry where source_kind='rpk' and source_workspace_id=v_w.id limit 1;
  if v_registry.id is null then raise exception 'WORKSPACE_REGISTRY_NOT_FOUND'; end if;

  select case when p.role in ('admin','operator') and p.status='active' then 'platform_admin' else m.role end
  into v_role
  from (select 1) x
  left join public.profiles p on p.id=v_user
  left join public.rpk_members m on m.workspace_id=v_w.id and m.user_id=v_user and m.status='active';
  if v_role not in ('platform_admin','owner','manager') then raise exception 'MANAGER_ROLE_REQUIRED'; end if;

  if length(v_title)<4 then raise exception 'TITLE_REQUIRED'; end if;
  if v_url !~ '^https://(www\.)?zakupki\.gov\.ru/' then raise exception 'OFFICIAL_EIS_URL_REQUIRED'; end if;
  if v_category not in ('signage','banner','outdoor','rim','stands','plates','print','branding') then v_category:='banner'; end if;

  begin
    if nullif(trim(coalesce(p_candidate->>'budget_max',p_candidate->>'budget_min','')),'') is not null then
      v_budget := replace(replace(coalesce(p_candidate->>'budget_max',p_candidate->>'budget_min'),' ',''),',','.')::numeric;
      if v_budget<0 then v_budget:=null; end if;
    end if;
  exception when others then v_budget:=null; end;
  begin v_published:=nullif(p_candidate->>'published_at','')::timestamptz; exception when others then v_published:=null; end;
  begin v_deadline:=nullif(p_candidate->>'deadline_at','')::timestamptz; exception when others then v_deadline:=null; end;

  insert into public.business_opportunity_sources(code,name,vertical_code,adapter_kind,base_url,active,polling_interval_minutes,config,terms_note,updated_at)
  values ('eis_44fz','ЕИС · 44-ФЗ','rpk','rss','https://zakupki.gov.ru',true,30,'{"law":"44-FZ","paid_commercial_platforms":false}'::jsonb,'Официальный публичный источник ЕИС. Только закупки по 44-ФЗ.',now())
  on conflict(code) do update set active=true,updated_at=now()
  returning id into v_source_id;

  v_fingerprint := md5('eis_44fz|'||coalesce(v_item,'')||'|'||v_url||'|'||lower(v_title));
  insert into public.business_opportunities(
    source_id,source_item_id,fingerprint,vertical_code,title,description,buyer_name,buyer_contact,city,region,source_url,published_at,deadline_at,
    budget_min,budget_max,currency,detected_services,normalized,raw_payload,parse_confidence,status,source_label,updated_at)
  values(
    v_source_id,v_item,v_fingerprint,'rpk',v_title,nullif(v_description,''),nullif(left(trim(coalesce(p_candidate->>'buyer_name','')),500),''),'{}'::jsonb,
    nullif(left(trim(coalesce(p_candidate->>'city','')),300),''),nullif(left(trim(coalesce(p_candidate->>'region','')),300),''),v_url,v_published,v_deadline,
    null,v_budget,'RUB',array[v_category]::text[],
    jsonb_build_object('law','44-FZ','source_platform','ЕИС','source_category',v_category,'official_source',true,'paid_commercial_platforms',false,'imported_from','rpk_44fz_radar'),
    jsonb_build_object('eis_rss',p_candidate),0.82,'open','ЕИС · 44-ФЗ',now())
  on conflict(fingerprint) do update set
    title=excluded.title,description=excluded.description,buyer_name=coalesce(excluded.buyer_name,public.business_opportunities.buyer_name),
    city=coalesce(excluded.city,public.business_opportunities.city),region=coalesce(excluded.region,public.business_opportunities.region),source_url=excluded.source_url,
    published_at=coalesce(excluded.published_at,public.business_opportunities.published_at),deadline_at=coalesce(excluded.deadline_at,public.business_opportunities.deadline_at),
    budget_max=coalesce(excluded.budget_max,public.business_opportunities.budget_max),normalized=public.business_opportunities.normalized||excluded.normalized,
    raw_payload=excluded.raw_payload,parse_confidence=greatest(public.business_opportunities.parse_confidence,excluded.parse_confidence),status='open',source_label='ЕИС · 44-ФЗ',updated_at=now()
  returning id into v_opp_id;

  insert into public.rpk_tender_calculations(workspace_id,opportunity_id,status,tender_price,currency,assumptions,created_by,updated_at)
  values(v_w.id,v_opp_id,'draft',v_budget,'RUB',jsonb_build_object(
    'law','44-FZ','source','ЕИС','official_source',true,'imported_from','rpk_44fz_radar','anti_dumping_threshold_pct',25,
    'require_human_signature',true,'purchase_number',v_item,'source_url',v_url,'category',v_category),v_user,now())
  on conflict(workspace_id,opportunity_id) do update set
    tender_price=coalesce(excluded.tender_price,public.rpk_tender_calculations.tender_price),
    assumptions=public.rpk_tender_calculations.assumptions||excluded.assumptions,updated_at=now()
  returning id into v_calc_id;

  insert into public.rpk_tender_cost_lines(calculation_id,line_no,line_type,item_name,specification,total_cost,required,include_in_total,cost_basis,confidence,evidence,notes,created_by)
  values
    (v_calc_id,1,'production','Изготовление / поставка по ТЗ','Разобрать позиции, материалы, размеры и тираж из документации',null,true,true,'estimate',0,'[]'::jsonb,'Обязательная строка: прибыль заблокирована до цены или подтверждённого 0 ₽',v_user),
    (v_calc_id,2,'design','Макет / предпечатная подготовка','Если не требуется — зафиксировать 0 ₽ и источник решения',null,true,true,'estimate',0,'[]'::jsonb,'Обязательная строка',v_user),
    (v_calc_id,3,'installation','Монтаж / установка','Если не требуется — зафиксировать 0 ₽. Иначе: адреса, высота, крепёж, спецтехника, допуски',null,true,true,'estimate',0,'[]'::jsonb,'Обязательная строка',v_user),
    (v_calc_id,4,'logistics','Логистика / доставка / выезды','Маршрут, число выездов, транспорт, упаковка',null,true,true,'estimate',0,'[]'::jsonb,'Обязательная строка',v_user),
    (v_calc_id,5,'platform_fee','Комиссия ЭТП / спецсчёта','Уточнить площадку и тариф победителя именно для этой закупки',null,true,true,'estimate',0,'[]'::jsonb,'Не считать автоматически нулём',v_user),
    (v_calc_id,6,'financing','Обеспечение / гарантия / оборотные деньги','Стоимость гарантии, замороженных средств и финансирования',null,true,true,'estimate',0,'[]'::jsonb,'Если затрат нет — 0 ₽ с подтверждением',v_user),
    (v_calc_id,7,'tax','Налоги / НДС','Указать реальную нагрузку по режиму компании',null,true,true,'estimate',0,'[]'::jsonb,'Обязательная строка',v_user)
  on conflict(calculation_id,line_no) do nothing;

  insert into public.business_opportunity_events(opportunity_id,workspace_registry_id,stage,event_type,actor_user_id,payload)
  values(v_opp_id,v_registry.id,'NORMALIZE','eis_44fz_imported',v_user,jsonb_build_object('purchase_number',v_item,'category',v_category,'calculation_id',v_calc_id));

  perform public.rpk_tender_recalculate(p_workspace_slug,v_calc_id);
  select jsonb_build_object('ok',true,'opportunity_id',v_opp_id,'calculation_id',v_calc_id,'law','44-FZ','source','ЕИС') into v_result;
  return v_result;
end$$;

revoke all on function public.rpk_44fz_import_candidate(text,jsonb) from public,anon;
grant execute on function public.rpk_44fz_import_candidate(text,jsonb) to authenticated;
