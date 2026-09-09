# Station for Humanity — Digital Factory

## Purpose

Digital Factory is the first commercial engine of Station for Humanity.

The goal is a repeatable economic loop where a client request becomes a deployed, auditable product with as little operator work as possible.

Canonical loop:

`need → specification → server price → DF → ORD → Quote → accept → auto-provision → credentials → channel activation → QA → delivery → MiniCRM / Value Ledger`

## Product 01 — SFH MultiChannel LeadBot 1.2

Legacy internal product code: `TGBOT_LEADS_V1`.

The product is no longer architecturally a Telegram-only bot. It is one LeadBot business engine with messaging-channel adapters and one canonical lead store.

Supported production adapters:

- Telegram;
- MAX;
- WhatsApp Business Cloud API.

All channels use the same `leadbot_instances.config`, lead numbering, MiniCRM, audit trail and order lineage.

### Base offer

Price version 2:

- base price: **14,900 RUB**;
- Telegram included;
- target delivery: **3 business days**;
- up to 7 questionnaire steps;
- manager notification / MiniCRM intake;
- database storage of submissions;
- deployment;
- source code;
- handover guide;
- 7 days of bug-fix support.

### Server-priced options

| Option | Rule |
|---|---:|
| MAX channel | +3,000 RUB |
| WhatsApp Business channel | +5,000 RUB |
| Extra conversation flow | +3,000 RUB each, max 3 |
| Google Sheets integration | +4,000 RUB |
| Price/selection calculator | +5,000 RUB |
| Webhook / external API | +7,000 RUB |
| Basic CRM integration | +12,000 RUB |
| AI FAQ over a knowledge base | +12,000 RUB |
| Priority delivery target up to 48 hours | +7,000 RUB |

These values live in the production database. The public page requests the estimate from `digital-factory-quote`; browser JavaScript is not the pricing source of truth.

## Automated production path

Public page:

`https://stationforhumanity.com/factory/`

Flow:

1. Product catalogue and pricing rules are loaded from Supabase.
2. The visitor chooses modules and optional MAX / WhatsApp channels.
3. `digital-factory-quote` calculates the server estimate.
4. The visitor provides contact details, business context and desired result.
5. The public factory creates `DF → ORD → Quote` atomically.
6. The Operator Console reviews the commercial request.
7. Changing the request status to `accepted` fires the database provisioning trigger.
8. `provision_leadbot_instance()` creates a separate customer LeadBot instance automatically and idempotently.
9. Station generates the Telegram webhook secret automatically and stores it in Supabase Vault.
10. The order moves to `in_production` and receives its production instance ID, public slug and requested channel list.
11. The instance appears automatically in the LeadBot Fleet Console.
12. The operator only supplies credentials that must originate from external platforms:
    - Telegram BotFather token and manager claim;
    - MAX bot token / manager ID;
    - Meta WhatsApp access token, App Secret, Phone Number ID, WABA ID and Graph API version.
13. Station validates credentials against the corresponding official API before storing them in Vault.
14. Station creates/activates the channel webhooks.
15. All completed customer conversations create canonical `leadbot_leads` rows with `source_channel`.

## Fleet control plane

`leadbot-fleet-admin` is the generic protected control plane for all LeadBot customers.

The Operator Console no longer hard-codes one customer order. It lists the fleet and allows an operator to select any instance.

For each selected order the console displays:

- requested channels;
- Telegram / MAX / WhatsApp READY or WAITING state;
- overall `channels_ready`;
- `delivery_ready`;
- MiniCRM leads across all channels with visible `source_channel`;
- integration/outbox health.

Channel-specific protected admin functions remain reusable:

- `leadbot-admin` — Telegram and general LeadBot integrations;
- `leadbot-max-admin` — MAX credential validation and activation;
- `leadbot-whatsapp-admin` — WhatsApp credential validation and WABA subscription.

They accept `order_no` / `instance_id`; none is tied to ООО «Фокус» or any other customer.

## Strict readiness semantics

`core_ready` means at least one runtime channel is technically operational.

`channels_ready` is stricter: **every channel ordered by the customer must be technically ready**.

Examples:

- Telegram only: Telegram must be ready;
- Telegram + MAX: both must be ready;
- Telegram + MAX + WhatsApp: all three must be ready.

`delivery_ready` additionally requires the selected production modules and at least one valid manager destination.

An order cannot become delivery-ready merely because one of several ordered channels works.

## Payment guard

Product quoting is live; live charging is **not**.

Current production controls remain:

- LIVE payments: OFF;
- payouts: OFF;
- automatic refunds: OFF;
- max live payment: 0 RUB.

The public factory reports `payment_available=false`. Initial sales can therefore be collected outside the Station payment core while the product/factory loop is already operational.

## Data and security boundaries

- Channel tokens/secrets are stored in Supabase Vault, never client-visible source.
- Telegram webhook secret is generated automatically by Station.
- MAX webhook requests use the MAX webhook secret.
- WhatsApp incoming POSTs are verified with Meta `X-Hub-Signature-256`; GET verification uses the private verify token.
- `leadbot_channel_sessions` and `leadbot_channel_receipts` use deny-by-default RLS and are accessed through service-role Edge Functions.
- Duplicate platform events are deduplicated before creating duplicate leads.
- `source_channel` identifies Telegram, MAX or WhatsApp without splitting the canonical MiniCRM into separate databases.

## Acceptance checklist for each LeadBot

A delivery is not complete until all applicable checks pass:

- every ordered channel reports READY;
- `/start` / initial menu works on a clean session in each applicable channel;
- required questions cannot be skipped accidentally;
- one completed conversation creates exactly one stored lead;
- the lead has the correct `source_channel`;
- the manager can discover the lead through the agreed notification / MiniCRM path;
- repeated platform updates do not create uncontrolled duplicates;
- secrets/tokens are absent from client-visible code and repository history;
- customer-specific configuration is separated from reusable runtime code;
- source code and handover instructions are delivered;
- customer acceptance evidence is attached before `delivered`.

## Current real pilot

ООО «Фокус» (`ORD-000004`, `focus-biysk-pilot`) is the first real multichannel acceptance case.

It requests Telegram + MAX + WhatsApp and intentionally remains `awaiting_credentials` until all three external channel credentials are supplied and tested.

The preceding Telegram-only production instance remains active and backward compatible.

## Next commercial objective

Run this same pipeline for the first 10 paying customers without creating customer-specific runtime code.

The desired operator work per new standard LeadBot is reduced to:

`review request → accept → paste externally issued credentials → run channel acceptance → deliver`.

Everything between acceptance and the credential boundary is now factory-owned automation.
