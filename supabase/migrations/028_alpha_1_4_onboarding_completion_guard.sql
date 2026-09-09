-- Alpha 1.4: customer onboarding must not close before a manager endpoint exists.

create or replace function public.guard_leadbot_onboarding_completion()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  r jsonb;
  manager_connected boolean;
begin
  if new.status='completed' and old.status is distinct from 'completed' then
    select readiness into r from public.leadbot_instances where id=new.instance_id;
    manager_connected := coalesce((r->>'manager_chat_id')::boolean,false)
                         or coalesce((r->>'max_manager')::boolean,false)
                         or coalesce((r->>'whatsapp_manager')::boolean,false);
    if not coalesce((r->>'channels_ready')::boolean,false) or not manager_connected then
      new.status := 'active';
      new.completed_at := null;
      new.metadata := coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object(
        'completion_blocked_at',now(),
        'completion_blocked_reason',case
          when not coalesce((r->>'channels_ready')::boolean,false) then 'channels_not_ready'
          else 'manager_not_connected'
        end
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_leadbot_onboarding_completion() from public, anon, authenticated;

drop trigger if exists trg_guard_leadbot_onboarding_completion on public.leadbot_onboarding_links;
create trigger trg_guard_leadbot_onboarding_completion
before update of status on public.leadbot_onboarding_links
for each row execute function public.guard_leadbot_onboarding_completion();
