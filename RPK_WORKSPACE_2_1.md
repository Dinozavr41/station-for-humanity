# RPK Workspace 2.1 — Archive-first operating model

Date: 2026-09-09
Branch: `frontend-v2-exact`

## Product thesis

For a real advertising-production company, the dominant design workload is not greenfield creative. It is repeat work for existing customers using years of old layouts, logos, phone numbers, addresses, offers and familiar compositions.

Therefore Station Design Factory is archive-first:

`RPK archive → client record → old artwork → requested changes → remake job → draft/revision → verified print profile → preflight → PRINT_READY`

## Workspace

The RPK cabinet has first-class entities for:

- workspace / company;
- staff roles: owner, manager, printer, designer, viewer;
- services;
- existing customers;
- private legacy archive batches;
- individual legacy artworks;
- printer questionnaires;
- verified production print profiles;
- Design Factory jobs.

ООО «Фокус» / `focus-biysk` is the first pilot workspace.

## Legacy archive

Private Supabase Storage bucket: `rpk-archive`.

- public access: OFF;
- per-file limit: 100 MB;
- supports common PDF/raster/vector/archive files and opaque binary uploads for legacy formats such as CDR/AI when browser MIME type is not reliable;
- direct browser access is not granted; uploads are issued through authenticated scoped signed-upload requests.

Each legacy artwork stores:

- workspace and optional existing customer;
- original filename and private storage path;
- extension/MIME/size/hash;
- expected product/physical size when known;
- preview path when generated;
- extracted content and confidence;
- customer-match state;
- indexing/review status.

## Remake workflow

A Design Job now supports:

- `workflow_mode=new`;
- `workflow_mode=remake`;
- `workflow_mode=resize`;
- `workflow_mode=variation`.

For an archive remake the job is linked to:

- RPK workspace;
- RPK customer;
- exact source artwork;
- structured change request.

`rpk_create_remake_job()` seeds a new design brief from extracted legacy content and existing customer fields. If the seeded brief passes validation, Station immediately compiles a 3×6 blueprint. It does not invent missing facts.

## Professional printer onboarding

The printer questionnaire records the actual production workflow rather than assuming universal values:

- exact printer model;
- RIP/software and version;
- material;
- artwork scale;
- target DPI;
- color mode and optional ICC profile;
- bleed;
- safe zone;
- accepted formats;
- maximum file size;
- naming convention;
- transparency/font conversion rules;
- black-generation notes and other requirements.

A questionnaire is not a production profile until both parties confirm:

1. printer confirmation;
2. RPK manager confirmation.

Only then does `rpk_publish_verified_print_profile()` create a VERIFIED `design_print_profiles` version with the resolved agreement snapshot and exact numbers.

## Cabinet UX

New page: `/factory/rpk/`.

Primary actions:

1. `Переделать старый`;
2. `Архив макетов`;
3. `Новый баннер 3×6`;
4. `Профиль печати`;
5. `Очередь`.

The cabinet supports authenticated client creation, signed legacy-file uploads, artwork listing, remake creation, professional printer questionnaire entry, two-party confirmation, print-profile summary and Design Factory queue display.

## Security

- `rpk-workspace` Edge Function is JWT protected and returns HTTP 401 without authentication.
- RPK tables are RLS deny-by-default for direct browser access.
- Access is resolved through platform admin/operator role or active membership in the exact RPK workspace.
- Archive bucket is private.
- Printer parameters cannot become VERIFIED without required fields and both confirmations.

## Next required module: Archive Indexer

Uploading the old archive is only stage one. The next module must automatically index it:

`upload → file fingerprint → preview/conversion → text/content extraction → size/product classification → customer matching → human review only when ambiguous → archive READY`

Initial practical scope:

- JPG/PNG/TIFF: preview + visual/text extraction;
- PDF: page preview + text/vector metadata where available;
- EPS/AI: conversion/preview worker where technically reliable;
- CDR and other opaque legacy formats: keep original immutable, create preview through a dedicated conversion worker when supported, otherwise flag for assisted conversion rather than fabricating content.

Only indexed/confirmed source content should drive automatic remake generation.
