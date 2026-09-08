-- Alpha 0.6: server-side provider reconciliation every 5 minutes.
do $$
begin
  if exists (select 1 from cron.job where jobname='sfh-yookassa-test-watchdog') then
    perform cron.unschedule('sfh-yookassa-test-watchdog');
  end if;
  perform cron.schedule(
    'sfh-yookassa-test-watchdog',
    '*/5 * * * *',
    $cmd$
      select net.http_post(
        url := 'https://xwapzjsnqyfiqbzeycyh.supabase.co/functions/v1/yookassa-test-reconcile',
        body := '{"action":"run","trigger_source":"scheduler"}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-sfh-watchdog',(select decrypted_secret from vault.decrypted_secrets where name='sfh_watchdog_token' limit 1)
        ),
        timeout_milliseconds := 20000
      );
    $cmd$
  );
end $$;
