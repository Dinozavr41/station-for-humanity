# SFH LeadBot 1.0 — reusable production module

This module is the first repeatable production unit of Station for Humanity Digital Factory.

## Runtime

One Supabase Edge Function (`leadbot-telegram`) can serve multiple customer instances. Each instance is configuration-driven and isolated by `leadbot_instances.id`.

Persistent state:

- `leadbot_instances` — customer configuration and readiness;
- `leadbot_update_receipts` — Telegram update idempotency;
- `leadbot_sessions` — multi-step conversations;
- `leadbot_leads` — completed leads;
- `leadbot_events` — runtime/audit events;
- `leadbot_outbox` — delivery to Google Sheets, CRM and external webhook.

Secrets are stored in Supabase Vault through service-role-only RPCs. Bot tokens, API keys and private integration URLs are not committed to GitHub or returned to the browser after storage.

## Telegram security

`leadbot-admin` validates a BotFather token with Telegram before storing it, then configures `setWebhook` server-side. Telegram webhook calls are authenticated with `X-Telegram-Bot-Api-Secret-Token`; the secret is randomly generated and kept in Vault.

Repeated Telegram `update_id` values are ignored by the update receipt table.

## Product features supported

- base questionnaire / lead capture;
- multiple configurable flows;
- manager notification;
- persistent lead storage;
- configurable preliminary calculator;
- Google Sheets adapter;
- generic CRM REST/webhook adapter with optional Bearer token;
- generic external webhook adapter with optional Bearer token;
- FAQ knowledge base;
- optional OpenAI-compatible AI FAQ endpoint;
- production readiness checklist in Operator Console.

## ORD-000003

The first instance is for a lighting-installation business. It contains these flows:

1. lighting installation estimate request;
2. engineer consultation;
3. site visit request;
4. commercial object quote;
5. FAQ.

The commercial request selected all Product 01 options. The reusable code is built; external credentials and customer-specific pricing are deliberately treated as configuration rather than hard-coded assumptions.

## Delivery rule

`core_ready` means the Telegram runtime can be activated securely.

`delivery_ready` means every purchased feature has its required external configuration, the manager channel is linked, and calculator rates have been approved.

A bot must not be marked delivered solely because the code exists. QA requires a real Telegram webhook, one complete lead, manager delivery, integration results, duplicate-update protection and customer acceptance evidence.
