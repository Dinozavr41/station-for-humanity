# Station for Humanity — Digital Factory

## Purpose

Digital Factory is the first commercial engine of Station for Humanity.

The goal is not to publish a giant agency catalogue. The goal is to prove one repeatable economic loop with a narrow product that can be specified, priced, produced, checked and delivered quickly.

Canonical loop:

`need → specification → server price → order → payment → production → QA → delivery → Value Ledger`

## Product 01 — SFH LeadBot 1.0

Product code: `TGBOT_LEADS_V1`

A custom Telegram bot for lead capture and simple business intake.

### Base offer

Price version 1:

- base price: **14,900 RUB**;
- target delivery: **3 business days**;
- up to 7 questionnaire steps;
- Telegram manager notification;
- database storage of submissions;
- deployment;
- source code;
- handover guide;
- 7 days of bug-fix support.

### Server-priced options

| Option | Rule |
|---|---:|
| Extra conversation flow | +3,000 RUB each, max 3 |
| Google Sheets integration | +4,000 RUB |
| Price/selection calculator | +5,000 RUB |
| Webhook / external API | +7,000 RUB |
| Basic CRM integration | +12,000 RUB |
| AI FAQ over a knowledge base | +12,000 RUB |
| Priority delivery target up to 48 hours | +7,000 RUB |

These values live in the production database rather than only in front-end JavaScript. The public page requests an estimate from the server and the server is the pricing source of truth.

## Public commercial path

Public page:

`https://stationforhumanity.com/factory/`

Flow:

1. Product catalogue and pricing rules are loaded from Supabase.
2. The visitor chooses optional modules.
3. `digital-factory-quote` calculates the server estimate.
4. The visitor provides contact details, business context and required result and explicitly consents to processing the commercial request.
5. Rate limiting is applied using a server-side HMAC pseudonymous source key; raw source IP is not stored by the factory tables.
6. One atomic database RPC creates:
   - `factory_requests` record;
   - commercial `orders` record;
   - issued `order_quotes` record valid for 7 days;
   - order event;
   - audit event.
7. The user receives three references: `DF-xxxxxx`, `ORD-xxxxxx`, and `Q-xxxxxx`.
8. The Operator Console receives the request in the Digital Factory queue for review/accept/reject/cancel.

## Payment guard

Product quoting is live; live charging is **not**.

Current production controls remain:

- LIVE payments: OFF;
- payouts: OFF;
- automatic refunds: OFF;
- max live payment: 0 RUB.

The public factory explicitly reports `payment_available=false`. No live-money launch is implied by a successful quote.

## Why this product

The first product follows the project selection rules:

- strong automation potential;
- measurable customer outcome;
- limited and explicit base scope;
- low regulatory burden compared with financial/medical/legal services;
- quick manual QA;
- reusable architecture;
- pricing can be computed from modules rather than invented by a salesperson each time.

## Market positioning — September 2026

The Russian market spans cheap freelancer offers around the low tens of thousands of rubles and business/studio development commonly starting in the tens of thousands and rising sharply with CRM, payments, Mini Apps and AI.

The 14,900 RUB founding price intentionally places Product 01 above throwaway/template pricing but below normal small-studio entry pricing. The objective is to obtain the first external cases, delivery evidence and reusable production modules rather than maximize margin on the first order.

## Acceptance checklist for each LeadBot

A delivery is not complete until all applicable checks pass:

- `/start` and menu work on a clean user session;
- required questions cannot be skipped accidentally;
- invalid contact data is handled reasonably;
- one completed submission creates exactly one stored lead;
- manager notification contains the required fields;
- repeated Telegram updates do not create uncontrolled duplicate leads;
- secrets/tokens are absent from client-visible code and repository history;
- customer-specific configuration is separated from reusable module code;
- deployment restart preserves service availability;
- source code and handover instructions are delivered;
- customer acceptance evidence is attached to the order before `delivered`.

## Next build

1. Receive the first genuine external DF request.
2. Convert the resulting specification into a reusable LeadBot template/module.
3. Add production checklist and delivery evidence to the Operator Console.
4. Complete legally compliant live-payment/invoicing readiness.
5. Deliver the first real customer order.
6. Post the first real Value Ledger event.
7. Attribute any reusable module contribution separately from one-off labor.
