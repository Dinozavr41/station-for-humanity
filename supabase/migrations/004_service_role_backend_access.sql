-- Station for Humanity — service-role backend access
-- Keep anon/authenticated locked down; grant only the server role used by Edge Functions.

grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.profiles,
  public.founding_tickets,
  public.orders,
  public.order_events,
  public.payments,
  public.payment_events,
  public.refunds,
  public.ledger_accounts,
  public.ledger_transactions,
  public.ledger_entries,
  public.value_allocations,
  public.payouts,
  public.approvals,
  public.system_controls,
  public.audit_log,
  public.dreams,
  public.dream_milestones,
  public.intake_rate_limits
  to service_role;

grant usage, select, update on all sequences in schema public to service_role;
