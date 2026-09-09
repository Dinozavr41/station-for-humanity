# SFH Design Factory 3×6 — Alpha 2.0

Date: 2026-09-09
Branch: `frontend-v2-exact`

## Product goal

Remove the repetitive billboard/banner design bottleneck from advertising-production companies (РПК), starting with the most common 6000×3000 mm format.

The system is not an unconstrained AI designer. It is a controlled production pipeline where deterministic rules own intake, state, validation, versioning and print readiness; AI/design tools may later generate draft concepts inside those constraints.

## Production pipeline

`LeadBot / web intake → structured brief → validation → layout blueprint → draft renderer → review → revision → approval → printer-specific preflight → PRINT_READY → export package`

Current Alpha 2.0 acceptance reaches `layout blueprint` and implements the final preflight safety gate. The visual draft renderer is the next module.

## Core entities

### design_jobs
One production task. Current first product type: `billboard_3x6` with physical size fixed to 6000×3000 mm.

States:

- `brief_incomplete`
- `brief_ready`
- `blueprint_ready`
- `drafting`
- `draft_ready`
- `client_review`
- `revision`
- `approved`
- `preflight`
- `print_ready`
- `blocked`
- `canceled`

### design_briefs
Versioned structured customer brief containing campaign goal, headline, offer, CTA, contact/address, style, source-material status and deadline.

### design_assets
Logos, photos, references, fonts, sources, previews and production files.

### design_versions
Immutable-ish design generations/revisions: blueprint, draft, revision or final. Each stores the recipe and generation manifest plus optional preview/production asset references.

### design_feedback
Client/manager/designer/system corrections, with optional structured changes.

### design_print_profiles
Printer/RPK-specific production requirements. Physical format is known, but DPI, scale, color mode/profile, bleed, safe zone and accepted formats are never guessed globally.

A profile must be explicitly verified before PRINT_READY.

### design_preflight_runs
Traceable production checks against one design version and one verified print profile.

### design_events
Audit-style Design Factory event history.

## Focus integration

The real `focus-biysk-pilot` LeadBot has a new multichannel flow:

`Заказать баннер 3×6`

The same flow is consumed by Telegram, MAX and WhatsApp runtimes because it lives in canonical LeadBot config.

Questions currently collect:

1. customer/company;
2. campaign goal;
3. primary headline;
4. offer;
5. CTA;
6. site/address;
7. requested style;
8. logo/photo readiness;
9. source-material note;
10. deadline;
11. approval contact.

A database trigger watches every new LeadBot lead. When `flow_code='banner_3x6'`, it automatically creates:

`Lead → Design Job → Brief → Brief validation → Blueprint`

No per-channel design integration is required.

## Blueprint compiler

`design_compile_billboard_blueprint()` currently chooses one deterministic recipe:

- `billboard_offer_burst_v1` — sale/promo emphasis;
- `billboard_clean_left_v1` — minimal layout;
- `billboard_premium_center_v1` — premium request;
- `billboard_attention_v1` — safe general fallback.

The blueprint stores normalized 3×6 layout zones and content, not arbitrary executable code.

## Print-safety rule

The Focus printer profile exists as:

`FOCUS_BIYSK_3X6_PENDING`

It is intentionally unverified. Station will not invent production parameters.

`design_preflight_gate()` fails PRINT_READY when any of these are missing/wrong:

- explicitly verified print profile;
- physical 6000×3000 mm format;
- DPI;
- color mode;
- bleed;
- allowed file formats;
- approved/final creative.

This makes creative automation fail closed rather than sending a plausible-looking but production-invalid file to print.

## Operator control plane

Production Edge Function:

`design-factory-admin`

JWT + active operator/admin role required.

Capabilities:

- list Design Jobs;
- read full technology snapshot;
- recompile blueprint;
- add manager feedback;
- admin-only printer-profile editing/verification;
- run preflight.

Operator Console has a new `DESIGN FACTORY · BILLBOARD 3×6` queue.

## What is automated 100%

- Lead intake routing from all supported messengers;
- Design Job creation;
- structured brief persistence;
- brief validation;
- recipe selection;
- blueprint generation;
- version/event bookkeeping;
- printer-profile safety enforcement;
- preflight gate logic;
- operator queue population.

## What remains human-controlled by design

Until we prove the renderer and approval loop on real jobs:

- final wording confirmation when business/legal facts matter;
- brand asset quality/ownership confirmation;
- creative approval;
- explicit printer-profile verification against actual equipment/process;
- final release to print.

These are control gates, not implementation gaps.

## Acceptance evidence

A temporary MAX-sourced `banner_3x6` lead was inserted against the real Focus pilot.

Observed automatically:

- LeadBot lead created;
- Design Job created;
- structured brief created;
- brief validation passed;
- status became `blueprint_ready`;
- recipe `billboard_offer_burst_v1` selected;
- blueprint version created.

Then preflight was deliberately run against the unverified Focus printer profile.

Expected result: `fail`.

Observed failed checks:

- `profile_verified`;
- `production_parameters`;
- `creative_approval`.

Observed passing check:

- physical size `6000x3000 mm`.

Temporary acceptance data was deleted after the test.

## Next module — Draft Renderer 0.1

The next implementation should turn a blueprint into 2–3 visual previews without giving an LLM control over production facts.

Recommended structure:

`blueprint + verified customer text + brand assets → deterministic layout renderer → optional AI visual/background assistant → preview PNG/SVG → automated readability checks → review queue`

AI may propose imagery/composition variants, but phone/address/price/legal text must remain locked structured data from the brief.

After Draft Renderer acceptance, add client review links and structured revision commands, then production export (PDF/TIFF/etc.) driven strictly by the verified printer profile.
