-- Alpha 1.2: channel availability must reflect the real 2026 operating environment.

update public.factory_products
set public_description_ru='Автоматический менеджер заявок для бизнеса. Telegram входит в базу; MAX подключается как российский дополнительный канал; WhatsApp Business доступен как дополнительный адаптер там, где платформа доступна клиенту.',
    public_description_en='Automated business lead manager. Telegram is included; MAX is available as an additional Russian channel; WhatsApp Business is an optional adapter where the platform is available to the customer.',
    base_scope=coalesce(base_scope,'{}'::jsonb) || jsonb_build_object(
      'channel_policy', jsonb_build_object(
        'telegram','included',
        'max','optional',
        'whatsapp','optional_where_available'
      )
    ),
    updated_at=now()
where code='TGBOT_LEADS_V1';

update public.factory_pricing_rules
set label_ru='Канал WhatsApp Business (если доступен)',
    label_en='WhatsApp Business channel (where available)'
where product_code='TGBOT_LEADS_V1' and option_code='channel_whatsapp';
