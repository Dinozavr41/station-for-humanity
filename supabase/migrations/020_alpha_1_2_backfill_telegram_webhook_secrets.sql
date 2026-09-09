-- Alpha 1.2: bring existing instances under the same automatic secret policy.

do $$
declare
  x record;
  s jsonb;
begin
  for x in select id from public.leadbot_instances loop
    s := public.leadbot_get_secrets(x.id);
    if coalesce(length(s->>'webhook_secret'),0) < 16 then
      perform public.leadbot_store_secret(x.id,'webhook_secret',encode(extensions.gen_random_bytes(32),'hex'));
    end if;
    perform public.leadbot_refresh_readiness(x.id);
  end loop;
end $$;
