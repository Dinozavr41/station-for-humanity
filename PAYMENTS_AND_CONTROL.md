# Station for Humanity — Payments & Control Plane

Status: **Alpha 0.3 implementation design**

This document defines the minimum financial and operational controls required before Station for Humanity accepts real money.

## 1. Launch model

The safest first commercial model is intentionally simple:

1. A customer buys a clearly described service from the operating entity.
2. The operating entity receives the customer payment.
3. The Digital Factory performs and delivers the work.
4. The Value Ledger records revenue, costs and verified contribution.
5. Contributors are paid separately under lawful contracts / payout rules.
6. Social and dream allocations are accounting allocations of approved station economics, not hidden promises to third parties.

The MVP should **not** begin by holding customer money on behalf of unrelated sellers or automatically routing money through an unlimited marketplace structure. Marketplace splitting, safe-deal / escrow-like flows and mass payouts are later modules after legal and provider review.

## 2. Payment-provider architecture

Payment code must use a provider adapter rather than coupling the whole station to one processor.

Initial provider candidate for the Russian MVP: **YooKassa**.

Why it fits the first technical test:

- official API supports online payments, refunds and webhooks;
- a test shop can be used before a production contract;
- payment status can be verified server-to-server;
- later platform products include safe-deal, splitting and payouts if the business/legal model requires them.

Alternative / secondary Russian provider candidate: **CloudPayments**.

International processing is a separate adapter and legal workstream. The station must not depend on sanctions evasion, false residency or misleading provider onboarding.

### Required provider interface

```text
createPayment(order)
getPayment(externalPaymentId)
refundPayment(paymentId, amount, reason)
parseWebhook(request)
verifyWebhook(event)
createPayout(...)        # later, disabled in MVP
```

## 3. Payment states

Canonical internal states:

```text
created
pending
waiting_for_capture
succeeded
canceled
partially_refunded
refunded
chargeback
manual_review
```

The provider status is stored separately from the station's canonical status.

No order becomes `paid` because the browser returned from a payment page. A payment becomes paid only after server-side verification of the provider object / verified webhook.

## 4. Idempotency

Every payment creation and refund request requires an idempotency key.

Rules:

- the same station order cannot accidentally create two active payments for the same payable version;
- webhook processing is idempotent;
- ledger posting is idempotent;
- retries never duplicate money movement.

## 5. Money source of truth

The database is the operational source of truth for station state, but the provider and bank statement remain external financial evidence.

Every day the system must reconcile:

```text
station payments
↕
payment provider settlements
↕
bank account transactions
↕
fiscal receipts where required
```

Differences create a reconciliation exception and must never be silently ignored.

## 6. Double-entry Value Ledger

All realized money movement is represented by balanced entries.

Example: customer payment of 10,000 RUB settles.

```text
Dr Provider Receivable  10,000
Cr Customer Revenue     10,000
```

When the processor sends net settlement:

```text
Dr Bank                  9,700
Dr Payment Fees            300
Cr Provider Receivable  10,000
```

Internal allocations such as Dream Fund or Builder Pool must be represented separately from actual cash movement so a displayed allocation cannot be mistaken for money already transferred.

## 7. Control plane

A `system_controls` record is the kill switch for financial operations.

Initial defaults:

```text
payments_enabled = false
payouts_enabled = false
auto_refunds_enabled = false
public_registration_enabled = true
```

Real payments may be enabled only after:

- database migrations are applied;
- payment provider test flow passes;
- webhook verification passes;
- terms / privacy / operator details are published;
- fiscalization requirement is configured where applicable;
- reconciliation dashboard exists;
- backups and audit log are verified.

## 8. Role-based control

Minimum roles:

```text
viewer
contributor
operator
finance
risk
admin
auditor
```

Rules:

- contributors cannot change payment state;
- operators can manage orders but cannot approve their own payouts;
- finance can execute approved refunds / payouts within limits;
- risk can freeze orders / participants / payouts;
- auditors have read-only access to financial and audit records;
- no normal UI can edit or delete immutable audit / ledger history.

## 9. Approval gates

Examples of actions requiring approval:

- changing a paid order's price;
- refund above configured threshold;
- payout to a new beneficiary;
- payout above configured threshold;
- changing allocation rules;
- enabling live payments;
- changing payment-provider credentials;
- deleting personal data when a financial retention requirement applies.

For the first real-money release, payouts and high-value refunds should require a second human approval.

## 10. Audit log

Every consequential action records:

- actor;
- timestamp;
- action;
- entity type and ID;
- before / after state when applicable;
- request correlation ID;
- reason / note;
- source IP / session metadata when legally and technically appropriate.

The application should be able to correct state through new events, not erase historical financial events.

## 11. Fraud and abuse controls

MVP controls:

- server-side amount calculation;
- never trust price from browser input;
- rate limits on ticket/order/payment creation;
- duplicate order detection;
- velocity limits;
- manual review flags;
- allow-list for initial beta customers if needed;
- no payout to an unverified beneficiary;
- no change of payout destination and immediate payout in the same unreviewed action;
- suspicious events go to a risk queue.

## 12. Personal data

Founding Tickets and orders may contain personal data.

Architecture must separate:

- public profile / public dream data;
- private contact and identity data;
- financial / payout data;
- audit / legal-retention data.

Public transparency never means publishing passports, bank details, secret keys or unnecessary personal documents.

## 13. Russian operational readiness

Before production B2C payments in Russia, the operating entity must verify current requirements for:

- online fiscal receipts / 54-FZ;
- customer offer / terms and refund terms;
- privacy policy and personal-data processing;
- notification / obligations as a personal-data operator where applicable;
- tax/accounting treatment;
- the selected payment provider contract.

For Alpha testing, use the provider's **test mode** first. Test money must never be presented as real station revenue.

## 14. Social funds

At MVP stage, `Dream Fund`, `Builder & Pension`, `Opportunity` and `Emergency` are **ledger allocation buckets**, not promises that a separate regulated fund already exists.

Before public donation collection or charitable claims, the legal structure must be reviewed separately.

## 15. Launch gates

### Gate A — Static/public project — DONE

### Gate B — Database + audit + identity

- persistent Founding Tickets;
- roles;
- audit log;
- backups.

### Gate C — Payment sandbox

- test order;
- test YooKassa payment;
- verified webhook;
- refund test;
- duplicate webhook test;
- reconciliation test.

### Gate D — Real Russian MVP payment

- operating entity ready;
- provider contract ready;
- fiscalization ready if required;
- legal pages ready;
- first controlled live payment limit set low.

### Gate E — Contributor payouts

- contracts / payout basis;
- identity and payout destination verification;
- two-person approval;
- tax/accounting handling;
- reconciliation.

### Gate F — Marketplace / international

Only after the one-seller Digital Factory loop is proven.
