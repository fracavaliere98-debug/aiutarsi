# AiutarSi Design System

This document defines the rules for the new design system. The system must keep one shared foundation while preserving two coherent role experiences:

- Volunteer: emotional, discovery-oriented, gamified, movement-based, focused on personal impact.
- NPO: operational, guided, priority-based, focused on volunteers, activities, verification, and reporting.
- Shared base: typography, spacing, radius, shadows, tab bar, header, cards, empty/loading/error states, and CTAs.

## Token Layers

- Primitive tokens are raw reusable values: palette, spacing, radius, shadow, font scale.
- Semantic tokens express UI meaning: background, surface, text, muted, border, danger, success, warning, info.
- Role tokens express role-specific identity: volunteer, npo, corporate, admin.
- Component tokens will be introduced later for canonical components such as buttons, cards, badges, tab bars, and headers.

## Usage Rules

- Screens must not introduce new hardcoded design values.
- Screens must not know raw numeric token values unless there is a documented temporary exception.
- Screens should import semantic tokens and role tokens from `theme`.
- Primitive tokens should not be used directly by screens.
- Role differences must go through `roleColors`, not local hex colors.
- New shared UI components must live under `components/ui`.
- Legacy components may remain during migration, but they are not the model for new UI.
- Temporary exceptions must be marked and removed during the related migration slice.

## Required Fields In Forms (26/10/2026)

- Mark every required field with `RequiredMark` (red asterisk after the label) and put `RequiredFieldsNote` ("I campi con * sono obbligatori.") at the top of the form. Optional fields stay unmarked (an explicit "(Opzionale)" is fine).
- Keep the primary button active even when fields are missing: a grey button that still works does not say what is wrong.
- On submit with missing or invalid fields: show `FieldError` under each field with a concrete instruction (what to enter, not "campo obbligatorio"), give the field a `colors.dangerStrong` border, scroll to the first one, and show one `showToast('warning', missingFieldsMessage(...))` that names the missing fields.
- Errors appear only after the first submit attempt and disappear as soon as the field is filled.
- Use `colors.dangerStrong` for error text and icons: `colors.danger` on white is below 4.5:1 contrast.
- Logic lives in `utils/requiredFields.ts` (`getMissingRequiredFields`, `missingFieldsMessage`). Applied to onboarding: `app/onboarding/profile.tsx`, `npo-details.tsx`, `npo-referent.tsx`. Contract test: `scripts/test_required_fields_contract.ts`.

## Current Phase

The first phase introduces foundational tokens and a small set of shared UI components used by the NPO volunteers screen. Runtime UI changes should stay limited to vertical slices that replace duplicated local styles with these shared primitives.

Next phases:

- Base components: Button, CountBadge, StatusPill, SectionHeader, SegmentedControl, Card.
- Layout/navigation: RoleTabBar, AppHeader, ScreenScaffold.
- Role patterns: Volunteer and NPO vertical slices.
- Anti-drift checks: prevent new hex colors, ad-hoc font sizes, radius, and shadows in screens.
