-- Station for Humanity — Alpha 0.3 security lockdown
-- Trigger/helper functions must never be callable as public RPC endpoints.

revoke all on function public.guard_ledger_entry_mutation() from public, anon, authenticated;
revoke all on function public.guard_ledger_transaction_posting() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
