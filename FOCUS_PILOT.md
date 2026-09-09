# ООО «Фокус» — first multichannel LeadBot pilot

Date: 2026-09-09
Branch: `frontend-v2-exact`

## Purpose

ООО «Фокус» (РПК / наружная реклама, Бийск) is the first complimentary real-business pilot of Station Digital Factory's multichannel LeadBot.

The pilot is deliberately free: it is an acceptance/customer-discovery case, not claimed revenue.

## Canonical records

- Factory request: `DF-000002`
- Order: `ORD-000004`
- LeadBot instance: `instance_no=2`
- Public slug: `focus-biysk-pilot`
- Amount: `0 RUB`
- `payment_required=false`
- Current state: `in_production / awaiting_credentials`

## Channels

Target channels:

- Telegram — existing `leadbot-telegram` runtime, separate BotFather token required;
- MAX — `leadbot-max` runtime;
- WhatsApp — official Meta WhatsApp Cloud API through `leadbot-whatsapp`.

All three channels use the same `leadbot_instances.config`, `leadbot_leads`, `leadbot_events` and canonical MiniCRM data model.

Alpha 1.0/1.1 multichannel schema includes:

- generic lead source fields (`source_channel`, `source_event_key`, `source_chat_id`, `source_user_id`, `source_username`);
- `leadbot_channel_sessions`;
- `leadbot_channel_receipts`;
- MAX and WhatsApp credentials in Vault;
- readiness flags `telegram_ready`, `max_ready` and `whatsapp_ready`.

Legacy Telegram tables/functions remain intact for backward compatibility.

## Focus flows

1. Разместить наружную рекламу
2. Подобрать свободные поверхности
3. Изготовить баннер / вывеску
4. Заказать дизайн / макет
5. Монтаж / замена рекламы
6. Задать вопрос (safe local FAQ)

No billboard inventory, availability, rate card or exact commercial price is invented. The bot qualifies the request and a manager confirms current inventory, price and schedule.

## MAX implementation

Production Edge Functions:

- `leadbot-max` — webhook runtime, custom authentication via `X-Max-Bot-Api-Secret`;
- `leadbot-max-admin` — authenticated Station admin control for token validation, webhook subscription and manager setup.

Current MAX API host: `https://platform-api2.max.ru`.

Webhook subscription uses only:

- `message_created`
- `bot_started`

The first version uses MAX `message` inline buttons so option selection arrives as ordinary text and does not depend on callback handling.

## WhatsApp implementation

Production Edge Functions:

- `leadbot-whatsapp` — official WhatsApp Cloud API webhook runtime;
- `leadbot-whatsapp-admin` — authenticated Station admin control for credential validation, WABA subscription and manager setup.

Stored only in Vault:

- access token;
- Meta App Secret;
- webhook verify token;
- Phone Number ID;
- WABA ID;
- Graph API version;
- optional manager WhatsApp number.

Incoming webhook POST requests are verified with `X-Hub-Signature-256` using the Meta App Secret. Webhook GET verification checks the private verify token. Incoming text, reply buttons and list selections are normalized into the common LeadBot session engine and saved with `source_channel=whatsapp`.

The Graph API version is configuration, not hard-coded product state, so Station can move to a supported Meta API version without changing the LeadBot data model.

Free-form proactive WhatsApp messages are subject to WhatsApp customer-service messaging rules. A manager notification failure never loses the lead; the canonical MiniCRM row remains the source of truth. Approved templates should be configured for dependable proactive production notifications outside the customer-service window.

## Live safeguards

- Focus instance stays inactive until real channel credentials are supplied.
- MAX production probe before credentials returned expected `503 instance_inactive`.
- WhatsApp webhook GET without a valid verify token returned expected `403 verification_failed`.
- WhatsApp webhook POST while the Focus instance is inactive returned expected `503 instance_inactive`.
- WhatsApp admin endpoint without Station authorization returned expected `401`.
- Existing Telegram production instance remained active after the multichannel migration with `telegram_ready=true`.
- New channel/session tables use RLS with no direct anon/authenticated policies; service-role Edge Functions are the access boundary.

## Remaining external steps

### MAX

1. Verify/create the ООО «Фокус» organization profile in MAX for Business / MAX partner platform.
2. Create the Focus chatbot and pass MAX moderation.
3. Obtain the bot token.
4. In Station admin: validate/store token, bind manager MAX user ID, activate webhook.
5. Run a real `bot_started → questionnaire → lead.created → manager notification` acceptance.

### Telegram

1. Create a dedicated Focus bot in BotFather.
2. Store its token in the Focus LeadBot instance.
3. Activate Telegram webhook.
4. Bind manager chat and run the same acceptance.

### WhatsApp

1. Create/use a Meta Business Portfolio and WhatsApp Business Account for ООО «Фокус».
2. Add and verify the business phone number in WhatsApp Business Platform.
3. Obtain the access token, Meta App Secret, Phone Number ID, WABA ID and the currently supported Graph API version from Meta.
4. Enter these values only in the protected Station Operator Console WhatsApp panel; Station validates the phone and stores secrets in Vault.
5. Set the manager phone if WhatsApp manager notifications are desired.
6. Activate the WABA subscription from Station.
7. Complete a real WhatsApp questionnaire and confirm a `source_channel=whatsapp` lead appears in the same MiniCRM.
8. Configure an approved WhatsApp message template before relying on proactive manager notifications outside the customer-service window.

## Acceptance target

The pilot is accepted only after at least one real customer-like lead is completed in Telegram, MAX and WhatsApp. All three leads must appear in the same Station lead store with the correct `source_channel`, without duplicates, while the existing Telegram production instance remains unaffected.
