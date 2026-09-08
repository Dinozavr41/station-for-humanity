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

## 2026-09-08 — First complete order lifecycle

- **FT-000002** was reviewed and accepted through the authenticated Operator Console.
- **TEST Order #000001** completed the entire operational state machine:
  `draft → quoted → awaiting_payment → paid → in_production → qa → delivered`.
- Order events were persisted for every state transition.
- Audit events were persisted for production, QA and delivery actions.
- The mock payment remained `succeeded`, `test_mode=true`.
- The posted ledger transaction remained balanced at **1,000.00 RUB debit = 1,000.00 RUB credit**, delta **0.00 RUB**.
- Live payments, payouts and automatic refunds remained disabled; `max_live_payment` remained **0 RUB**.
- This is the first fully completed end-to-end Station for Humanity order lifecycle, executed entirely in test mode with no real money moved.

## 2026-09-08 — First external YooKassa sandbox payment

- **TEST Order #000002** was created with a **1,000 RUB** quote and sent to the real YooKassa sandbox checkout.
- The buyer completed the sandbox bank-card flow including test 3-D Secure.
- YooKassa reported the external payment as **succeeded**, `test=true`.
- The configured webhook reached the Station backend and was independently re-verified against the YooKassa API before local processing.
- The first webhook run exposed an important sandbox integration bug: the webhook updated the local payment row to `succeeded` before calling the reconciliation RPC, while the original RPC treated an already-succeeded payment as fully processed and returned early. As a result, the external payment was verified but the order initially remained `awaiting_payment` and no ledger transaction was created.
- The bug was fixed immediately by replacing early-return idempotency with full state reconciliation: payment, order and ledger are now checked and repaired as one idempotent workflow.
- **ORD-000002** was reconciled to `paid`.
- The YooKassa TEST ledger transaction was posted with **1,000.00 RUB debit = 1,000.00 RUB credit**.
- A second reconciliation pass produced no duplicate order event or ledger entries, demonstrating idempotent replay behavior.
- Live payments remained **OFF**, payouts **OFF**, and `max_live_payment` remained **0 RUB** throughout the external sandbox test.

## 2026-09-08 — First external YooKassa sandbox refund

- A full **1,000 RUB** TEST refund was created for **ORD-000002** using the real YooKassa sandbox refund API.
- YooKassa returned a real external sandbox `refund_id` and the refund reached **succeeded**.
- The configured `refund.succeeded` webhook was received and independently checked against the YooKassa API.
- The Station payment retained provider status `succeeded` because the original provider payment really succeeded, while the Station canonical status became **refunded** after the separate successful refund.
- **ORD-000002** reached `refunded`.
- A reversing double-entry ledger transaction was posted for the refund.
- Original payment ledger: **1,000.00 RUB debit = 1,000.00 RUB credit**.
- Refund ledger: **1,000.00 RUB debit = 1,000.00 RUB credit**.
- Live payments, payouts and automatic refunds remained disabled throughout the refund acceptance.

## 2026-09-08 — Alpha 0.6 autonomous financial watchdog

- The financial watchdog was moved from browser-dependent polling to a real server-side scheduler.
- Supabase `pg_cron + pg_net` now invokes YooKassa TEST reconciliation every **5 minutes**, even when the Operator Console and the user's computer are closed.
- Scheduler authentication uses an internal random token generated server-side and stored in Supabase Vault; the browser does not know this token.
- Every provider reconciliation is stored in `reconciliation_runs` with trigger source, checked payments/refunds, changed states, errors and summary.
- A persistent `reconciliation_incidents` emergency queue now records provider failures, ledger integrity problems, missing payment/refund ledger records, order/payment mismatches, stale pending payments and unexpected LIVE-money activation.
- Finance/risk/admin may acknowledge an incident; healthy watchdog reconciliation resolves the incident when the underlying state is actually healthy.
- A new **Financial Health** panel was added to the Operator Console with overall state, ledger integrity, open incident count, recent watchdog run and emergency queue.
- The first server-token watchdog acceptance run completed successfully without an operator JWT.
- Acceptance health result: **HEALTHY**.
- Ledger imbalances: **0**.
- Missing payment ledgers: **0**.
- Missing refund ledgers: **0**.
- Order/payment mismatches: **0**.
- Stale pending payments: **0**.
- Open incidents: **0**.
- Cron job `sfh-yookassa-test-watchdog` is active with schedule `*/5 * * * *`.
- LIVE payments remained **OFF**, payouts **OFF**, automatic refunds **OFF**, and `max_live_payment` remained **0 RUB**.

## 2026-09-08 — Alpha 0.7 Digital Factory Product 01

- **SFH LeadBot 1.0** became the first priced Digital Factory product.
- Public factory intake and server-side Pricing Engine were deployed at `/factory/`.
- Base founding price: **14,900 RUB**; options are priced from database rules rather than browser constants.
- The first Digital Factory request became **DF-000001** and generated **ORD-000003** plus **Q-000003** automatically.
- The selected full configuration priced to **70,900 RUB** and the operator accepted the request.
- The commercial order is deliberately still `quoted`: live charging remains disabled and no real revenue is claimed.

## 2026-09-08 — Alpha 0.8 first production LeadBot runtime

- A reusable multi-instance Telegram LeadBot runtime was built and deployed as the `leadbot-telegram` Edge Function.
- **ORD-000003** received the first persistent LeadBot instance, configured for a lighting-installation business.
- The instance contains four lead flows plus FAQ: installation estimate, engineer consultation, site visit, commercial object and questions about services.
- Conversation state, update idempotency, leads, runtime events and integration outbox are persisted in dedicated RLS-protected tables.
- Telegram webhook authentication uses a random secret generated server-side and stored in Supabase Vault.
- Bot tokens and external integration credentials are stored through service-role-only Vault RPCs and are never committed to GitHub.
- A secured `leadbot-admin` Edge Function and Operator Console production panel were added for token verification, webhook activation, manager-chat claiming, integration credentials, calculator rates and lead monitoring.
- Google Sheets, generic CRM, external webhook and OpenAI-compatible AI FAQ adapters are implemented as configurable modules.
- A Google Apps Script adapter for the Sheets sink is tracked in the repository.
- The public Telegram runtime fails closed while the instance is inactive; synthetic acceptance returned `503 instance_inactive` before activation, as intended.
- Client roles `anon` and `authenticated` have no direct SELECT access to LeadBot instance or lead tables.
- Security Advisor reported only intentional deny-by-default RLS informational notices plus the pre-existing leaked-password-protection warning.
- Production code and migrations were committed to the public repository so the module is reproducible.

## 2026-09-08 — First real LeadBot lead and automatic Sheets delivery

- The Telegram bot for `ord-000003-lighting` was activated with a real BotFather token and authenticated webhook.
- The manager chat was bound through the one-time `/claim` flow without manually searching for a Telegram chat ID.
- The first real runtime lead became **LB-000001**.
- The full questionnaire completed with persistent answers and no active abandoned session.
- Telegram update receipts proved idempotency: every accepted update ID was unique and no duplicate lead was created.
- A non-binding lighting-work calculator was configured explicitly rather than inventing a fake exact commercial price.
- For LB-000001, the calculator produced a **5,250 RUB** preliminary work estimate from the configured rule set; materials and non-standard conditions remain manager-confirmed.
- **SFH MiniCRM** and the protected read-only client API became ready.
- Google Sheets was first attempted through `IMPORTDATA`, but Google's external-data authorization flow proved unreliable and was deliberately removed.
- The production integration was replaced by a real push chain:
  `Supabase outbox → autonomous retry worker → Make webhook → Google Sheets API`.
- Make Google Sheets authorization succeeded and a production scenario was created.
- LB-000001 was deliberately removed from the spreadsheet and its outbox reset; the real production worker then re-sent the same lead.
- Worker result: HTTP **200**, Make execution **success**, outbox `succeeded`, one attempt.
- LB-000001 automatically reappeared in the Google Sheet with its current **5,250 RUB** estimate.
- This proves the Sheets path without manual row insertion.

## 2026-09-08 — Generative FAQ blocker recorded instead of hidden

- The purchased AI FAQ option was not falsely marked ready merely to make the dashboard green.
- Make keyless Gemini and OpenAI Simple Text Prompt modules were tested as a no-extra-API-key path.
- Gemini execution reached the provider but Make generated malformed/empty content for the prompt.
- OpenAI GPT-5 nano executions completed but provider usage showed effectively empty prompts and returned generic unrelated responses even though Make's mapper contained the intended knowledge-base text.
- The broken Make AI FAQ scenario was disabled to prevent credit waste and misleading customer output.
- The LeadBot retains its safe local FAQ knowledge-base fallback.
- A provider-independent **Station AI Gateway** was promoted to a platform-level next layer so FAQ, extraction, translation, planning and other modules can share one auditable provider abstraction rather than accumulating per-bot credentials and hacks.

## 2026-09-08 — Constitution Draft 0.3 and Governance 0.4 begin

- The original 15-principle Constitution Draft 0.2 was expanded into **Constitution Draft 0.3**.
- Article 0 remained unchanged and immutable.
- Draft 0.3 added participant rights, privacy, due process, contribution attribution, protection against retroactive rule changes, truthful metrics, economic safeguards, planet/future-generation principles, AI/machine governance rules, separation of powers, transitional founding stewardship, conflict-of-interest rules, expiring emergency powers, federation, multilingual rights, anti-capture forkability and a ratification/amendment architecture.
- A complete public Russian version was added as `CONSTITUTION_RU.md` rather than treating multilingual access as a future decoration.
- **Governance Working Draft 0.4** was created to turn constitutional principles into testable institutions rather than ceremonial councils.
- Proposed mature governance bodies now include:
  - Builders & Contributors Council;
  - Participants & Dreams Assembly;
  - Partners & Nodes Council;
  - Independent Rights & Audit Board;
  - AI & Systems Advisory Forum, initially advisory without independent binding political votes.
- Decision classes were separated into operational, economic, rights/disciplinary, constitutional and emergency decisions.
- Founding power is explicitly described as **strong but transitional**: enough to build and defend the system before a genuine community exists, but not a permanent claim to unlimited political authority.
- Candidate transition thresholds and shadow-governance testing were documented as proposals, not ratified rules.
- The project roadmap was changed so constitutional development, shared platform infrastructure and real economic proof proceed on parallel rails.

## Why keep this log?

If the project grows, its origin should remain auditable. The station is intended to be built in public: principles, architecture, mistakes, revisions and milestones should leave a historical record.
