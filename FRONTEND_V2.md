# Station for Humanity — Frontend V2 migration contract

Status: **preview / non-production shell**

## Design direction

- 70% cinematic / editorial clarity (Apple / SpaceX spirit, not imitation)
- 30% futuristic operational dashboard
- deep navy + ice/cyan as primary UI language
- gold reserved for the dream path, Dream Fund and primary moments
- people remain visually central; technology is infrastructure, not the protagonist
- real HTML text, accessible controls and responsive layout; illustrations are supporting layers

## Hard safety boundary

Frontend V2 MUST NOT silently change:

- Supabase schema, migrations or RLS
- Edge Function contracts
- YooKassa flows, webhook verification or finance posting
- Factory pricing rules
- Operator RBAC or operator workflows
- LeadBot production runtime
- governance storage/API semantics
- Article 0

Existing production surfaces remain canonical until separately accepted:

- `/` current public Alpha frontend
- `/factory/` Digital Factory
- `/operator.html` Operator Console
- `/constitution.html` Constitutional Center

The V2 preview lives under `/next/` and links state-changing actions back to the already-tested production surfaces.

## No fake metrics

Frontend V2 must not display aspirational numbers as current facts. Public counters either:

1. come from a verified backend/API source, or
2. are clearly labelled targets/examples, or
3. are omitted.

## Rollout gates

1. **Preview gate** — visual shell at `/next/`, zero backend changes.
2. **Navigation gate** — test all links, mobile layout, accessibility, language behavior.
3. **Read integration gate** — connect public governance/status data read-only.
4. **Action integration gate** — progressively attach existing tested Founding Ticket / Factory entrypoints without changing their backend contracts.
5. **Production swap gate** — only after explicit approval; preserve old homepage as rollback artifact.
6. **Post-swap acceptance** — Founding Ticket, Factory, Operator, YooKassa TEST, watchdog and governance smoke tests.

## Rollback principle

A frontend deployment must always be reversible without rolling back financial/database migrations. The visual shell is disposable; the ledger and audit history are not.
