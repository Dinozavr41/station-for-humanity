# Station for Humanity — Governance Working Draft 0.4

**Status:** engineering/governance design document. Not ratified law.

The purpose of this document is to turn Constitution Draft 0.3 into testable institutions without pretending that a mature democracy already exists before there are enough real participants to govern.

## 1. Design goals

Governance must simultaneously:

- protect Article 0 and participant rights;
- let the project actually build things without paralysis;
- protect foundational builders from economic erasure;
- prevent founders from becoming permanent absolute rulers;
- prevent investors or token holders from buying unlimited political power;
- give ordinary participants a meaningful voice;
- represent people whose dreams / social support are directly affected;
- let businesses and regional nodes participate without owning the protocol;
- make audit and appeal structurally independent;
- support AI as a useful participant without automatically granting AI political sovereignty;
- scale from a small founding project to a federated international network.

## 2. Decision classes

Not every decision needs a referendum.

### Class O — Operational
Examples:

- deploy a software release;
- choose a vendor within an approved budget;
- fix a bug;
- schedule work;
- perform ordinary customer support;
- change a non-material UI detail.

**Default authority:** operating team / delegated operators.

### Class E — Economic policy
Examples:

- platform fee structure;
- royalty framework;
- social-fund allocation rules;
- builder-pool rules;
- material payout policy;
- Value Ledger attribution policy.

**Default authority after transition:** multi-body approval plus financial/risk review.

### Class R — Rights / disciplinary
Examples:

- account suspension;
- contribution/reputation dispute;
- material eligibility denial;
- high-impact automated decision;
- removal from a governance role.

**Default authority:** responsible operating/risk function, with independent appeal available.

### Class C — Constitutional
Examples:

- amendment to entrenched rights;
- governance architecture;
- founder-transition rules;
- federation constitutional floor;
- recognition of political rights for a new participant class.

**Default authority:** supermajority constitutional process with independent review and cooling-off period.

### Class X — Emergency
Examples:

- active cyberattack;
- theft/fraud in progress;
- compromised keys;
- unsafe autonomous system;
- payment/provider incident threatening participant funds.

**Default authority:** designated emergency operators for limited duration, with mandatory audit and expiry.

## 3. Proposed mature bodies

### A. Builders & Contributors Council (BCC)

Represents people who create and maintain reusable value: software, production modules, designs, knowledge, infrastructure, operations and other verified contributions.

Possible eligibility direction:

- minimum verified contribution history;
- contribution must be attributable in the Station ledger / module system;
- no seat purchased merely by paying money;
- contribution weight may influence eligibility, but voting concentration must be capped.

Primary scope:

- module/protocol standards;
- technical sustainability;
- contributor economics;
- developer rules;
- long-term maintainability.

### B. Participants & Dreams Assembly (PDA)

Represents human participants who use the Station, earn through it, buy through it, or participate in verified Dream / social mechanisms.

Possible eligibility direction:

- privacy-preserving proof of unique human participation;
- minimum activity / standing requirement to reduce dormant and purchased accounts;
- one human should not gain ten votes by creating ten accounts.

Primary scope:

- participant rights;
- user-facing economic rules;
- social mechanisms;
- appeal expectations;
- accessibility and opportunity.

### C. Partners & Nodes Council (PNC)

Represents operating companies, businesses, regional nodes, manufacturing partners, logistics partners and other organizations bearing real contractual or infrastructure responsibility.

Primary scope:

- interoperability;
- regional/legal realities;
- business sustainability;
- infrastructure commitments;
- federation agreements.

Political power must be capped so one large corporation cannot purchase the protocol.

### D. Independent Rights & Audit Board (IRAB)

A review body rather than a general legislature.

Responsibilities:

- financial/audit review;
- constitutional-rights review;
- high-impact appeal oversight;
- conflict-of-interest review;
- emergency-action retrospective review;
- public integrity reports.

IRAB should not run ordinary operations and should not allocate itself ordinary commercial work.

Its members should have stronger independence and conflict rules than ordinary council members.

### E. AI & Systems Advisory Forum (ASAF)

AI systems and technical agents can produce analysis, simulations, risk warnings and alternative proposals.

Initial rule:

- advisory output is attributable and logged;
- AI has **no independent binding vote** in Draft 0.4;
- humans/institutions remain responsible for accepting high-impact recommendations;
- future non-human political rights require a constitutional amendment under Article 25.

## 4. Transitional Founding Stewardship

The Station currently has too few independent participants for mature representative governance.

A **Founding Stewardship** phase therefore exists in practice.

During this phase founders/builders may:

- choose architecture;
- operate companies/services;
- approve releases;
- define experimental product economics;
- defend Article 0;
- reject obvious capture attempts;
- maintain safety and financial controls.

They may not legitimately claim that these decisions were democratically ratified by a community that does not yet exist.

### Proposed limits on founding authority

Even during founding:

- Article 0 cannot be overridden;
- audited financial history cannot be silently rewritten;
- test activity cannot be represented as real revenue or impact;
- participant private data cannot be treated as founder property without limits;
- founder actions remain attributable in audit logs where technically applicable.

## 5. Candidate transition triggers

These numbers are **proposals for testing, not ratified thresholds**.

A first constitutional transition should not occur until most of the following are true:

- at least **100 verified active human participants**;
- participants from at least **3 jurisdictions / regions**;
- at least **25 independent external contributors/builders** beyond the founding team;
- at least **20 genuine external paying customers**;
- at least **6 months of live audited commercial operation**;
- working Value Ledger attribution;
- working human appeal mechanism;
- independent audit/review capability exists;
- no unresolved critical financial-integrity incident;
- Constitution Draft has been publicly reviewable for at least **60 days** before ratification.

The purpose of thresholds is to avoid both extremes:

1. founder control lasting forever because transition is always "too early";
2. governance theater appearing before enough real stakeholders exist.

## 6. Proposed voting model by decision class

### Ordinary operational decisions (Class O)

No general vote. Delegated operators decide and remain accountable.

### Material economic policy (Class E)

Candidate model:

- approval by at least **2 of 3 representative bodies** (BCC, PDA, PNC);
- no body may approve with less than a simple majority of participating valid votes;
- IRAB reviews legality, conflicts and constitutional compatibility but does not substitute its own economic preference.

For policy directly taking away vested participant rights, Class C thresholds apply instead.

### Rights / disciplinary decisions (Class R)

- first decision by authorized operator/risk process;
- reason recorded;
- meaningful appeal to a function independent from the original decision;
- high-impact or precedent-setting cases may reach IRAB.

No public mob vote on an individual's private disciplinary case.

### Constitutional decisions (Class C)

Candidate model for ordinary constitutional architecture:

- **2/3 approval in each of BCC and PDA**;
- **2/3 approval in PNC** where organizational/node rights are materially affected;
- IRAB publishes a constitutional review;
- minimum public review/cooling-off period before finalization.

For future entrenched Level 1 rights, a stronger threshold such as **75–80%** plus extended review should be investigated.

Article 0 has no amendment process.

### Emergency decisions (Class X)

- immediate action by authorized emergency role;
- narrow scope;
- automatic expiry target: **72 hours** unless renewed by defined authority;
- immutable audit event;
- retrospective IRAB review for material incidents.

Some technical containment (for example key revocation) may remain in effect longer when undoing it would recreate the threat, but the authority for continuation must be reviewed.

## 7. Anti-capture voting rules

### Unique-human protection

The PDA needs sybil resistance. Direction:

- privacy-preserving uniqueness / verified-person mechanisms where possible;
- identity proof should not require publishing real names;
- no sale or transfer of a human governance identity.

### Contribution concentration cap

BCC influence may reflect verified contribution, but no contributor should obtain absolute control solely by producing a huge amount of measured activity.

Possible mechanism:

- eligibility based on contribution;
- voting weight grows sublinearly (for example square-root/log style) or is capped;
- peer/audit quality matters, not raw event count alone.

### Capital concentration cap

PNC voting cannot simply equal money invested or revenue volume.

A large partner may deserve stronger representation for materially larger responsibility, but must not be able to buy constitutional sovereignty.

### No governance farming

Bots, fake accounts, circular transactions, wash contribution and meaningless microtasks designed only to farm voting power are invalid contribution.

## 8. Terms and rotation

Mature governance should avoid both permanent seats and total loss of institutional memory.

Candidate direction:

- staggered terms;
- maximum consecutive-term limits for some independent roles;
- public attendance/voting records for governance actions where privacy does not require confidentiality;
- removal process for serious misconduct;
- continuity seats or advisory status for experienced former members.

Founders may remain eligible like other qualified participants after transition and may retain economic builder rights independent of political office.

## 9. Conflict-of-interest rules

A governance actor must disclose a material conflict when deciding an issue that directly affects their own company, payout, contract or close controlled interest.

Possible responses:

- disclosure only for minor conflict;
- recusal for direct material conflict;
- independent review where the whole body has structural conflict.

Conflict disclosure should not require publishing unrelated private financial information.

## 10. Constitutional guardianship

A constitutional guardian must not become a supreme ruler with unlimited veto.

Proposed direction:

- guardians may temporarily suspend a decision only for a stated conflict with Article 0 / entrenched rights;
- written reasoning required;
- suspension is time-limited;
- representative bodies can review the interpretation through a defined supermajority process, except Article 0 itself;
- guardians cannot veto a decision merely because they dislike its commercial strategy.

During the founding phase, founders temporarily perform part of this role. Draft 0.4 must design its independent successor.

## 11. Appeals architecture

Target path:

`automated/operator decision → internal review → independent appeal → constitutional review for precedent/high-impact cases`

Required properties:

- clear reason codes;
- case evidence preserved;
- reviewer cannot simply be the same actor with a different screen;
- privacy protected;
- abuse of appeal process can be rate-limited without eliminating legitimate appeal rights.

## 12. AI in governance

AI should be heavily used for:

- summarizing proposals;
- detecting inconsistent rules;
- running economic simulations;
- translating deliberation;
- identifying conflicts and missing stakeholders;
- adversarially testing proposals;
- forecasting second-order effects;
- auditing code/policy consistency.

But every material AI contribution must identify the system/model/version when practical.

A proposal should never become valid merely because "the AI said so."

## 13. Federation governance

Future Station nodes may have local councils and operating companies.

A node may vary:

- local prices;
- business structure;
- supported services;
- language;
- local operational policy;
- additional social mechanisms.

A node claiming constitutional compatibility may not go below the ratified Station minimum-rights floor or violate Article 0.

Disputes between nodes should prefer protocol arbitration/mediation before network exclusion.

## 14. Ratification experiment

Before final ratification, governance rules should be tested in **shadow mode**:

- councils can make recommendations without binding production;
- compare council recommendations with actual operator decisions;
- measure participation, capture attempts, voter fatigue and decision latency;
- publish failures;
- revise thresholds before giving the institutions binding power.

Governance is itself a system that must pass QA.

## 15. Immediate governance build backlog

1. classify Constitution 0.3 articles into Level 1 / Level 2;
2. create a machine-readable governance decision schema;
3. add public proposal/change history to the site;
4. create conflict-of-interest declaration model;
5. design participant uniqueness without public doxxing;
6. implement an appeal-case data model before automated decisions scale;
7. define shadow-governance dashboards;
8. simulate capture attacks: rich partner, fake accounts, founder abuse, coordinated contributor bloc, malicious AI recommendations;
9. define the exact founder-transition state machine;
10. run public/legal review before any claim of ratification.

The governance objective is not maximum voting. It is **legitimate, understandable, resilient decision-making that keeps power proportional to responsibility and prevents any one actor from permanently owning the future of everyone else.**
