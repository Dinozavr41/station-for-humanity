# Station for Humanity — Roadmap

This roadmap prioritizes proving real value loops **while building the constitutional layer in parallel**. Station for Humanity must not accidentally become only a software agency because the first revenue engine happens to be software.

> **Version note:** runtime/software Alpha numbers move faster than economic and constitutional milestones. Economic proof is never declared complete merely because software shipped, and governance is never declared democratic merely because a document or voting screen exists.

## Public foundation — DONE

- registered `stationforhumanity.com`;
- deployed the first public site;
- published immutable Article 0;
- created the public GitHub repository;
- connected GitHub → Vercel → production domain;
- established the Founding Log and canonical project memory.

## Constitutional foundation — DRAFT 0.3 COMPLETE / 0.4 NEXT

Constitution Draft 0.3 now defines a substantially fuller constitutional direction:

- participant dignity, access and privacy;
- due process and human appeal;
- contribution attribution and protection from retroactive rule changes;
- builder/founder economic protection without permanent absolute rule;
- financial auditability and truthful metrics;
- planet and future generations as design stakeholders;
- AI/machine participation, provenance and no self-granted authority;
- provider independence;
- separation of governance functions;
- transitional founding stewardship;
- conflicts of interest and expiring emergency powers;
- federation, multilingual access and anti-capture forkability;
- constitutional layers, amendment and ratification requirements.

English and Russian Draft 0.3 versions are public repository artifacts.

### Next constitutional milestone — Draft 0.4: Institutions & Ratification

Define concrete, testable governance rather than abstract councils:

1. which bodies exist and what each may decide;
2. who qualifies to participate in each body;
3. how sybil resistance and privacy coexist;
4. how builders, ordinary participants, dream beneficiaries, partners/nodes and independent review are represented;
5. what founding authority exists during transition and exactly when it declines;
6. voting/consent thresholds by decision class;
7. independent appeal and audit procedures;
8. emergency-action expiry and retrospective review;
9. ratification electorate / stakeholder process;
10. how governance operates across jurisdictions without pretending to be a sovereign state.

The governance system should be built only as fast as real participants and real consequences justify it.

## Social entry layer — DONE / ITERATING

- five-role Join the Station interface;
- persistent Founding Tickets;
- public Dream #000001 — PILOT;
- public Value Ledger concept;
- public social contract architecture;
- Constitution Draft 0.3;
- honest zero-based public metrics.

## Real intake backend — DONE

A person can submit a real Founding Ticket and receive a persistent Station identifier.

Implemented:

- Supabase backend and database;
- identity/session model;
- consent and privacy controls;
- spam/rate-limit protection;
- role persistence;
- admin/operator review queue;
- public/private field separation;
- audit trail.

## Financial sandbox & control plane — DONE FOR TEST MODE

Implemented and accepted:

- YooKassa sandbox checkout;
- webhook verification plus provider API re-check;
- idempotent payment processing;
- full TEST refund;
- double-entry payment and reversing refund ledger;
- autonomous server watchdog every 5 minutes;
- reconciliation incidents and Financial Health dashboard;
- LIVE payments, payouts and automatic refunds remain fail-closed/OFF.

This proves resilient sandbox processing. It does **not** authorize live-money launch.

## Digital Factory MVP — IN PROGRESS

Goal: accept one narrow category of real commercial work from intake to delivery while extracting reusable production modules for the wider Station.

Selection criteria:

- strong automation potential;
- clear customer value;
- low fulfillment ambiguity;
- low regulatory burden;
- fast QA;
- ability to price competitively;
- reusable modules that can later serve other Station participants.

### Product 01 — SFH LeadBot 1.0 — PRODUCTION ACCEPTANCE

A fixed-scope Telegram lead-capture bot for small businesses.

Commercial path:

`public product page → server Pricing Engine → fixed estimate → DF request → ORD → Quote → operator commercial queue`

Base offer:

- **14,900 RUB**;
- target delivery: **3 business days**;
- up to 7 questionnaire steps;
- manager notification in Telegram;
- database storage;
- deployment;
- source code + handover guide;
- 7 days bug-fix support.

Server-priced options include extra flows, Google Sheets, calculator logic, webhook/API, basic CRM, AI FAQ and priority delivery.

### First production acceptance case — DF-000001 / ORD-000003

Current verified state:

- reusable multi-instance Telegram runtime — **READY**;
- real Telegram bot + provider webhook — **READY**;
- manager-chat binding — **READY**;
- first persistent lead **LB-000001** — **ACCEPTED**;
- calculator with explicit non-binding market baseline — **READY**;
- Google Sheets — **READY via real push path** `Supabase outbox → worker → Make → Google Sheets`;
- first existing lead was deleted from the sheet and regenerated through the real outbox path to prove automation;
- SFH MiniCRM — **READY**;
- protected client API — **READY**;
- safe local FAQ knowledge-base fallback — **READY**;
- generative AI FAQ provider — **BLOCKED / NOT CLAIMED READY**.

The attempted Make keyless Gemini/OpenAI Simple Text Prompt path was tested and rejected for production acceptance: the modules executed but Make's API-generated configuration failed to pass the prompt correctly to the model. The broken scenario was disabled so it cannot consume credits or return misleading customer answers.

This blocker should be solved at the **shared Station AI Gateway layer**, not by accumulating one-off bot-specific AI credentials.

`ORD-000003` is still an internal production acceptance case, **not external paid revenue**, and must not create a real Value Created event.

## Shared AI Gateway — NEXT TECHNICAL PLATFORM LAYER

The LeadBot AI FAQ blocker exposes a broader requirement that already existed in the architecture: Station needs a provider-independent AI orchestration layer.

The first Gateway should provide:

- provider adapters rather than hard-coding one model vendor;
- task classes (FAQ, extraction, translation, planning, coding, classification);
- model/version provenance;
- per-task cost and latency accounting;
- permission and data-sensitivity policy;
- retrieval / knowledge grounding;
- deterministic fallback when AI is unavailable;
- output validation and human escalation for consequential tasks;
- circuit breakers and budget limits;
- audit events suitable for future Value Ledger attribution.

LeadBot AI FAQ becomes the first consumer, not the architecture owner.

## Digital Factory MVP completion criteria

1. finish QA checklist for the first reusable LeadBot runtime;
2. solve generative FAQ through the shared AI Gateway or explicitly rescope the commercial feature before selling it;
3. complete legal/payment readiness for live charging or use another compliant invoicing path;
4. acquire a genuine external customer;
5. execute production and QA from reusable modules;
6. deliver source/deployment evidence;
7. record payment and accounting lawfully;
8. create the first **real** Value Ledger event.

## Value Ledger MVP — NEXT ECONOMIC PROOF

Goal: the first genuinely paid and delivered external order creates the first auditable value event.

Record:

- order value;
- direct costs;
- human contribution;
- module contribution;
- AI/model contribution and cost where applicable;
- infrastructure contribution;
- approved revenue allocations;
- delivery evidence;
- social/dream allocation if applicable.

## First external contributor

Goal: someone outside the founding build contributes useful work or a reusable module and receives a legitimate recorded reward.

## First dream movement

Goal: Dream #000001 moves from 0% using real Station-created value, with public evidence of the milestone but without exposing unnecessary sensitive data.

## Beta — Module economy

- module registry;
- module interfaces and permissions;
- versioning;
- usage metering;
- royalty attribution;
- QA / trust score;
- dispute handling;
- developer documentation.

## Later — Dream Commons

- verified dreams;
- decomposition into needs;
- matching money, skills, equipment, discounts, logistics and knowledge;
- milestone execution;
- impact verification.

## Later — Social dividend and mature governance

Only after sustainable unit economics, real participants and legal review:

- builder / pension mechanisms;
- opportunity and emergency mechanisms;
- automation dividend;
- ratified representative governance;
- independent audit;
- federation of regional / professional nodes.

## Long horizon — Dream Station

A federated global value network in which many independent people, communities, companies, AI systems and machines can dock useful capabilities without any one participant needing to build the whole system.

The long-term target is not merely more automation. It is a system in which growing intelligence creates **more agency, security and possibility for life**.
