# RPK OS 3.0 — modular operating system for small advertising-production companies

Date: 2026-09-09
Branch: `frontend-v2-exact`

## Product thesis

Small RPK businesses should not have to buy and configure a separate CRM, warehouse system, design archive, bot platform, quote generator, procurement tracker and management-accounting tool.

RPK OS is one adaptive cabinet that starts simple and grows by modules.

The product is intentionally NOT a replacement for statutory Russian accounting/reporting software. It provides operational and management accounting plus commercial documents and later integrates with 1C/Kontur/other regulated systems.

## Core navigation

1. Рабочий стол
2. Клиенты и сделки
3. Архив макетов
4. Design Factory
5. Документы
6. Прайсы
7. Поставщики и закупки
8. Склад
9. Деньги
10. Боты и лиды
11. Что улучшить

## Adaptive module system

Each workspace has an explicit module registry. Modules can be enabled/disabled independently and declare dependencies.

Default small-RPK profile:

- dashboard: ON
- CRM: ON
- archive: ON
- Design Factory: ON
- documents: ON
- price lists: ON
- suppliers/procurement: ON
- inventory: OFF until needed
- management cashflow: ON
- LeadBot: OFF until connected
- recommendations: ON

The cabinet must remain useful with only core modules; advanced modules appear when the RPK needs them.

## Mini CRM

Minimal pipeline:

`lead → qualified → quote → approved → production → ready → won/lost`

Each deal can contain:

- customer;
- source/channel;
- products/services;
- selling price;
- estimated cost/margin;
- next action;
- owner;
- linked documents;
- linked Design Factory job;
- linked payment/cash entries.

## Prices, procurement, stock

RPK OS supports:

- customer price lists;
- internal cost price lists;
- supplier directory;
- supplier prices with validity periods;
- catalog of materials/services;
- stock locations;
- stock balances/reservations/movements;
- comparison of selling price vs current supplier/stock cost.

This is operational inventory/procurement, not full ERP accounting.

## Documents

Initial commercial documents:

- commercial offer / КП;
- invoice / счёт;
- contract / договор;
- act / акт;
- production/work order.

Documents should be generated from the same deal/customer/catalog data so the manager does not retype names, prices, addresses and requisites.

## Money

RPK OS tracks management cashflow only:

- incoming/outgoing;
- category;
- deal;
- counterparty;
- date;
- amount;
- simple contribution margin.

Regulated bookkeeping, taxes and reporting should be delegated via integrations with 1C/Kontur/other accounting products.

## Recommendations engine

Station should make deterministic, explainable suggestions based on workspace state, for example:

- many clients but no LeadBot → suggest lead capture bot;
- unindexed archive → suggest archive import/indexing;
- no verified print profile → block PRINT_READY and request printer questionnaire;
- repeated manual remake jobs → suggest template automation;
- current supplier price above alternative → suggest supplier review;
- low stock on frequently used material → suggest reorder;
- quote accepted but no invoice → suggest invoice generation;
- invoice issued but no payment/cash entry → suggest follow-up;
- frequent customers inactive for N months → suggest reactivation campaign.

No recommendation may silently change money, prices, stock or legally significant documents. Human approval remains the action gate.

## Mobile/adaptive UX

The cabinet is mobile-first for owners/managers who work from a phone.

Desktop can show the full operational board; mobile prioritizes:

- today;
- new leads;
- customer search;
- remake old layout;
- issue quote/invoice;
- production status;
- cash in/out;
- urgent recommendations.

Modules are cards/sections driven by the workspace module registry rather than hard-coded page forks.

## Commercial model direction

The target customer is price-sensitive. The base product should cost materially less than assembling several general-purpose services.

Recommended launch hypothesis:

- Free pilot / archive import trial for first design partners;
- Base: around 990 RUB/month equivalent on an annual commitment (or ~9,900 RUB/year prepaid);
- Business: around 1,990 RUB/month equivalent with Design Factory/automation allowances;
- AI/rendering/large storage can use fair usage or small usage packs so heavy users do not make the low base plan unprofitable;
- annual commitment may be paid monthly; prepaid annual payment can receive a discount.

Final pricing must be tested with real RPK customers before being locked into the public Pricing Engine.

## First workspace

ООО «Фокус» / `focus-biysk` is the pilot workspace.

Alpha 3.0 database foundation adds the module registry plus suppliers, price lists, catalog, supplier prices, stock, deals, commercial documents, management cash entries and explainable recommendations.
