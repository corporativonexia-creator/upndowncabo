# UP AND DOWN · Content Management Plan (next Admin phase)

This file records the Home UX V2 requirements approved before the Admin panel update.
No database schema is changed by the Home UX V2 patch.

## Golf courses
Admin must support:
- name
- location_label
- description
- image_url
- map_url
- official_url
- is_visible (show / no show)
- sort_order
- updated_at

The Home should render only `is_visible = true`.

## Golf instructors / teachers
Admin must support:
- name
- short_bio
- image_url
- specialties
- booking_url or booking reference
- is_visible (show / no show)
- sort_order
- updated_at

Teachers belong to the Classes service experience.

## Cabo Journal
Admin must support:
- title
- slug
- eyebrow/category
- summary
- body/content
- image_url
- is_visible
- is_priority
- sort_order
- published_at
- updated_at

Home behavior:
- show only active/visible articles
- priority articles first
- initial compact set (3)
- "Ver más artículos" reveals the remaining cards

## Notes
- HOME UX V2 includes data hooks for managed visibility.
- Current static course and journal content remains visible until the Admin/DB phase replaces it with Supabase content.
