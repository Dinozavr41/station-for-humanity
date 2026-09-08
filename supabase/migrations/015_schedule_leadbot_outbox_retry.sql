-- Retry failed external LeadBot integrations every two minutes.
do $$
declare jid bigint;
begin
  select jobid into jid from cron.job where jobname='sfh-leadbot-outbox-retry' limit 1;
  if jid is not null then perform cron.unschedule(jid); end if;
end $$;

select cron.schedule(
  'sfh-leadbot-outbox-retry',
  '*/2 * * * *',
  $cron$
    select net.http_post(
      url := 'https://xwapzjsnqyfiqbzeycyh.supabase.co/functions/v1/leadbot-outbox-retry',
      body := '{"action":"run"}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-sfh-watchdog',(select decrypted_secret from vault.decrypted_secrets where name='sfh_watchdog_token' limit 1)
      ),
      timeout_milliseconds := 20000
    );
  $cron$
);
