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
- MAX — new `leadbot-max` runtime;
- WhatsApp — future adapter, not part of this pilot acceptance.

Both Telegram and MAX use the same `leadbot_instances.config`, `leadbot_leads`, `leadbot_events` and canonical MiniCRM data model.

Alpha 1.0 multichannel schema adds:

- generic lead source fields (`source_channel`, `source_event_key`, `source_chat_id`, `source_user_id`, `source_username`);
- `leadbot_channel_sessions`;
- `leadbot_channel_receipts`;
- MAX credentials in Vault;
- readiness flags `telegram_ready` and `max_ready`.

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

## Live safeguards

- Focus instance stays inactive until real channel credentials are supplied.
- A production probe before credentials returned expected `503 instance_inactive`.
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

## Acceptance target

The pilot is accepted only after at least one real customer-like lead is completed in MAX and one in Telegram, both appear in the same Station lead store with the correct `source_channel`, and the manager receives the expected notification without duplicate leads.
