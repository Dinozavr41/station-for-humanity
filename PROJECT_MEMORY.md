# Station for Humanity — Canonical Project Memory

This file is the anti-forgetting source of truth for major project decisions and current state. Detailed historical milestones belong in `FOUNDING_LOG.md`; this file keeps the durable principles, architecture and latest accepted state.

## Identity

- Public name: **Station for Humanity**
- Primary domain: **stationforhumanity.com**
- Founding year: **2026**
- Development model: **build in public**
- Core phrase: **A place in the future for everyone.**
- Public repository: `Dinozavr41/station-for-humanity`

## Immutable foundation

### ARTICLE 0 — LIFE FOR LIFE

> Life creates intelligence.  
> Intelligence creates possibilities.  
> Possibilities must return to life.

> Жизнь создаёт разум.  
> Разум создаёт возможности.  
> Возможности должны служить жизни.

**Article 0 is immutable.** If a business model, algorithm, investor decision, governance rule or technology conflicts with Article 0, the decision changes — not Article 0.

## What Station for Humanity is trying to become

Station for Humanity is not intended to remain a normal single corporation, software agency, donation site or speculative token project.

The long-term direction is a **global digital society / value network** in which people, AI systems, machines, businesses, knowledge and physical resources can cooperate to create measurable useful value.

The desired relationship is:

`human + AI + machines + knowledge + resources → more possibility for life`

Automation should increase human security and opportunity rather than make people economically disposable.

## Core value loop

1. A real person or organization brings a need.
2. Humans, AI, software modules and machines help produce a useful result.
3. The result and evidence of delivery are recorded.
4. Value creation, costs and contribution are attributed.
5. Legitimate creators, owners and infrastructure receive reward.
6. Sustainable network productivity may support builders, opportunity, resilience and verified dreams.
7. Useful modules become reusable building blocks for later work.

## Major modules

### Digital Factory
First commercial engine:

`intake → specification → pricing → payment → production → QA → delivery → accounting`

The Digital Factory is a proof mechanism, not the final identity of the Station.

### Join / Identity
Five initial entry roles:

1. I need something.
2. I can build.
3. I have a resource.
4. I want to contribute.
5. I have a dream.

### Value Ledger
Records attributable value, including:

- useful outcome;
- sale value and direct costs;
- human contribution;
- module contribution;
- AI/model contribution and cost;
- infrastructure contribution;
- royalties / ownership / approved allocations;
- delivery evidence.

### Dream Commons
Matches verified human goals with money, skills, equipment, discounts, logistics, knowledge and existing resources. The objective is not simply fundraising; it is reducing the real cost of achieving goals through matching.

### Module Market
Reusable software, AI, design and production modules. Useful modules may receive attributable royalties when reused.

### Social Layer
Target mechanisms:

- Dream Fund;
- Builder & Pension Pool;
- Opportunity Fund;
- Emergency Fund;
- future automation-dividend mechanisms after sustainable economics and legal review.

### Governance & Audit
Rights, human appeal, transparent rules, independent review, constitutional change history and future distributed representation.

### Dream Station
Long-term federated network of independent regional/professional nodes, companies, communities, AI systems and machines operating above a common constitutional floor.

## Constitutional state

### Constitution Draft 0.3

`CONSTITUTION.md` and `CONSTITUTION_RU.md` are the current public working constitutional drafts.

Only Article 0 is currently immutable. Draft 0.3 adds a serious constitutional framework covering:

- universal participation direction and dignity;
- No One Becomes Obsolete;
- privacy and data agency;
- due process and human appeal;
- contribution attribution;
- protection against retroactive economic rewriting;
- truthful metrics;
- builder/founder protection without absolute rule;
- financial auditability;
- planet and future generations;
- AI/machine participant rules and provenance;
- no self-granted AI authority;
- provider independence;
- separation of governance functions;
- transitional founding stewardship;
- conflicts of interest;
- expiring emergency power;
- federation, multilingual rights and anti-capture forkability;
- constitutional layers, amendment and ratification process.

Draft 0.3 is **not yet legally or democratically ratified governance**.

### Governance Working Draft 0.4

`GOVERNANCE.md` is the first concrete institutional design.

Proposed mature bodies:

- **Builders & Contributors Council (BCC)**;
- **Participants & Dreams Assembly (PDA)**;
- **Partners & Nodes Council (PNC)**;
- **Independent Rights & Audit Board (IRAB)**;
- **AI & Systems Advisory Forum (ASAF)** — advisory, no independent binding vote in the current draft.

Decision classes are separated into operational, economic, rights/disciplinary, constitutional and emergency decisions rather than forcing every issue into one universal vote.

Founding authority is explicitly **strong but transitional**. Founders may retain legitimate long-term economic builder rights without retaining unlimited political power forever.

Candidate transition thresholds are proposals only and must be tested before ratification.

## Economic principles already agreed

- Nobody pays for the right to earn.
- MLM-style endless downlines are not the economic foundation.
- Reward follows real value, legitimate ownership, lawful capital or clearly defined contribution.
- Limited disclosed referral rewards may exist but not recursive infinite chains.
- Useful reusable modules may earn royalties.
- Founders and early builders deserve real long-term economic protection for genuine foundational contribution.
- Replacing technology must not automatically erase verified founding contribution.
- Builder economic protection does not create unlimited governance authority.
- Exact social/dividend percentages are **not constitutional policy yet**.
- Tokenization is a possible later implementation layer, not the beginning. First: real customers, lawful structure, Value Ledger, accounting, fraud controls and a real reason for tokenization.

## Financial control principles

The financial subsystem must fail closed.

- LIVE payments, payouts and automatic refunds default **OFF**.
- Test and live money are separate and visibly tagged.
- Browser state is never proof of provider payment success.
- Payment creation and webhook processing require idempotency.
- Double-entry accounting is the canonical financial record.
- Payment state and ledger state should reconcile atomically / idempotently.
- Posted ledger history is immutable; corrections use reversing/correcting entries.
- Consequential financial/operator actions are auditable.
- Roles are separated: contributor, operator, finance, risk, admin, auditor.
- Client database access is deny-by-default for financial/audit/control data.
- Live-money launch requires stronger approvals, authentication/MFA, legal/payment readiness and accounting compliance.

## Financial acceptance state

The YooKassa **TEST** path has been exercised end-to-end:

`checkout → test card → 3DS → verified webhook → provider API re-check → order paid → balanced ledger → full TEST refund → verified refund → reversing ledger → refunded`

A real reconciliation bug discovered during testing was fixed by changing payment processing from early-return idempotency to **full-state idempotent reconciliation**.

Autonomous financial watchdog:

- Supabase `pg_cron + pg_net` every 5 minutes;
- internal scheduler token held in Vault;
- `reconciliation_runs` history;
- `reconciliation_incidents` queue;
- Financial Health dashboard;
- balanced-ledger and payment/order/refund invariants;
- live-money control guard.

Last accepted state:

- Financial Health: **HEALTHY**;
- open incidents: **0**;
- LIVE payments: **OFF**;
- payouts: **OFF**;
- automatic refunds: **OFF**;
- `max_live_payment = 0 RUB`.

This proves sandbox resilience, **not authorization for real money**.

## Digital Factory / Product 01 state

### SFH LeadBot 1.0 (`TGBOT_LEADS_V1`)

Founding base price: **14,900 RUB** plus server-priced modules.

First accepted production case:

**DF-000001 → ORD-000003 → Q-000003 = 70,900 RUB**

This is an internal production acceptance case, not genuine external revenue. `ORD-000003` is not allowed to create a real Value Created event.

### Verified production capabilities for `ord-000003-lighting`

- reusable multi-instance Telegram runtime — **READY**;
- real Telegram bot + webhook — **READY**;
- Vault-backed bot token and webhook secret — **READY**;
- manager chat binding — **READY**;
- persistent questionnaire sessions — **READY**;
- Telegram update-id idempotency — **READY**;
- first real runtime lead **LB-000001** — **ACCEPTED**;
- manager notification — **READY**;
- calculator — **READY**, explicitly non-binding market baseline;
- SFH MiniCRM — **READY**;
- protected client API — **READY**;
- Google Sheets — **READY** via `Supabase outbox → worker → Make → Google Sheets`;
- LB-000001 was deliberately removed from Sheets and regenerated through the real production outbox to prove the automation path;
- safe local FAQ knowledge-base fallback — **READY**;
- generative AI FAQ — **NOT READY**.

### AI FAQ blocker

Make keyless AI was tested with both Gemini and OpenAI Simple Text Prompt paths.

The Make modules could execute, but the API-created module configuration did not correctly pass the intended prompt to the model (OpenAI showed effectively empty prompt usage; Gemini produced malformed content). The scenario was disabled rather than allowing misleading customer responses or wasting credits.

Do **not** mark generative AI FAQ as delivered merely to make the readiness dashboard green.

This blocker should become the first consumer/use case for a **shared Station AI Gateway**.

## Shared Station AI Gateway — next platform layer

The AI Gateway must prevent every product from becoming its own pile of provider credentials and one-off prompting logic.

Required direction:

- multiple provider adapters;
- task classes (FAQ, extraction, translation, planning, code, classification, etc.);
- provider/model/version provenance;
- cost and latency accounting;
- permission and data-sensitivity policy;
- knowledge grounding / retrieval;
- deterministic fallback;
- output validation;
- human escalation for consequential tasks;
- circuit breakers and budget limits;
- audit events for future Value Ledger attribution;
- no single model provider as irreversible dependency.

## Social model

The social layer is central, not decorative.

Key promise:

> **No One Becomes Obsolete.**

A profession may become obsolete. A person should have a path toward another role, skill and source of dignity and income.

Social mechanisms must be financially sustainable, legally reviewed and auditable rather than promises funded by imaginary future money.

## Planet principle

The planet is a stakeholder. Energy, materials, water, waste, emissions, logistics, biodiversity effects and resource depletion belong in the real accounting of value when material.

A profitable process that materially destroys the conditions for life cannot be treated as fully positive value under Article 0.

## AI / advanced automation direction

AI is a powerful participant class and shared capability, not an automatic ruler or independent political class.

Current constitutional direction:

- AI output/actions should have provenance;
- permissions must be explicit;
- AI cannot self-grant authority;
- high-impact AI requires stronger audit/review;
- humans retain meaningful appeal against consequential automated decisions;
- future evidence of genuinely autonomous non-human intelligence may justify a new constitutional rights process, but such rights are not assumed from fluent language generation alone.

## Founding Dream

### Dream #000001 — PILOT

Milestones:

1. introductory flight;
2. medical clearance;
3. PPL(A);
4. seaplane qualification;
5. long-term aircraft ownership/access path.

Public progress remains **0%** until actual verified events occur. Dream #000001 is intended to prove that real Station-created value can move a human goal, not to become a disguised donation counter.

## Public metrics rule

Only real recorded events move public counters:

- Value Created;
- People Earning;
- Dreams Completed;
- Social Support Delivered.

No invented traction.

## Current technical stack / state

- primary site: `stationforhumanity.com`;
- Vercel production hosting;
- GitHub `main → Vercel` deployment;
- Supabase production backend in West EU;
- public Founding Ticket Edge Function;
- Digital Factory Pricing Engine and `/factory/`;
- secured `/operator.html`;
- YooKassa TEST payment/refund/reconciliation functions;
- PostgreSQL double-entry ledger and audit;
- pg_cron/pg_net autonomous watchdog;
- reusable Telegram LeadBot runtime;
- Make automation connected for Google Sheets push;
- secrets stored in Supabase Vault where appropriate;
- current public language support: Russian + English;
- Constitution Draft 0.3 published in English and Russian;
- Governance Working Draft 0.4 published.

## Immediate build order

Work now proceeds on **three parallel rails**, not one endless feature chain.

### Rail A — Constitution / society

1. classify Constitution 0.3 articles into entrenched Level 1 vs adaptable Level 2;
2. refine Governance 0.4 institutions and founder-transition state machine;
3. expose Constitution 0.3 and governance status clearly on the public site;
4. design machine-readable proposals, amendment history and conflict-of-interest records;
5. design appeals data model before automated decision volume grows;
6. run governance capture simulations before binding governance exists.

### Rail B — shared technical platform

1. build provider-independent Station AI Gateway;
2. use LeadBot FAQ as first Gateway consumer;
3. create canonical module interface / registry direction;
4. connect AI/model cost and provenance to future Value Ledger.

### Rail C — real economy

1. finish LeadBot QA without falsely claiming the generative-AI module is ready;
2. complete legal/live payment and authentication readiness;
3. acquire first genuine external paying customer;
4. execute, QA and deliver;
5. create first real Value Ledger event;
6. legitimately reward first external contributor;
7. move Dream #000001 only with real Station-created value.

## Anti-forgetting rule

When a material feature, constitutional rule, economic principle or accepted system state changes, update this file in the same workstream.

Never make the project look more complete than it is. The Station should be ambitious in design and conservative in claims.
