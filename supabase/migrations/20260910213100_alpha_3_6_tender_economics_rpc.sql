-- Station RPK OS · Tender Economics V1 RPC + decision gate

create or replace function public.rpk_tender_snapshot(p_workspace_slug text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_w public.rpk_workspaces%rowtype; v_role text; v_result jsonb;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_w from public.rpk_workspaces where slug=p_workspace_slug;
 if v_w.id is null then raise exception 'WORKSPACE_NOT_FOUND'; end if;
 select case when p.role in ('admin','operator') and p.status='active' then 'platform_admin' else m.role end
 into v_role from (select 1) x left join public.profiles p on p.id=v_user left join public.rpk_members m on m.workspace_id=v_w.id and m.user_id=v_user and m.status='active';
 if v_role is null then raise exception 'WORKSPACE_ACCESS_DENIED'; end if;
 select jsonb_build_object('ok',true,'access_role',v_role,'workspace',jsonb_build_object('id',v_w.id,'slug',v_w.slug,'name',v_w.name),
   'items',coalesce(jsonb_agg(jsonb_build_object('calculation',to_jsonb(c),'opportunity',jsonb_build_object('id',o.id,'source_item_id',o.source_item_id,'title',o.title,'buyer_name',o.buyer_name,'region',o.region,'city',o.city,'source_label',o.source_label,'source_url',o.source_url,'published_at',o.published_at,'deadline_at',o.deadline_at,'budget_min',o.budget_min,'budget_max',o.budget_max,'normalized',o.normalized),'lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.line_no) from public.rpk_tender_cost_lines l where l.calculation_id=c.id),'[]'::jsonb),'decisions',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.rpk_tender_decisions d where d.calculation_id=c.id),'[]'::jsonb)) order by c.updated_at desc),'[]'::jsonb))
 into v_result from public.rpk_tender_calculations c join public.business_opportunities o on o.id=c.opportunity_id where c.workspace_id=v_w.id;
 return coalesce(v_result,jsonb_build_object('ok',true,'access_role',v_role,'workspace',jsonb_build_object('id',v_w.id,'slug',v_w.slug,'name',v_w.name),'items','[]'::jsonb));
end$$;

create or replace function public.rpk_tender_recalculate(p_workspace_slug text,p_calculation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_wid uuid; v_role text; v_c public.rpk_tender_calculations%rowtype; v_required int; v_known int; v_direct numeric:=0; v_platform numeric:=0; v_other numeric:=0; v_total numeric:=0; v_bid numeric; v_profit numeric; v_margin numeric; v_stop numeric; v_conf numeric:=0; v_missing jsonb:='[]'::jsonb;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 select id into v_wid from public.rpk_workspaces where slug=p_workspace_slug; if v_wid is null then raise exception 'WORKSPACE_NOT_FOUND'; end if;
 select case when p.role in ('admin','operator') and p.status='active' then 'platform_admin' else m.role end into v_role from (select 1) x left join public.profiles p on p.id=v_user left join public.rpk_members m on m.workspace_id=v_wid and m.user_id=v_user and m.status='active';
 if v_role not in ('platform_admin','owner','manager') then raise exception 'MANAGER_ROLE_REQUIRED'; end if;
 select * into v_c from public.rpk_tender_calculations where id=p_calculation_id and workspace_id=v_wid; if v_c.id is null then raise exception 'CALCULATION_NOT_FOUND'; end if;
 update public.rpk_tender_cost_lines set total_cost=case when quantity is not null and unit_cost is not null then round(quantity*unit_cost,2) else total_cost end,updated_at=now() where calculation_id=v_c.id;
 select count(*) filter(where required and include_in_total),count(*) filter(where required and include_in_total and total_cost is not null),
 coalesce(sum(total_cost) filter(where include_in_total and line_type in ('material','production','design','installation','logistics','subcontract')),0),
 coalesce(sum(total_cost) filter(where include_in_total and line_type='platform_fee'),0),
 coalesce(sum(total_cost) filter(where include_in_total and line_type not in ('material','production','design','installation','logistics','subcontract','platform_fee')),0),
 coalesce(avg(confidence) filter(where required and include_in_total and total_cost is not null),0),
 coalesce(jsonb_agg(item_name order by line_no) filter(where required and include_in_total and total_cost is null),'[]'::jsonb)
 into v_required,v_known,v_direct,v_platform,v_other,v_conf,v_missing from public.rpk_tender_cost_lines where calculation_id=v_c.id;
 v_total:=v_direct+v_platform+v_other; v_bid:=coalesce(v_c.candidate_bid,v_c.tender_price);
 if v_required=0 or v_known=v_required then v_profit:=case when v_bid is null then null else v_bid-v_total end; v_margin:=case when v_bid is null or v_bid=0 then null else round((v_profit/v_bid)*100,4) end; else v_profit:=null; v_margin:=null; end if;
 if v_c.min_profit is not null then v_stop:=v_total+v_c.min_profit; end if;
 if v_c.min_margin_pct is not null and v_c.min_margin_pct>=0 and v_c.min_margin_pct<100 then v_stop:=greatest(coalesce(v_stop,0),round(v_total/(1-v_c.min_margin_pct/100),2)); end if;
 update public.rpk_tender_calculations set direct_cost=v_direct,platform_fee=v_platform,other_cost=v_other,total_cost=v_total,projected_profit=v_profit,projected_margin_pct=v_margin,stop_price=nullif(v_stop,0),cost_coverage_pct=case when v_required=0 then 100 else round(v_known::numeric/v_required*100,4) end,confidence=round((case when v_required=0 then 1 else v_known::numeric/v_required end)*v_conf,4),missing_data=v_missing,status=case when status in ('approved','rejected') then status when v_profit is not null then 'review_ready' else 'draft' end,updated_at=now() where id=v_c.id returning * into v_c;
 return jsonb_build_object('ok',true,'calculation',to_jsonb(v_c),'missing_data',v_missing);
end$$;

create or replace function public.rpk_tender_update_line(p_workspace_slug text,p_calculation_id uuid,p_line_no integer,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_wid uuid; v_role text; v_line public.rpk_tender_cost_lines%rowtype;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if; select id into v_wid from public.rpk_workspaces where slug=p_workspace_slug;
 select case when p.role in ('admin','operator') and p.status='active' then 'platform_admin' else m.role end into v_role from (select 1)x left join public.profiles p on p.id=v_user left join public.rpk_members m on m.workspace_id=v_wid and m.user_id=v_user and m.status='active'; if v_role not in ('platform_admin','owner','manager') then raise exception 'MANAGER_ROLE_REQUIRED'; end if;
 if not exists(select 1 from public.rpk_tender_calculations where id=p_calculation_id and workspace_id=v_wid) then raise exception 'CALCULATION_NOT_FOUND'; end if;
 update public.rpk_tender_cost_lines set
   item_name=coalesce(nullif(p_patch->>'item_name',''),item_name), specification=coalesce(p_patch->>'specification',specification), quantity=case when p_patch ? 'quantity' then nullif(p_patch->>'quantity','')::numeric else quantity end,
   unit=case when p_patch ? 'unit' then nullif(p_patch->>'unit','') else unit end, unit_cost=case when p_patch ? 'unit_cost' then nullif(p_patch->>'unit_cost','')::numeric else unit_cost end,
   total_cost=case when p_patch ? 'total_cost' then nullif(p_patch->>'total_cost','')::numeric else total_cost end, cost_basis=coalesce(nullif(p_patch->>'cost_basis',''),cost_basis),
   source_label=case when p_patch ? 'source_label' then nullif(p_patch->>'source_label','') else source_label end, source_url=case when p_patch ? 'source_url' then nullif(p_patch->>'source_url','') else source_url end,
   source_date=case when p_patch ? 'source_date' then nullif(p_patch->>'source_date','')::date else source_date end, confidence=case when p_patch ? 'confidence' then greatest(0,least(1,(p_patch->>'confidence')::numeric)) else confidence end,
   notes=case when p_patch ? 'notes' then nullif(p_patch->>'notes','') else notes end, updated_at=now()
 where calculation_id=p_calculation_id and line_no=p_line_no returning * into v_line; if v_line.id is null then raise exception 'LINE_NOT_FOUND'; end if;
 perform public.rpk_tender_recalculate(p_workspace_slug,p_calculation_id); return jsonb_build_object('ok',true,'line',to_jsonb(v_line));
end$$;

create or replace function public.rpk_tender_set_policy(p_workspace_slug text,p_calculation_id uuid,p_candidate_bid numeric,p_min_profit numeric,p_min_margin_pct numeric)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_wid uuid; v_role text;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if; select id into v_wid from public.rpk_workspaces where slug=p_workspace_slug;
 select case when p.role in ('admin','operator') and p.status='active' then 'platform_admin' else m.role end into v_role from (select 1)x left join public.profiles p on p.id=v_user left join public.rpk_members m on m.workspace_id=v_wid and m.user_id=v_user and m.status='active'; if v_role not in ('platform_admin','owner','manager') then raise exception 'MANAGER_ROLE_REQUIRED'; end if;
 if p_candidate_bid is not null and p_candidate_bid<0 then raise exception 'NEGATIVE_BID_NOT_ALLOWED'; end if;
 if p_min_profit is not null and p_min_profit<0 then raise exception 'NEGATIVE_MIN_PROFIT_NOT_ALLOWED'; end if;
 if p_min_margin_pct is not null and (p_min_margin_pct<0 or p_min_margin_pct>=100) then raise exception 'MIN_MARGIN_OUT_OF_RANGE'; end if;
 update public.rpk_tender_calculations set candidate_bid=p_candidate_bid,min_profit=p_min_profit,min_margin_pct=p_min_margin_pct,updated_at=now() where id=p_calculation_id and workspace_id=v_wid; if not found then raise exception 'CALCULATION_NOT_FOUND'; end if;
 return public.rpk_tender_recalculate(p_workspace_slug,p_calculation_id);
end$$;

create or replace function public.rpk_tender_decide(p_workspace_slug text,p_calculation_id uuid,p_decision text,p_comment text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_wid uuid; v_role text; v_c public.rpk_tender_calculations%rowtype;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if; select id into v_wid from public.rpk_workspaces where slug=p_workspace_slug;
 select case when p.role in ('admin','operator') and p.status='active' then 'platform_admin' else m.role end into v_role from (select 1)x left join public.profiles p on p.id=v_user left join public.rpk_members m on m.workspace_id=v_wid and m.user_id=v_user and m.status='active'; if v_role not in ('platform_admin','owner') then raise exception 'OWNER_ROLE_REQUIRED'; end if;
 select * into v_c from public.rpk_tender_calculations where id=p_calculation_id and workspace_id=v_wid; if v_c.id is null then raise exception 'CALCULATION_NOT_FOUND'; end if;
 if p_decision='approve' then if v_c.status<>'review_ready' or v_c.projected_profit is null or jsonb_array_length(v_c.missing_data)>0 then raise exception 'CALCULATION_NOT_READY'; end if; update public.rpk_tender_calculations set status='approved',approved_by=v_user,approved_at=now(),rejected_by=null,rejected_at=null,updated_at=now() where id=v_c.id returning * into v_c;
 elsif p_decision='reject' then update public.rpk_tender_calculations set status='rejected',rejected_by=v_user,rejected_at=now(),updated_at=now() where id=v_c.id returning * into v_c;
 elsif p_decision='reopen' then update public.rpk_tender_calculations set status='draft',approved_by=null,approved_at=null,rejected_by=null,rejected_at=null,updated_at=now() where id=v_c.id returning * into v_c; else raise exception 'INVALID_DECISION'; end if;
 insert into public.rpk_tender_decisions(calculation_id,workspace_id,decision,actor_user_id,snapshot,comment) values(v_c.id,v_wid,p_decision,v_user,to_jsonb(v_c),nullif(trim(p_comment),'')); return jsonb_build_object('ok',true,'calculation',to_jsonb(v_c));
end$$;

-- Defense in depth: prohibit economically impossible input states.
do $$ begin
 if not exists(select 1 from pg_constraint where conname='rpk_tender_calc_tender_price_nonnegative') then alter table public.rpk_tender_calculations add constraint rpk_tender_calc_tender_price_nonnegative check (tender_price is null or tender_price >= 0); end if;
 if not exists(select 1 from pg_constraint where conname='rpk_tender_calc_candidate_bid_nonnegative') then alter table public.rpk_tender_calculations add constraint rpk_tender_calc_candidate_bid_nonnegative check (candidate_bid is null or candidate_bid >= 0); end if;
 if not exists(select 1 from pg_constraint where conname='rpk_tender_calc_min_profit_nonnegative') then alter table public.rpk_tender_calculations add constraint rpk_tender_calc_min_profit_nonnegative check (min_profit is null or min_profit >= 0); end if;
 if not exists(select 1 from pg_constraint where conname='rpk_tender_calc_min_margin_range') then alter table public.rpk_tender_calculations add constraint rpk_tender_calc_min_margin_range check (min_margin_pct is null or (min_margin_pct >= 0 and min_margin_pct < 100)); end if;
 if not exists(select 1 from pg_constraint where conname='rpk_tender_calc_costs_nonnegative') then alter table public.rpk_tender_calculations add constraint rpk_tender_calc_costs_nonnegative check (direct_cost >= 0 and platform_fee >= 0 and other_cost >= 0 and total_cost >= 0); end if;
 if not exists(select 1 from pg_constraint where conname='rpk_tender_calc_stop_nonnegative') then alter table public.rpk_tender_calculations add constraint rpk_tender_calc_stop_nonnegative check (stop_price is null or stop_price >= 0); end if;
 if not exists(select 1 from pg_constraint where conname='rpk_tender_calc_coverage_range') then alter table public.rpk_tender_calculations add constraint rpk_tender_calc_coverage_range check (cost_coverage_pct >= 0 and cost_coverage_pct <= 100); end if;
 if not exists(select 1 from pg_constraint where conname='rpk_tender_calc_confidence_range') then alter table public.rpk_tender_calculations add constraint rpk_tender_calc_confidence_range check (confidence >= 0 and confidence <= 1); end if;
 if not exists(select 1 from pg_constraint where conname='rpk_tender_line_quantity_nonnegative') then alter table public.rpk_tender_cost_lines add constraint rpk_tender_line_quantity_nonnegative check (quantity is null or quantity >= 0); end if;
 if not exists(select 1 from pg_constraint where conname='rpk_tender_line_unit_cost_nonnegative') then alter table public.rpk_tender_cost_lines add constraint rpk_tender_line_unit_cost_nonnegative check (unit_cost is null or unit_cost >= 0); end if;
 if not exists(select 1 from pg_constraint where conname='rpk_tender_line_total_cost_nonnegative') then alter table public.rpk_tender_cost_lines add constraint rpk_tender_line_total_cost_nonnegative check (total_cost is null or total_cost >= 0); end if;
end $$;

revoke all on function public.rpk_tender_snapshot(text) from public, anon;
revoke all on function public.rpk_tender_recalculate(text,uuid) from public, anon;
revoke all on function public.rpk_tender_update_line(text,uuid,integer,jsonb) from public, anon;
revoke all on function public.rpk_tender_set_policy(text,uuid,numeric,numeric,numeric) from public, anon;
revoke all on function public.rpk_tender_decide(text,uuid,text,text) from public, anon;
grant execute on function public.rpk_tender_snapshot(text) to authenticated;
grant execute on function public.rpk_tender_recalculate(text,uuid) to authenticated;
grant execute on function public.rpk_tender_update_line(text,uuid,integer,jsonb) to authenticated;
grant execute on function public.rpk_tender_set_policy(text,uuid,numeric,numeric,numeric) to authenticated;
grant execute on function public.rpk_tender_decide(text,uuid,text,text) to authenticated;
