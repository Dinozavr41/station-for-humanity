# Frontend V2 Exact — stage 1

Branch: `frontend-v2-exact`. Base: `123b4c93438aef248c2cf60541389ddc3a05e0da`.

Only `/next/index.html` and `/next/story.html` are new product pages. Existing root pages, API, Supabase, payments, factory, LeadBot, Operator and Governance remain unchanged. No merge or production deployment is authorized.

## Reference mapping

- Home composition: supplied `image-gen-1(4).png`.
- Story composition: supplied `image-gen-2(4).png`.
- Eight story scenes: supplied `image-gen-1(3).png` and named story overview.
- The supplied images are visual specifications. Generated supporting artwork reconstructs their scenes without baked-in web text or interface.

## Existing CTA destinations

- Founding Ticket: `https://stationforhumanity.com/#join`
- Digital Factory: `https://stationforhumanity.com/factory/`
- Constitution: `https://stationforhumanity.com/constitution.html`
- Operator: `https://stationforhumanity.com/operator.html`, footer only.
- System/modules navigation points to existing public anchors, not new V2 pages.

No forms, payment calls, mock statistics, artificial completion badges or new backend contracts are introduced. Future scenes are explicitly aspirational. Article 0 wording is preserved.

## Build and QA

`node build-pages.mjs` builds the two ordinary static HTML pages. No runtime framework or install is needed. `styles.css` and `app.js` are scoped to `/next/`.

`npm run dev` serves the repository read-only for supervised browser QA. `qa/viewports.html` hosts the actual pages in 390×844 and 1440×1000 iframes, with page/device selectors. This harness is development-only. `qa/assets.json` records native/output dimensions and compressed file sizes.

## Acceptance status: APPROVED BY USER — 2026-09-09

The user explicitly approved the home page and “История большой мечты” on desktop and mobile, and instructed us to preserve this result in `frontend-v2-exact`. The accepted implementation is commit `3d6cb1df3b66c38239e1193e99395d35f2e22721`. See [ACCEPTANCE.md](ACCEPTANCE.md) for the exact approval and scope freeze.

The earlier agent browser attempt was blocked by `net::ERR_BLOCKED_BY_CLIENT`; agent-captured screenshots at 390×844 and 1440×1000 were not obtained. The user subsequently inspected the preview and approved both pages. This is user acceptance, not a claim that automated visual QA or pixel-equivalence verification passed. `qa/static-checks.json` preserves the earlier check results as historical evidence.

Stage 1 is closed. Do not change the approved frontend, expand to further pages, merge into `main`, or deploy to production without a separate explicit user instruction.

## Recorded differences in the approved version

- Scene artworks were reconstructed separately; fine details are not pixel-identical.
- Home/story hero originals are 1774×887; supporting originals are 1536×1024. No derivative is upscaled. Larger originals are still needed for truly high-density desktop hero display.
- Mobile composition adapts the desktop reference with the complete eight-step path stacked vertically; no dedicated mobile reference was supplied.
- Reference's invented counters, funding percentages, completed flight badges, unavailable video/search/language controls are omitted. Public destinations remain in the existing application.
- Public facts and planned milestones replace fictional claims. Story chapter text expands via accessible native details elements.
- Golos Text is a close readable Cyrillic typeface; it is not an exact extraction of lettering from the raster mockup.
