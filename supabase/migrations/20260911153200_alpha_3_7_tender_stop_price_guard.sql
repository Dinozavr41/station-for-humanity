-- STOP PRICE is an approval gate, not a decorative metric.

create or replace function public.rpk_tender_decide(p_workspace_slug text,p_calculation_id uuid,p_decision text,p_comment text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid:=auth.uid(); v_wid uuid; v_role text; v_c public.rpk_tender_calculations%rowtype; v_effective_bid numeric;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select id into v_wid from public.rpk_workspaces where slug=p_workspace_slug;
  select case when p.role in ('admin','operator') and p.status='active' then 'platform_admin' else m.role end
    into v_role from (select 1)x left join public.profiles p on p.id=v_user left join public.rpk_members m on m.workspace_id=v_wid and m.user_id=v_user and m.status='active';
  if v_role not in ('platform_admin','owner') then raise exception 'OWNER_ROLE_REQUIRED'; end if;
  select * into v_c from public.rpk_tender_calculations where id=p_calculation_id and workspace_id=v_wid;
  if v_c.id is null then raise exception 'CALCULATION_NOT_FOUND'; end if;
  v_effective_bid:=coalesce(v_c.candidate_bid,v_c.tender_price);

  if p_decision='approve' then
    if v_c.status<>'review_ready' or v_c.projected_profit is null or jsonb_array_length(v_c.missing_data)>0 then raise exception 'CALCULATION_NOT_READY'; end if;
    if v_effective_bid is null then raise exception 'BID_REQUIRED'; end if;
    if v_c.projected_profit<0 then raise exception 'NEGATIVE_PROJECTED_PROFIT'; end if;
    if v_c.stop_price is not null and v_effective_bid<v_c.stop_price then raise exception 'BID_BELOW_STOP_PRICE'; end if;
    if v_c.min_profit is not null and v_c.projected_profit<v_c.min_profit then raise exception 'MIN_PROFIT_NOT_MET'; end if;
    if v_c.min_margin_pct is not null and coalesce(v_c.projected_margin_pct,-1)<v_c.min_margin_pct then raise exception 'MIN_MARGIN_NOT_MET'; end if;
    update public.rpk_tender_calculations set status='approved',approved_by=v_user,approved_at=now(),rejected_by=null,rejected_at=null,updated_at=now() where id=v_c.id returning * into v_c;
  elsif p_decision='reject' then
    update public.rpk_tender_calculations set status='rejected',rejected_by=v_user,rejected_at=now(),updated_at=now() where id=v_c.id returning * into v_c;
  elsif p_decision='reopen' then
    update public.rpk_tender_calculations set status='draft',approved_by=null,approved_at=null,rejected_by=null,rejected_at=null,updated_at=now() where id=v_c.id returning * into v_c;
  else
    raise exception 'INVALID_DECISION';
  end if;

  insert into public.rpk_tender_decisions(calculation_id,workspace_id,decision,actor_user_id,snapshot,comment)
  values(v_c.id,v_wid,p_decision,v_user,to_jsonb(v_c),nullif(trim(p_comment),''));
  return jsonb_build_object('ok',true,'calculation',to_jsonb(v_c));
end$$;

revoke all on function public.rpk_tender_decide(text,uuid,text,text) from public,anon;
grant execute on function public.rpk_tender_decide(text,uuid,text,text) to authenticated;
