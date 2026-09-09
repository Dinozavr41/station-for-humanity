# Station for Humanity — Frontend V2 Exact Spec

Branch: `frontend-v2-exact`

## Immutable rules

- Approved visual mockups are the exact source of truth.
- Do not redesign, simplify, reinterpret, or replace cinematic scenes with generic SaaS cards.
- Preserve already approved pages exactly unless the user explicitly reopens them.
- Mobile and desktop are both first-class targets.
- Required QA viewports: `390x844` and `1440x1000`.
- Use separate high-resolution responsive assets. No tiny-source upscaling, 800% sprites, random background-position cropping, or stretched blurry images.
- Prefer WebP/AVIF and responsive `<picture>`/`srcset` where appropriate.
- Keep the approved visual language: dark navy, cyan/ice-blue, restrained gold accents, cinematic human/AI/machine/infrastructure scenes, clear narrative flow.
- No fake metrics, fake financial numbers, fake activity, or fabricated progress.
- Article 0 and existing project doctrine remain unchanged.

## Safety boundaries

Do not change without a separate explicit task:
- `main` / production
- Supabase schema or RLS
- payments or YooKassa
- Founding Ticket backend
- Digital Factory backend
- Operator mechanics
- LeadBot
- Governance backend
- existing API contracts

New frontend work is an isolated presentation layer over the existing working core.

## Acceptance discipline

Before showing a new stage to the user:
1. Build/run the page.
2. Check console/runtime errors.
3. Capture/inspect mobile `390x844`.
4. Capture/inspect desktop `1440x1000`.
5. Compare visually against the supplied mockups.
6. Fix obvious mismatches before asking the user to review.
7. Regression-check all APPROVED pages.

No merge to `main` until the user explicitly commands it.
