# Storefront responsive architecture

This directory is the presentation boundary for the public UP AND DOWN storefront.

## Contract

- `mobile`: phones and tablets (`viewport < 1024px`).
- `desktop`: desktop-class viewports (`viewport >= 1024px`).
- Catalog data, Supabase access, cart state, search/filter behavior, checkout and business rules are shared.
- Mobile and desktop may choose different layout, navigation, density, ordering and visibility without duplicating business logic.
- Do not add runtime DOM hotfixes to switch UX. New presentation work belongs in the corresponding shell/components.

## Migration rule

The current legacy storefront remains the shared rendering source while sections are migrated incrementally. This avoids a big-bang rewrite. Each migrated section should expose shared data/actions and provide separate mobile/desktop presentation components where the UX materially differs.

## Safety snapshot

Before this split, `main` was preserved at commit `fcefa5b1cf756238b46d8a53b93e15fa453982f7` on branch:

`backup/pre-responsive-split-2026-10-03`
