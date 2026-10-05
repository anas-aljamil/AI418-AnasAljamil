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

## P4: search, profile, booking, appointments, professor and admin screens (2026-10-05)

| Section 12 item | Result |
|---|---|
| Answers its main question within 3 s | **Verified** on the web build: the profile shows the status at the top; Search shows statuses in each row; My status shows the current tile selected. On a phone: needs a real phone (#27, #35). |
| One clear primary action | **Verified** by review: Book (profile), Book HH:MM (sheet), Cancel appointment (appointments), the status tiles (My status), Approve (requests), Add a block (schedule), Add (admin). |
| Loading, empty, error and offline states | **Verified**: skeletons while loading; empty states for no search results, no appointments, no requests, nothing on a schedule day; a retry on every list error (Jest for search, booking and admin; Playwright for the flows). Offline: the same query layer as Home (P3c), so the last known data stays; needs a real phone (#20). |
| Arabic (RTL) and English (LTR), no clipped Arabic | **Verified** on the web build: `docs/screenshots/p4/ar-*` and `en-*`. The timeline and the check badge now follow the reading direction on the web build too (`insetStart` / `insetEnd`). Phones: needs a real phone (#24, #28). |
| Light and dark pass contrast | **Verified**: only theme tokens are used (lint); the timeline uses the status colours, which pass 3:1 on the surface. |
| Nothing from Section 3 | **Verified** by review: cards only for appointments and the nameplate; flat rows elsewhere; no arrows in button text; no decorative motion beyond the door. |
| 320 width and 200% text | Not measured at 320 px for the P4 screens (screenshots are at 360 px); by review, chips wrap and sheets scroll. 200% text: needs a real phone (#40). |
| Screen reader; keyboard on web | **Verified**: roles and names on every control (Jest queries by role); request buttons name the student and time; unavailable times say "unavailable"; tiles are a radio group. TalkBack/VoiceOver: needs a real phone (#30, #35). |
| Safe areas, Android back, keyboard | The profile's Book bar sits above the home indicator; sheets scroll with the keyboard. Needs a real phone (#28, #31). |
| Motion purposeful, reduced motion | **Verified** by review: the booking moment (door opens, check) and the door on status changes are the only motion; reduced motion swaps instantly (Door component). Haptics only on status change and booking confirmed. |
| All copy from i18n; buttons name their action | **Verified**: `strings.test.ts`; labels such as "Book 10:30", "Cancel appointment", "Approve: Lama Al-Shehri, Tomorrow 10:00". |
| Lighthouse | Not run (web build is the test harness only). |

## P5: conversations, thread, notifications, settings (2026-10-05)

| Section 12 item | Result |
|---|---|
| Answers its main question within 3 s | **Verified** on the web build: the conversation list shows who wrote, the unread count and the last message; the Messages tab and the bell carry unread counts. On a phone: needs a real phone (#46). |
| One clear primary action | **Verified** by review: Send (thread), the quick replies for professors, opening a row (lists), Mark all as read (notifications). |
| Loading, empty, error and offline states | **Verified**: skeletons while loading; empty states for no conversations (with Search professors for students), no messages, no notifications; a retry on load errors; a failed send stays with "Not sent. Tap to try again." (Jest). Offline: needs a real phone (#44). |
| Arabic (RTL) and English (LTR), no clipped Arabic | **Verified** on the web build: `docs/screenshots/p5/ar-*` and `en-*`; bubbles sit at the end edge for your messages and the start edge for theirs in both directions. Phones: needs a real phone (#42). |
| Light and dark pass contrast | **Verified**: only theme tokens are used (lint); your bubbles use primary / on-primary, which pass AA in both themes (`tokens.test.ts`). |
| Nothing from Section 3 | **Verified** by review: no middle dots (meta lines use the language's comma), no emoji, no decorative motion; bubbles and rows are flat. |
| 320 width and 200% text | Bubbles are at most 80% wide and wrap; the composer grows to several lines. At 360 px the five tab labels did not fit, so they now shrink to fit one line on phones (DESIGN.md Section 11). 200% text: needs a real phone (#49). |
| Screen reader; keyboard on web | **Verified**: rows read as one sentence ("Dr. Noura Al-Harbi, 1 unread, ..."); the composer is labelled "Message to Dr. Noura Al-Harbi"; the Messages tab says "Messages, 1 unread" and the bell "Notifications, 2 new" (Playwright queries by these names); send errors are in a live region. TalkBack/VoiceOver: needs a real phone (#46). |
| Safe areas, Android back, keyboard | The header respects the top inset and the composer the bottom inset; KeyboardAvoidingView keeps the composer above the keyboard. Needs a real phone (#41). |
| Motion purposeful, reduced motion | **Verified** by review: no new motion; sending only fades the pending bubble. |
| All copy from i18n; buttons name their action | **Verified**: `strings.test.ts`; labels such as "Send", "Come now", "Message Dr. Noura Al-Harbi", "Mark all as read". |
| Lighthouse | Not run (web build is the test harness only). |

