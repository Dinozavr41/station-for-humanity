-- Station for Humanity — Alpha 0.3 performance indexes
create index if not exists idx_approvals_requested_by on public.approvals(requested_by);
create index if not exists idx_approvals_approved_by on public.approvals(approved_by);
create index if not exists idx_audit_log_actor on public.audit_log(actor_user_id);
create index if not exists idx_dream_milestones_verified_by on public.dream_milestones(verified_by);
create index if not exists idx_ledger_transactions_created_by on public.ledger_transactions(created_by);
create index if not exists idx_order_events_actor on public.order_events(actor_user_id);
create index if not exists idx_orders_approved_by on public.orders(approved_by);
create index if not exists idx_payouts_requested_by on public.payouts(requested_by);
create index if not exists idx_payouts_approved_by on public.payouts(approved_by);
create index if not exists idx_refunds_requested_by on public.refunds(requested_by);
create index if not exists idx_refunds_approved_by on public.refunds(approved_by);
create index if not exists idx_system_controls_updated_by on public.system_controls(updated_by);
