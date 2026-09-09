# RPK OS 3.1 — Owner Dashboard Acceptance

Date: 2026-09-09
Branch: `frontend-v2-exact`

## Goal

Make the RPK cabinet useful as the daily operating screen for a small advertising-production company, not only as a Design Factory/archive interface.

## First-screen principle

The owner/manager should answer three questions in seconds:

1. Where are the money and active orders?
2. What is overdue or requires attention today?
3. What can be improved next without adding unnecessary complexity?

The mobile-first cabinet now starts with `Сегодня` and then exposes enabled modules: CRM, archive, production, documents, cashflow, procurement and optional extensions.

## Production backend

New Edge Function: `rpk-os`.

- JWT required;
- exact workspace access is resolved through Station admin/operator role or an active RPK workspace membership;
- write actions require manager/owner roles as appropriate;
- module changes require owner/platform-admin role;
- no direct browser table access is opened.

Supported actions:

- `snapshot`;
- `create_deal`;
- `update_deal`;
- `add_cash_entry`;
- `create_document_draft`;
- `create_supplier`;
- `toggle_module` with dependency checks.

The existing `rpk-workspace` endpoint continues to own archive, customer/archive linkage, printer questionnaire and remake operations. This separation is intentional so OS modules can grow without destabilizing the archive/Design Factory path.

## Dashboard snapshot

Migration `032_alpha_3_1_rpk_os_owner_dashboard.sql` adds `rpk_dashboard_snapshot(workspace_id)`.

The snapshot returns real workspace data only:

- active customers;
- archive total / unindexed count;
- active and blocked design jobs;
- active deals;
- sales pipeline amount;
- estimated pipeline contribution margin;
- overdue next actions;
- month cash in / cash out / net flow;
- unpaid issued invoices;
- supplier count;
- low/free-stock warnings when inventory is enabled;
- verified print-profile state;
- enabled/disabled module registry;
- recent deals, cash entries and documents;
- deterministic recommendations with evidence-derived reasons.

No revenue, stock, client, payment or KPI value is fabricated for an empty workspace.

## Explainable recommendations

Initial rules include:

- empty customer base → import/add clients;
- clients exist but archive is empty → import legacy layouts;
- print profile not verified → complete printer + manager confirmation;
- archive contains unindexed files → finish indexing/review;
- overdue CRM next actions → contact customers;
- issued unpaid invoices → payment follow-up;
- clients exist but no active deals → start lightweight CRM usage;
- supplier module enabled but no suppliers → add key suppliers;
- cashflow enabled but no current-month entries → start management cash tracking;
- inventory enabled and free stock is depleted → stock attention;
- sufficiently large customer base with LeadBot disabled → optional LeadBot suggestion;
- blocked Design Factory jobs → production review.

Recommendations never silently change money, prices, documents, stock or customer state.

## Frontend

`/factory/rpk/` has been reworked into the RPK OS shell while preserving the existing protected archive and printer-profile functionality.

The first screen contains:

- quick actions: deal, cash entry, customer, remake;
- active-deal count and pipeline;
- current-month net cashflow;
- overdue-action count;
- active design-job / archive indicators;
- attention list;
- Station improvement recommendations.

Further sections:

- Mini CRM with deal stage controls and next action;
- existing customer list;
- legacy archive and remake action;
- Design Factory production queue;
- document drafts;
- management cashflow;
- procurement starter block;
- professional print-profile questionnaire;
- adaptive module registry.

Optional module toggles are initially exposed only for Inventory and LeadBot; core modules are not casually removable from the UI.

## Commercial documents

RPK OS 3.1 can create controlled database drafts of a commercial proposal or invoice directly from a deal. It deliberately does not claim that a legal/printable PDF/DOCX has been issued yet.

PDF/DOCX rendering, requisites, numbering and sending are the next controlled document-generation layer.

## Acceptance evidence

A fully rolled-back transactional test created temporary data for Focus:

- 1 customer;
- 1 active deal for 30,000 RUB;
- estimated cost 18,000 RUB;
- estimated margin 12,000 RUB;
- one overdue next action;
- 10,000 RUB incoming cash;
- one issued/unpaid invoice for 30,000 RUB.

`rpk_dashboard_snapshot()` correctly returned:

- clients = 1;
- deals_active = 1;
- pipeline_amount = 30,000;
- pipeline_margin = 12,000;
- cash_in_month = 10,000;
- cash_net_month = 10,000;
- overdue_actions = 1;
- unpaid_invoices = 1.

It also generated matching recommendations for the overdue action, unpaid invoice, missing archive, missing verified print profile and missing suppliers.

The transaction was rolled back. Follow-up verification returned zero acceptance clients and zero acceptance deals, so the real Focus pilot contains no synthetic business data.

## Security acceptance

Unauthenticated POST to production `rpk-os` returned HTTP 401 (`UNAUTHORIZED_NO_AUTH_HEADER`).

Operational tables remain RLS deny-by-default and are accessed through protected Edge Functions/service role.

## Deployment boundary

Backend `rpk-os` is ACTIVE in production Supabase.

The new RPK OS frontend remains only in `frontend-v2-exact`. `main` and the approved public Home/History pages were not modified.

The existing `frontend-v4-preview` Edge Function is intentionally disabled (HTTP 410), so no claim is made that the new RPK OS UI is publicly deployed yet.

## Next product work

1. Archive Indexer for the real RPK legacy folder/database.
2. Safe preview/conversion pipeline for JPG/PNG/TIFF/PDF first, then assisted AI/EPS/CDR handling.
3. Real Focus customer/archive import.
4. Commercial document renderer: КП / счёт / производственное задание with company requisites and explicit issue/send gates.
5. Supplier price import and real cost comparison.
6. Optional inventory once Focus confirms the stock workflow they actually use.
7. LeadBot linkage into the same CRM when the RPK chooses to enable it.
