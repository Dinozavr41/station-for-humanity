-- Alpha 1.3: atomic failed-attempt counter for scoped onboarding links.

create or replace function public.increment_onboarding_attempt(p_link_id uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare n integer;
begin
  update public.leadbot_onboarding_links
  set attempts=attempts+1,
      last_used_at=now()
  where id=p_link_id and status='active'
  returning attempts into n;
  return coalesce(n,0);
end;
$$;

revoke all on function public.increment_onboarding_attempt(uuid) from public, anon, authenticated;
grant execute on function public.increment_onboarding_attempt(uuid) to service_role;
