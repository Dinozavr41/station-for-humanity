# Station for Humanity — Canonical Project Memory

This file exists so the project does not lose its founding decisions as the codebase and contributor base grow.

## Identity

- Public name: **Station for Humanity**
- Primary domain: **stationforhumanity.com**
- Founding year: **2026**
- Public development model: **build in public**
- Core phrase: **A place in the future for everyone.**

## Immutable foundation

### ARTICLE 0 — LIFE FOR LIFE

> Life creates intelligence.  
> Intelligence creates possibilities.  
> Possibilities must return to life.

> Жизнь создаёт разум.  
> Разум создаёт возможности.  
> Возможности должны служить жизни.

Article 0 is the only principle currently declared immutable.

## What the project is trying to become

Station for Humanity is not intended to remain a normal single corporation or a donation site. The long-term direction is a **global digital society / value network** in which people, AI systems, machines, businesses, knowledge and physical resources can cooperate to create measurable value.

The desired outcome is that increasing automation improves human security and possibility instead of making people economically disposable.

## Core system loop

1. A real person or organization brings a need.
2. Humans, AI, software modules and machines help produce a useful result.
3. The created value is measured and recorded.
4. Income is distributed to the legitimate creators and infrastructure.
5. Part of network productivity can support builders, social resilience and verified dreams.
6. The network grows by adding useful modules and contributors.

## Major modules

### Digital Factory
Commercial engine for real orders:

`intake → specification → pricing → payment → production → QA → delivery → accounting`

This is the first revenue engine and must prove that the station can create real economic value.

### Join / Identity
Five initial ways to enter the station:

1. I need something.
2. I can build.
3. I have a resource.
4. I want to contribute.
5. I have a dream.

### Value Ledger
Records attribution such as:

- who created useful work;
- which modules were used;
- which infrastructure contributed;
- what value was created;
- how revenue and social allocations were distributed.

The ledger must distinguish contribution from mere recruitment.

### Dream Commons
Matches human goals with people, knowledge, equipment, skills, discounts, logistics, manufacturing and money.

The objective is not merely to raise cash, but to **reduce the real cost of achieving a goal by matching existing value with real needs**.

### Module Market
Reusable software, AI, design and production modules. A useful module may earn royalties when the station continues to use it.

### Social Dividend
A future mechanism through which part of productivity created by shared automation can return to participants and social systems.

### Governance & Audit
Human appeal, transparent rules, auditable funds, distributed representation and independent oversight.

### Dream Station
Long-term federated architecture: many independent modules, communities, companies, machines and AI systems docked into one value network.

## Economic principles already agreed

- Nobody pays for the right to earn.
- Endless recruitment chains and MLM-style downlines are not the economic foundation.
- Reward follows real value creation, legitimate ownership or clearly defined contractual contribution.
- A limited referral reward may exist, but should not create infinite multilevel income.
- Useful modules may generate long-lived royalties.
- Founders and early builders should receive real economic protection for genuine foundational contribution.
- Old technology becoming obsolete must not erase verified founding contribution.
- Builder protection must not create absolute political power.
- Future structures may include ownership, builder pools, royalties and pension-style support, but exact percentages are **not yet constitutional policy**.
- Tokenization is a possible later implementation layer, not the starting point. First comes the Value Ledger and real value creation.

## Financial control principles

The financial subsystem must fail closed rather than fail open.

- **Live payments, live payouts and automatic refunds default to OFF.** They are enabled only through an explicit control-plane change after testing and legal/payment readiness.
- **Test money and live money are separate modes.** Mock/test events must be visibly tagged and cannot be mistaken for real revenue.
- **The browser is never the source of truth for payment success.** Only a verified server-side provider event or server-side provider lookup may move an order to paid in live mode.
- **Idempotency is mandatory** for payment creation and webhook processing so retries cannot silently create duplicate charges or ledger events.
- **Double-entry accounting is the canonical financial record.** A posted financial transaction must balance debit and credit per currency.
- **Payment state and ledger state should be committed atomically where practical.** The system should not accept normal states such as “payment succeeded but accounting disappeared.”
- **Posted ledger entries are immutable.** Corrections are represented by new reversing/correcting entries rather than rewriting history.
- **Every consequential financial/operator action is auditable** with actor, entity, reason and timestamp.
- **Role separation is explicit:** contributor, operator, finance, risk, admin and auditor are different capabilities. Registration never grants privileged roles automatically.
- **Client-facing database access is deny-by-default.** Financial, audit, control, payment and payout tables do not get ordinary client policies merely for convenience.
- **Large or live financial actions will require additional approval rules** before real-money launch; Alpha mock/sandbox modes are not the final separation-of-duties model.

## Operator control direction

A secured operator console is part of the operational infrastructure.

Current intended workflow:

`Founding Ticket → review → accepted/rejected → Order → Quote → Payment → production → QA → delivered → ledger/audit`

Operator control must preserve these rules:

- users cannot self-promote into operator/admin/finance roles;
- users cannot directly set their own ticket/order/payment states;
- pricing changes are versioned rather than silently overwritten;
- privileged transitions are executed server-side and recorded in audit history;
- financial controls remain independent from UI state so a broken or modified browser cannot switch on real money.

## Alpha 0.3 finance acceptance result

The first internal financial acceptance test created **TEST Order #000001** with a 1,000 RUB quote and a mock payment. The payment reached `succeeded`, the order reached `paid`, the ledger transaction reached `posted`, and debit/credit each equaled **1,000.00 RUB**. No real money moved.

This proves the first controlled financial state loop, not commercial readiness.

## Alpha 0.6 financial watchdog state

The external YooKassa sandbox path has now been exercised end-to-end for **TEST Order #000002**: checkout, test card + 3-D Secure, verified payment webhook, provider API re-check, `paid`, double-entry ledger, full TEST refund, refund webhook, provider re-check, reversing ledger and final `refunded` state.

A real integration bug was discovered during sandbox acceptance: a verified provider payment could be marked `succeeded` locally before the original reconciliation RPC ran, causing the RPC to return too early and skip order/ledger reconciliation. The processing function was changed from “already succeeded means done” to **idempotent full-state reconciliation**. Replaying the same verified event no longer creates duplicate order events or ledger entries.

The financial subsystem now includes an autonomous server-side watchdog:

- Supabase `pg_cron + pg_net` invokes provider reconciliation every **5 minutes** even when no operator browser is open;
- the scheduler authenticates with an internal token generated server-side and stored in Supabase Vault;
- every run is persisted in `reconciliation_runs` with trigger, checked entities, changes, errors and result;
- provider/API failures and local financial inconsistencies are persisted in `reconciliation_incidents`;
- critical invariants include balanced posted ledger transactions, required payment/refund ledger records, order/payment state agreement and the live-money control guard;
- incidents may be acknowledged by finance/risk/admin, but healthy reconciliation automatically resolves the underlying incident only when the actual state is healthy again;
- the Operator Console exposes a Financial Health dashboard, emergency queue and recent watchdog runs;
- the browser reconciliation remains an additional operator convenience, but it is no longer required for autonomous recovery.

Current accepted Alpha 0.6 health state after server-side reconciliation:

- `HEALTHY`;
- ledger imbalances: **0**;
- missing payment ledgers: **0**;
- missing refund ledgers: **0**;
- order/payment mismatches: **0**;
- stale pending payments: **0**;
- open incidents: **0**;
- LIVE payments: **OFF**;
- payouts: **OFF**;
- automatic refunds: **OFF**;
- `max_live_payment = 0 RUB`.

This proves resilient sandbox financial processing and monitoring. It still does **not** authorize live-money launch.

## Alpha 0.7–0.8 Digital Factory / LeadBot state

The first narrow Digital Factory product is **SFH LeadBot 1.0** (`TGBOT_LEADS_V1`). Its founding base price is **14,900 RUB** and server-priced options cover additional flows, Google Sheets, calculator, external API, basic CRM, AI FAQ and priority delivery.

The public factory page now creates a fixed server-side quote, persistent Factory Request, commercial Order and Quote in one audited flow. The first accepted factory request is **DF-000001 → ORD-000003 → Q-000003**, configured for lighting installation with every available option selected, total **70,900 RUB**.

This first request is a production acceptance case, **not real revenue**. `ORD-000003` remains `quoted` because the live-money control plane is still OFF.

A reusable **LeadBot multi-instance runtime** has been built for production fulfillment:

- Telegram conversations are configuration-driven rather than hard-coded per customer;
- persistent sessions allow multi-step questionnaires;
- Telegram `update_id` receipts provide webhook idempotency;
- completed leads, runtime events and integration outbox are stored in RLS-protected tables;
- the first instance `ord-000003-lighting` contains installation estimate, engineer consultation, site visit, commercial-object and FAQ flows;
- manager notifications are supported;
- calculator logic exists but customer-specific rates must be explicitly configured before it emits prices;
- Google Sheets, generic CRM and external webhook adapters are implemented;
- AI FAQ can use the local FAQ knowledge base and an optional OpenAI-compatible provider configured at runtime;
- Telegram tokens, webhook secrets, manager chat IDs, external URLs and API keys are stored in Supabase Vault, not GitHub or browser storage;
- Telegram webhook requests are authenticated with the provider-supported secret-token header;
- `anon` and ordinary `authenticated` database roles have no direct access to LeadBot instance/lead tables;
- `leadbot-admin` gives admin-only credential setup and activation, while operator roles can read production status;
- Operator Console exposes per-feature readiness, activation, manager binding, calculator configuration, lead list and failed integration outbox state;
- production runtime source, database migrations and Google Sheets adapter are tracked publicly in GitHub.

Two readiness levels are intentionally separate:

- `core_ready` — secure Telegram runtime can be activated;
- `delivery_ready` — every purchased integration plus manager channel and calculator rates are configured.

**ORD-000003 is not delivered yet.** Runtime code and the first instance are built and audited; full acceptance still requires the external BotFather token, manager chat claim, customer-approved calculator rates, Google Sheets endpoint, CRM/API details and AI provider credentials for the options selected in DF-000001.

## Social model already agreed

The social layer is central, not decorative.

Target mechanisms include:

- **Dream Fund** — verified human goals;
- **Builder & Pension Pool** — long-term protection of people who spent years building the system;
- **Opportunity Fund** — education, retraining and tools;
- **Emergency Fund** — transparent crisis support for verified participants.

Key promise:

> **No One Becomes Obsolete.**

A profession may become obsolete. The person must have a path toward another role, skill and source of dignity and income.

## Governance direction

The network should not become a permanent dictatorship of founders, investors, one corporation or one AI provider.

Possible future representation layers discussed:

- Builders Council
- Contributors Council
- Dream / beneficiary representation
- Partners Council
- Independent ethics and audit oversight

Any consequential automated decision affecting a participant should have a meaningful path to human appeal.

## Planet principle

The planet is a stakeholder. Energy, materials, water, waste, emissions, logistics and resource depletion belong in the real accounting of value.

A profitable process that destroys the conditions for life cannot be treated as fully positive value.

## AGI / automation direction

The project is explicitly designed around the idea that advanced AI should become a source of **shared capability**, not a reason for people to fear being discarded.

The intended relationship is:

`human + AI + machines + knowledge + resources → more possibility for life`

AI is not declared a ruler, owner or independent political class. More capable intelligence implies more responsibility, auditability and safety requirements.

## Founding Dream

### Dream #000001 — PILOT

The first public proof case is a real path toward becoming a pilot and eventually reaching an amphibious-aircraft ownership goal.

Planned milestones:

1. introductory flight;
2. medical clearance;
3. PPL(A);
4. seaplane qualification;
5. long-term aircraft ownership path.

This is **not** intended to be presented as a simple donation request. It is meant to become proof that useful economic activity generated by the station can move a real human goal from zero to completion.

## Public metrics to use later

Only real recorded events should move these counters:

- Value Created
- People Earning
- Dreams Completed
- Social Support Delivered

Until a backend records real events, public counters should remain zero rather than displaying invented traction.

## Technical state at Alpha 0.8

- Public domain active: `stationforhumanity.com`
- Static production hosting: Vercel
- Source control: GitHub repository `Dinozavr41/station-for-humanity`
- Production pipeline: GitHub `main` → Vercel → primary domain
- Languages currently implemented: Russian and English
- Persistent backend: Supabase project `station-for-humanity-prod` in West EU
- Public Founding Ticket intake is live through an Edge Function with validation, consent, honeypot and rate limiting
- Public Digital Factory and server Pricing Engine are live at `/factory/`
- Secured Operator Console is deployed at `/operator.html`
- Role-gated operator, factory-admin, leadbot-admin and financial-health Edge Functions are active
- Value/financial schema includes orders, quotes, payments, refunds, double-entry ledger, allocations, payouts, approvals, audit, system controls, reconciliation runs and reconciliation incidents
- YooKassa TEST payment and full-refund adapters are active with server-side provider verification
- Autonomous YooKassa TEST watchdog is scheduled every 5 minutes through `pg_cron + pg_net` using a Vault-held internal token
- Reusable Telegram LeadBot runtime and first ORD-000003 instance exist in production
- LeadBot secrets are Vault-backed; lead/session/outbox tables are deny-by-default to client roles
- Live payments, payouts and automatic refunds remain OFF; `max_live_payment` remains 0 RUB
- Article 0, production migrations, LeadBot source and founding log are public repository artifacts.

## Immediate build order

1. Complete **ORD-000003** external configuration: BotFather token → Telegram webhook → manager claim → real lead acceptance.
2. Configure customer-approved lighting calculator rates rather than inventing commercial prices.
3. Connect the purchased Google Sheets, CRM, external API and AI FAQ providers and verify outbox delivery.
4. Run LeadBot QA: all four flows, FAQ, duplicate update replay, manager notification, persistence, restart continuity and integration failure/recovery.
5. Do **not** count ORD-000003 as real revenue or Value Created while it remains unpaid/internal acceptance work.
6. Complete legal/payment readiness for the operating entity and strengthen production authentication/MFA before any live-money switch.
7. Implement the live payment adapter behind the existing fail-closed control plane and approval rules; do not enable it by default.
8. Acquire and execute the first genuine external customer order with payment, QA, delivery, accounting and provider reconciliation.
9. Create the first **real**, non-test Value Ledger event and legitimate contributor attribution.
10. Move Dream #000001 above 0% only using real station-created value.

## Anti-forgetting rule

When a new design, feature or economic rule materially changes one of the decisions above, update this file in the same change set and explain why.
