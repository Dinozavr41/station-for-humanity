# Digital Factory Automation 1.4 — Acceptance State

Date: 2026-09-09
Branch: `frontend-v2-exact`

## Goal

Turn SFH MultiChannel LeadBot from a manually configured pilot into a repeatable production line for many customers.

## Automated chain

`public request → server quote → DF/ORD/Quote → operator ACCEPT → atomic provisioning → deterministic template compiler → static QA → LeadBot instance → generated webhook secret → scoped customer onboarding link → customer credentials → official API validation → webhook activation → unified MiniCRM → readiness gate`

## What is automated now

### Commercial intake

- Public factory uses the server Pricing Engine.
- One request creates DF, ORD and Quote references.
- Telegram is the base channel.
- MAX and WhatsApp are optional channel adapters.

### Atomic ACCEPT

`accept_factory_leadbot_request()` performs one database transaction:

1. locks and validates the factory request;
2. changes request to `accepted`;
3. the provisioning trigger creates the LeadBot instance;
4. old active onboarding links are revoked;
5. a new random onboarding bearer token is generated;
6. only SHA-256(token) is stored;
7. the raw token is returned once to the authenticated operator;
8. audit evidence is written.

The Operator UI copies the onboarding URL after ACCEPT and falls back to a copy prompt if Clipboard API is unavailable.

### Deterministic Template Compiler

Production does not depend on a local LLM to invent customer flow logic.

`leadbot_build_config()` currently has safe templates:

- `advertising`;
- `auto_service`;
- `construction_service`;
- `furniture`;
- `generic_service` fallback.

The classifier uses business/request keywords. Generated configuration includes menu, flows, questions, FAQ, calculator placeholder and product specification metadata.

AI can later produce a draft/suggestion layer, but it must not bypass validation or write arbitrary production behavior.

### Fail-closed config validation

`leadbot_validate_config()` and `leadbot_static_qa()` check, among other things:

- config is an object;
- valid menu size;
- valid flow codes;
- 1–12 questions per flow;
- allowed question types only (`text`, `number`, `choice`);
- choice option bounds;
- contact question exists;
- every non-FAQ menu item maps to a real flow;
- FAQ structure exists.

Invalid compiled config blocks provisioning/delivery rather than falling back to unreviewed generated behavior.

### Readiness and delivery gate

`leadbot_refresh_readiness()` recalculates:

- requested channels;
- Telegram/MAX/WhatsApp credential readiness;
- `channels_ready` only when every requested channel is ready;
- manager connection;
- optional integration readiness;
- static QA;
- `delivery_ready` only when all required gates pass.

A bot cannot become `delivery_ready` with invalid config.

### Customer self-service channel onboarding

Scoped onboarding link:

- raw bearer token is not stored;
- only SHA-256 hash is stored;
- 72-hour default expiry;
- max failed-attempt guard;
- one link is scoped to one LeadBot instance only;
- credentials go directly from customer browser to the scoped Edge Function and then to Vault;
- Telegram token is validated via Telegram API;
- MAX token is validated via MAX API;
- WhatsApp credentials are validated via Meta Graph API;
- webhooks/subscriptions are registered automatically.

The database completion guard prevents onboarding from being marked complete before both channel readiness and a manager endpoint exist.

## Acceptance evidence completed

### Template compiler test

The following samples compiled and validated successfully:

- advertising → `advertising`;
- car service → `auto_service`;
- heating/installation → `construction_service`;
- custom furniture → `furniture`;
- unknown consulting business → `generic_service`.

All returned static validation `valid=true` with no errors.

### Atomic factory test

A temporary car-service request was created and accepted through `accept_factory_leadbot_request()`.

Observed results:

- LeadBot instance auto-created;
- slug auto-created;
- template `auto_service` selected;
- order moved to `in_production`;
- Telegram and MAX requested as selected;
- WhatsApp not requested;
- static QA passed;
- Telegram webhook secret existed;
- scoped onboarding link existed;
- stored token hash matched SHA-256(raw token);
- onboarding `inspect` returned HTTP 200 and only the scoped instance state.

Test records were removed after acceptance.

### Onboarding completion guard test

A temporary Focus onboarding link was forced toward `completed` while Focus channels were not ready.

Database result:

- status remained `active`;
- `completed_at` remained null;
- metadata recorded `completion_blocked_reason=channels_not_ready`.

Test link was removed.

## Existing real instances

- Existing Telegram production instance remains active and passes static QA.
- ООО «Фокус» pilot remains `awaiting_credentials`, passes static QA, and requests Telegram + MAX + WhatsApp; `channels_ready=false` until real external credentials are connected.

## Security posture

- LeadBot operational tables are RLS deny-by-default for browser clients and are accessed through controlled Edge Functions/service role.
- Secrets live in Supabase Vault.
- Raw onboarding bearer tokens are never stored.
- Public onboarding is scoped and attempt-limited.
- Backend factory admin requires authenticated operator role.
- No new high-severity Supabase security advisory was introduced by Alpha 1.4.
- Existing project warning remains: leaked-password protection in Supabase Auth is disabled and should be enabled through Supabase Auth settings when available.

## Remaining external acceptance

The factory software path is ready for a real customer pilot. The next real acceptance requires platform-owned credentials, not more speculative code:

1. Create/approve dedicated Focus Telegram bot.
2. Create/approve Focus MAX bot.
3. Connect WhatsApp only where the platform/business setup is actually available and desired.
4. Publish/verify the `frontend-v2-exact` customer onboarding page without changing approved Home/History visuals or touching `main` unexpectedly.
5. Give Focus the scoped onboarding link.
6. Complete one real lead per enabled channel.
7. Confirm every lead appears in one MiniCRM with correct `source_channel` and no duplicates.
8. Bind a manager endpoint and confirm manager notification.
9. Only then mark the real pilot delivery acceptance complete.
