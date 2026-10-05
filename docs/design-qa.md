# Design QA: DESIGN.md Section 12 checklist per screen

Each item is marked **verified** (with how) or **needs a real phone** (with the check number in [phone-checklist.md](phone-checklist.md)). "Playwright" means `app/e2e/*.spec.ts` on the web build against the real API and MySQL seed; "Jest" means `app/src/**/*.test.ts(x)`.

## P3c: language, sign-in, student home, profile (2026-10-05)

| Section 12 item | Result |
|---|---|
| Answers its main question within 3 s | **Verified** for Home: a returning student sees the pinned professors' statuses 273-314 ms after opening the web build, with 0 taps (Playwright, timed). On a phone: needs a real phone (#19). |
| One clear primary action | **Verified** by review: Continue (language), Sign in (sign-in), search field (Home), Sign out (Profile). |
| Loading, empty, error and offline states | **Verified**: skeleton rows while loading; empty pins invite search-and-pin (Jest); section error with "Try again" (Jest); server unreachable keeps the data with a notice and its time (Playwright); offline on a phone: needs a real phone (#20, #21). |
| Arabic (RTL) and English (LTR), no clipped Arabic | **Verified** on the web build: `dir` and screenshots in `docs/screenshots/p3c/` (ar-light, en-dark). Alignment on phones uses the new start/end helper (Jest); needs a real phone (#24). |
| Light and dark pass contrast | **Verified**: only theme tokens are used (lint forbids raw colours); token contrast is tested in `tokens.test.ts`. |
| Nothing from Section 3 | **Verified** by review: cards only for the appointment and pinned nameplates; flat rows elsewhere; no ALL-CAPS labels, middle dots, emoji or decorative motion. |
| 320 width and 200% text | 320 px: no horizontal scroll (styleguide test; the new screens use the same components). 200% text: needs a real phone (#8, #25); tab labels are deliberately capped at 130% (DESIGN.md Section 11). |
| Screen reader; keyboard on web | **Verified**: every control has a role and a name (Jest queries by role and label); rows and cards read as one sentence in the UI language; status changes are announced (Jest for the text). TalkBack/VoiceOver: needs a real phone (#5, #22). |
| Safe areas, Android back, keyboard | Safe-area insets on every screen and the tab bar (code); keyboard handling with KeyboardAvoidingView and inset adjustment. Needs a real phone (#10, #16). |
| Motion purposeful, reduced motion | **Verified** by review: the only motion is the door (status change) and press feedback, both honour reduced motion (P3b tests). |
| All copy from i18n; buttons name their action | **Verified**: `strings.test.ts` (same keys, placeholders and no English words in the Arabic file); button labels such as "Pin Dr. Khalid Al-Otaibi", "Try again", "Sign out". |
| Lighthouse | Not run: the web build is only the test harness now (product focus, DESIGN.md Section 11). |
