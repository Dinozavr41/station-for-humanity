create or replace function public.rpk_dashboard_snapshot(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_clients integer := 0;
  v_archive integer := 0;
  v_unindexed integer := 0;
  v_jobs integer := 0;
  v_blocked_jobs integer := 0;
  v_deals integer := 0;
  v_pipeline numeric := 0;
  v_margin numeric := 0;
  v_overdue integer := 0;
  v_cash_in numeric := 0;
  v_cash_out numeric := 0;
  v_unpaid_invoices integer := 0;
  v_suppliers integer := 0;
  v_low_stock integer := 0;
  v_profile_verified boolean := false;
  v_cash_entries integer := 0;
  v_leadbot_enabled boolean := false;
  v_inventory_enabled boolean := false;
  v_cashflow_enabled boolean := false;
  v_suppliers_enabled boolean := false;
  v_recs jsonb := '[]'::jsonb;
begin
  if p_workspace_id is null or not exists(select 1 from public.rpk_workspaces where id=p_workspace_id) then
    raise exception 'rpk_workspace_not_found';
  end if;

  select count(*) into v_clients from public.rpk_clients where workspace_id=p_workspace_id and status='active';
  select count(*), count(*) filter (where status not in ('indexed','ready')) into v_archive,v_unindexed from public.rpk_legacy_artworks where workspace_id=p_workspace_id;
  select count(*) filter (where status not in ('print_ready','canceled')),
         count(*) filter (where status='blocked')
    into v_jobs,v_blocked_jobs
  from public.design_jobs where workspace_id=p_workspace_id;

  select count(*) filter (where stage not in ('won','lost')),
         coalesce(sum(amount) filter (where stage not in ('won','lost')),0),
         coalesce(sum(margin_estimate) filter (where stage not in ('won','lost')),0),
         count(*) filter (where stage not in ('won','lost') and next_action_at is not null and next_action_at < now())
    into v_deals,v_pipeline,v_margin,v_overdue
  from public.rpk_deals where workspace_id=p_workspace_id;

  select coalesce(sum(amount) filter (where direction='in'),0),
         coalesce(sum(amount) filter (where direction='out'),0),
         count(*)
    into v_cash_in,v_cash_out,v_cash_entries
  from public.rpk_cash_entries
  where workspace_id=p_workspace_id
    and occurred_on >= date_trunc('month',current_date)::date
    and occurred_on < (date_trunc('month',current_date)+interval '1 month')::date;

  select count(*) into v_unpaid_invoices
  from public.rpk_documents
  where workspace_id=p_workspace_id and document_type='invoice' and status in ('issued','sent','accepted');

  select count(*) into v_suppliers from public.rpk_suppliers where workspace_id=p_workspace_id and status='active';

  select count(*) into v_low_stock
  from public.rpk_stock_balances b
  join public.rpk_catalog_items i on i.id=b.catalog_item_id
  where b.workspace_id=p_workspace_id and i.active=true and i.track_stock=true and (b.qty-b.reserved_qty)<=0;

  select exists(select 1 from public.design_print_profiles where workspace_id=p_workspace_id and active=true and verified_at is not null)
    into v_profile_verified;

  select coalesce((select enabled from public.rpk_workspace_modules where workspace_id=p_workspace_id and module_code='leadbot'),false),
         coalesce((select enabled from public.rpk_workspace_modules where workspace_id=p_workspace_id and module_code='inventory'),false),
         coalesce((select enabled from public.rpk_workspace_modules where workspace_id=p_workspace_id and module_code='cashflow'),false),
         coalesce((select enabled from public.rpk_workspace_modules where workspace_id=p_workspace_id and module_code='suppliers'),false)
    into v_leadbot_enabled,v_inventory_enabled,v_cashflow_enabled,v_suppliers_enabled;

  if v_clients=0 then
    v_recs:=v_recs||jsonb_build_array(jsonb_build_object('priority','high','code','import_clients','title','Начните с клиентской базы','message','Добавьте несколько клиентов или загрузите старый архив. Тогда Station сможет связать макеты, сделки и повторные продажи.','action','clients'));
  elsif v_archive=0 then
    v_recs:=v_recs||jsonb_build_array(jsonb_build_object('priority','normal','code','import_archive','title','Загрузите старые макеты','message','Клиенты уже есть, но архив пуст. Именно старые макеты дадут самый быстрый эффект от автоматических переделок.','action','archive'));
  end if;

  if not v_profile_verified then
    v_recs:=v_recs||jsonb_build_array(jsonb_build_object('priority','high','code','verify_print_profile','title','Подтвердите профиль печати 3×6','message','Пока печатник и менеджер не согласовали реальные параметры, Station специально блокирует PRINT_READY.','action','printer'));
  end if;

  if v_unindexed>0 then
    v_recs:=v_recs||jsonb_build_array(jsonb_build_object('priority','high','code','index_archive','title','Есть неразобранные файлы архива','message',format('%s файлов ещё требуют индексации или проверки.',v_unindexed),'action','archive'));
  end if;

  if v_overdue>0 then
    v_recs:=v_recs||jsonb_build_array(jsonb_build_object('priority','high','code','overdue_actions','title','Есть просроченные действия по клиентам','message',format('%s сделок уже требуют звонка, ответа или следующего шага.',v_overdue),'action','crm'));
  end if;

  if v_unpaid_invoices>0 then
    v_recs:=v_recs||jsonb_build_array(jsonb_build_object('priority','high','code','unpaid_invoices','title','Проверьте неоплаченные счета','message',format('%s счетов выданы, но ещё не отмечены как оплаченные.',v_unpaid_invoices),'action','documents'));
  end if;

  if v_clients>0 and v_deals=0 then
    v_recs:=v_recs||jsonb_build_array(jsonb_build_object('priority','normal','code','start_crm','title','Начните вести текущие сделки','message','Клиенты есть, но активных сделок пока нет. Достаточно фиксировать заказ, сумму и следующий шаг.','action','crm'));
  end if;

  if v_suppliers_enabled and v_suppliers=0 then
    v_recs:=v_recs||jsonb_build_array(jsonb_build_object('priority','normal','code','add_suppliers','title','Добавьте основных поставщиков','message','После этого можно будет сравнивать закупочные цены и считать реальную себестоимость заказа.','action','procurement'));
  end if;

  if v_cashflow_enabled and v_cash_entries=0 then
    v_recs:=v_recs||jsonb_build_array(jsonb_build_object('priority','normal','code','start_cashflow','title','Начните отмечать реальные деньги','message','Даже простой приход/расход по заказам покажет владельцу кассовую картину без сложной бухгалтерии.','action','money'));
  end if;

  if v_inventory_enabled and v_low_stock>0 then
    v_recs:=v_recs||jsonb_build_array(jsonb_build_object('priority','high','code','low_stock','title','На складе есть позиции без свободного остатка','message',format('%s складских позиций требуют пополнения или проверки резерва.',v_low_stock),'action','inventory'));
  end if;

  if not v_leadbot_enabled and v_clients>=20 then
    v_recs:=v_recs||jsonb_build_array(jsonb_build_object('priority','low','code','offer_leadbot','title','Можно автоматизировать новые обращения','message','Клиентская база уже достаточно большая. Если заявки идут через мессенджеры, можно подключить LeadBot без изменения CRM.','action','leadbot'));
  end if;

  if v_blocked_jobs>0 then
    v_recs:=v_recs||jsonb_build_array(jsonb_build_object('priority','high','code','blocked_design_jobs','title','Есть заблокированные макеты','message',format('%s макетов не прошли производственную проверку.',v_blocked_jobs),'action','queue'));
  end if;

  return jsonb_build_object(
    'metrics',jsonb_build_object(
      'clients',v_clients,'archive',v_archive,'archive_unindexed',v_unindexed,'design_jobs_active',v_jobs,
      'deals_active',v_deals,'pipeline_amount',v_pipeline,'pipeline_margin',v_margin,'overdue_actions',v_overdue,
      'cash_in_month',v_cash_in,'cash_out_month',v_cash_out,'cash_net_month',v_cash_in-v_cash_out,
      'unpaid_invoices',v_unpaid_invoices,'suppliers',v_suppliers,'low_stock',v_low_stock,'print_profile_verified',v_profile_verified
    ),
    'modules',coalesce((select jsonb_agg(jsonb_build_object('code',m.code,'name',m.name,'description',m.description,'category',m.category,'enabled',coalesce(wm.enabled,m.default_enabled),'dependencies',to_jsonb(m.dependencies)) order by m.sort_order) from public.rpk_modules m left join public.rpk_workspace_modules wm on wm.workspace_id=p_workspace_id and wm.module_code=m.code),'[]'::jsonb),
    'deals',coalesce((select jsonb_agg(x order by x.updated_at desc) from (select d.id,d.deal_no,d.client_id,c.name client_name,d.title,d.stage,d.amount,d.cost_estimate,d.margin_estimate,d.next_action_at,d.next_action,d.updated_at from public.rpk_deals d left join public.rpk_clients c on c.id=d.client_id where d.workspace_id=p_workspace_id order by d.updated_at desc limit 30) x),'[]'::jsonb),
    'cash_recent',coalesce((select jsonb_agg(x order by x.occurred_on desc,x.created_at desc) from (select id,deal_id,direction,category,amount,currency,occurred_on,counterparty,note,created_at from public.rpk_cash_entries where workspace_id=p_workspace_id order by occurred_on desc,created_at desc limit 30) x),'[]'::jsonb),
    'documents_recent',coalesce((select jsonb_agg(x order by x.created_at desc) from (select d.id,d.deal_id,d.client_id,c.name client_name,d.document_type,d.document_no,d.status,d.total,d.currency,d.created_at from public.rpk_documents d left join public.rpk_clients c on c.id=d.client_id where d.workspace_id=p_workspace_id order by d.created_at desc limit 30) x),'[]'::jsonb),
    'recommendations',v_recs
  );
end;
$$;

revoke all on function public.rpk_dashboard_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.rpk_dashboard_snapshot(uuid) to service_role;
