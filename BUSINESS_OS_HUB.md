# Station Business OS Hub

## Purpose

Business OS is the top-level entry point for industry-specific CRM/work systems inside Station for Humanity.

Navigation hierarchy:

`Station home → CRM for Business → industry vertical → company workspace → operational cabinet`

First live vertical:
- `rpk` — advertising production companies / RPK OS
- first registered workspace: ООО «Фокус», Biysk

Planned verticals:
- window companies
- construction / installation
- stretch ceilings
- sewing workshops
- bakeries / small production

## Multi-tenant rules

- Industry logic is shared between companies in the same vertical.
- Company data is isolated per workspace.
- Owner and manager accounts use the same company data and operational metrics.
- Platform administrators can see the registered workspace fleet.
- Normal users see only workspaces for which they have active membership.
- Per-company operational cabinets remain separate from the Business OS selector.

## Registry

`business_verticals` stores the industry catalog.

`business_workspace_registry` maps a Business OS company to the underlying industry workspace. For the RPK vertical the source is `rpk_workspaces` and membership is resolved through `rpk_members`.

A trigger keeps RPK workspaces synchronized to the generic Business OS registry.

## Backend

`business-hub` is an authenticated Edge Function. It returns the industry catalog and only the company workspaces available to the current user. Platform admins receive the full registered fleet.

## Current routes

- `/business/` — Business OS industry hub
- `/business/rpk/` — RPK company selector
- `/factory/rpk/?w=<slug>` — concrete RPK operational workspace

The approved Home and Story scenes are not redesigned. The home page gets a small isolated Business OS entry module only.