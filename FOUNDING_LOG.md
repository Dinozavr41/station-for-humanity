# Founding Log

This file records the earliest public milestones of Station for Humanity.

## 2026-09-08 — Foundation and first public deployment

- The project name **Station for Humanity** was selected for the public platform.
- The domain **stationforhumanity.com** was registered.
- The first public site was deployed on Vercel.
- DNS was connected to the production deployment.
- The project became publicly reachable at **https://stationforhumanity.com**.
- A public GitHub repository, **Dinozavr41/station-for-humanity**, was created.
- GitHub was connected to Vercel and the automatic `main → production` pipeline was verified.
- **Article 0 — LIFE FOR LIFE** was established as the immutable founding principle:

> Life creates intelligence.  
> Intelligence creates possibilities.  
> Possibilities must return to life.

Russian:

> Жизнь создаёт разум.  
> Разум создаёт возможности.  
> Возможности должны служить жизни.

## 2026-09-08 — Alpha 0.2

The first social and value layer was merged into production.

Added:

- **Join the Station** with five entry roles;
- local **Founding Ticket** prototype;
- **Dream #000001 — PILOT** as the founding proof case;
- **Value Ledger** concept and allocation simulator;
- visible **Social Contract** architecture;
- Constitution Draft 0.2;
- `PROJECT_MEMORY.md` as the canonical anti-forgetting source of truth;
- economy, architecture, roadmap and dream documentation;
- public metrics intentionally fixed at zero until real backend events exist;
- GitHub backlog for Alpha 0.3, Digital Factory, Value Ledger, payments/compliance, Dream #000001 and governance.

## 2026-09-08 — Alpha 0.3 backend comes alive

- Supabase production project **station-for-humanity-prod** was created in West EU.
- The first persistent core schema was deployed: profiles, Founding Tickets, orders, payments, refunds, ledger, allocations, payouts, approvals, audit, controls, dreams and milestones.
- RLS was enabled and the server-side financial control plane was initialized with live payments, payouts and automatic refunds disabled.
- Security-definer RPC exposure was closed and backend-only `service_role` access was granted explicitly.
- **Dream #000001 — PILOT** became a persistent database object with five milestones.
- The public `founding-ticket` Edge Function was deployed with origin validation, explicit consent, honeypot protection and rate limiting.
- The first real browser → Edge Function → PostgreSQL → Audit Log submission succeeded.
- The first real persistent Founding Ticket is **FT-000002**, role `build`, status `submitted`, private by default. Number `FT-000001` was consumed by a rolled-back infrastructure diagnostic; PostgreSQL sequences intentionally preserve such gaps.

## 2026-09-08 — First financial acceptance test

- A secured **Operator Console** was deployed at `/operator.html` using Supabase Auth and role-based authorization.
- Operator actions now cover Founding Ticket review, acceptance/rejection, test order creation, quote issuance, mock payment preparation, financial confirmation, production, QA and delivery transitions.
- Live payments, live payouts and automatic refunds remained disabled by the database control plane.
- **TEST Order #000001** was created for the Alpha 0.3 finance acceptance path.
- Quote amount: **1,000 RUB**.
- Mock payment status: **succeeded**.
- Order status after financial acceptance: **paid**.
- A posted double-entry ledger transaction was created atomically with the payment state change.
- Debit total: **1,000.00 RUB**.
- Credit total: **1,000.00 RUB**.
- The first financial acceptance therefore reconciled to zero difference without moving real money.
- Security Advisor reported no warning/error-level findings after the change; remaining notices are informational deny-by-default RLS and currently-unused-index notices expected on an almost-empty database.

## Why keep this log?

If the project grows, its origin should remain auditable. The station is intended to be built in public: principles, architecture, mistakes, revisions and milestones should leave a historical record.
