Mawjood: Design Brief and Design System
0. How to use this document

This file is authoritative for all UI work. Read it fully before any client task. The client is one Expo (React Native) codebase that runs on Android and iOS and as an Expo web build; where a rule differs by platform, the native rule and the web rule are both stated. If something is not covered, choose the option most consistent with Sections 1 to 3, then record it in Section 11 (Design decisions log). "Remove one accessory": before finishing any screen, look for one decorative element that does not serve the user and remove it.

1. The brief
Product: Mawjood (موجود, "present, here"). It tells students whether a professor is in their office right now, and lets them book a slot and send a message.
Audience:
Students (primary): mostly on phones, between classes, impatient, Arabic-first with mixed English.
Professors (secondary): all ages and comfort levels with technology, often on a desktop between tasks (they use the web build there and the phone app elsewhere), with little patience for admin work.
Platforms: Android and iOS phones (primary, through Expo Go), the Expo web build on desktop browsers (professors, admin, projector demos).
Design for the least tech-comfortable professor and the most impatient student at the same time.
Primary job of the interface: answer "Is Dr. X there right now, and can I trust that?" in under 3 seconds.
Personality: calm, warm, trustworthy, quietly alive. A well-run department corridor, not a corporate dashboard and not a game.
Must feel: clear, warm, alive, respectful.
Must not feel: corporate, gimmicky, cluttered, childish, boring.
2. Signature element: the door

Spend the boldness here. Keep everything around it quiet and disciplined.

Every professor's status is shown with a small custom SVG door icon (drawn with react-native-svg so the same component renders on native and web) plus a text label:
In office: door open, warm light spilling out.
In class: door closed, small board/book mark.
Busy: door ajar, small "do not disturb" mark.
Away: door closed, light off.
Not confirmed / Unknown: dashed-outline door.
The professor profile header is a modern, subtle take on the office nameplate beside a real office door: name, title, department, building and room. No wood or metal textures, no skeuomorphism.
When a status changes, the door animates (opens, closes, light fades in or out) in 300 to 400 ms, using Reanimated on the UI thread. This is the app's one recognizable motion.
The logo, app icon (including the Android adaptive icon and its monochrome layer) and web favicon come from the same idea (for example, a door shape with a dot of light). It must stay legible at 16 px.
3. Avoid templated defaults

Do not ship any of the following unless I explicitly ask for it:

The generic SaaS card kit: everything chopped into identical rounded cards, one radius on everything, the same grey shadow under each, gradient washes as decoration.
Indigo or violet gradients, glassmorphism everywhere, neon accents on black.
Cream background with serif display and terracotta accent; near-black background with acid-green accent.
Tracked ALL-CAPS labels above headings; meta strings joined with middle dots; arrows appended to button text; monospace for small labels; numbered 01/02/03 markers on content that is not a sequence.
Highlighting a single word in a headline with a different color or weight.
Fade-and-slide-up on every section, hover effects (web) or bouncy press effects (native) on every card, decorative auto-playing animation.
Emoji used as icons, stock illustrations, lorem ipsum, real-looking stock photos of people.
A grid of identical professor cards as the only way to browse.

Use cards only for self-contained objects (an appointment, a professor in a pinned row). Use lists, rows, and plain sections elsewhere. Vary radius by hierarchy: large surfaces and sheets 20, cards 14, inputs 10, chips and pills fully rounded (dp on native, px on web).

4. Visual foundations (tokens)

All values live in one typed theme module (src/theme/: color palettes for light and dark, type scale, spacing, radii, elevation, durations), read through a useTheme() hook and React Native StyleSheet. No hard-coded colors, spacing, radii, or durations in components; a lint rule flags raw hex values and numeric literals in style objects outside src/theme/. (Web equivalent of CSS variables: the same module drives the web build, so there is one source of truth.)

4.1 Color
Status colors are conventional because most users already understand them. Each is always paired with the door icon and a text label:
In office: green
In class: amber
Busy: red
Away: neutral gray
Not confirmed: outlined gray
Check that status states remain distinguishable with deuteranopia and protanopia; the icon and label must carry the meaning on their own.
Brand primary: a hue that does not compete with the status hues (not green, amber, or red) and is not indigo/violet. Propose it in the design plan with reasoning.
Neutrals: slightly tinted to harmonize with the primary. Not pure gray, not cream.
Light and dark themes are two separately designed palettes; dark is not an inverted light theme. The app follows the system setting (useColorScheme / Appearance) unless the user picks one in Settings; status bar, navigation bar and splash background follow the active theme.
Contrast (WCAG 2.2 AA) in both themes: 4.5:1 for body text, 3:1 for large text and UI components.
Color is never the only carrier of meaning.
4.2 Typography
Arabic-first. Use one family that covers Arabic and Latin with matched metrics, or a deliberate, well-matched pair (candidates: Readex Pro; IBM Plex Sans Arabic with IBM Plex Sans). Justify the choice. Do not default to Inter alone, or to the platform system font alone. Fonts are bundled with the app (expo-font with the @expo-google-fonts package of the chosen family) so they work offline; the splash screen stays until fonts load.
Mobile type scale: 13, 15, 17, 20, 24, 30 (px on web, density-independent points on native). Body text 16 to 17. Headings step up one level on the desktop web layout.
Line height: about 1.7 for Arabic, about 1.5 for Latin. React Native needs absolute line heights, so the theme computes them per size and per script. Line length at most 70 characters.
System font scale: text respects the phone's font-size setting up to 200% (maxFontSizeMultiplier = 2); layouts must reflow, not clip. This replaces browser zoom on native.
Sentence case everywhere. Build hierarchy with size and weight, not color tricks.
Numerals: Western digits (0 to 9) in both languages for times, dates, and room numbers, used consistently. Times are formatted in Asia/Riyadh by our own small formatter (Riyadh is a fixed UTC+3) rather than relying on Intl time-zone support, which differs between Hermes on Android, iOS and browsers.
4.3 Space, shape, elevation
Spacing scale on a 4-unit base (dp on native, px on web): 4, 8, 12, 16, 24, 32, 48, 64.
Radius by hierarchy (Section 3).
At most 3 elevation levels. Prefer surface-color contrast and hairline borders (StyleSheet.hairlineWidth on native); use shadows only for floating layers (sheets, menus, toasts). Native shadows differ by platform (iOS shadow props, Android elevation); the theme defines each level for both so they look the same.
4.4 Icons and illustration
Lucide icons (lucide-react-native, rendered with react-native-svg) with a consistent stroke (about 1.75) for UI.
Custom SVG doors for status (Section 2).
Empty-state illustrations: simple line drawings in the same stroke style (a corridor, a door, a calendar) using only brand and neutral colors.
5. Motion
Motion only answers a user action or shows a state change.
Durations: 120 ms for press feedback, 200 ms for small transitions, 300 to 400 ms for sheets and the door animation. Ease-out on enter, ease-in on exit, springs for sheets.
Press feedback: subtle scale (about 0.97) on primary controls (Pressable + Reanimated).
Haptics (native only, expo-haptics): a light impact when a professor changes status, and a success notification haptic at the booking-confirmed moment. Nowhere else; never as decoration. Haptics follow the system setting and are skipped when the device has them disabled.
One orchestrated moment: booking confirmed. The door opens, a checkmark appears, and the summary reads like "Booked with Dr. X, Sunday 10:30".
Live updates: when a visible professor's status changes, cross-fade the door and label and announce it politely: accessibilityLiveRegion="polite" on Android, AccessibilityInfo.announceForAccessibility on iOS, aria-live="polite" on the web build (React Native Web maps accessibilityLiveRegion to aria-live).
Skeleton loaders shaped like the real content. Optimistic updates for status changes and messages, with clear rollback on failure.
Reduced motion: when the system setting is on (AccessibilityInfo.isReduceMotionEnabled / Reanimated useReducedMotion on native, prefers-reduced-motion on web), replace movement with instant or opacity-only changes.
Use Reanimated for all animation (no Moti, no second animation library). Animations run on the UI thread and must hold 60 fps on a mid-range Android phone.
6. Layout and navigation
Mobile-first.
Phones: bottom tab bar (Expo Router tabs).
Students: Home, Search, Appointments, Messages, Profile.
Professors: Status, Requests, Schedule, Messages, Profile.
Desktop web build (1024 px and up): side rail navigation and two-pane layouts (list plus detail) where it helps. The admin area is designed for this layout only.
Primary actions sit within thumb reach on phones; sticky where useful (Book and Message on the profile).
Touch targets at least 48 x 48 (dp on Android, which also satisfies the 44 pt iOS minimum; px on web) with at least 8 between them; use hitSlop rather than shrinking visible spacing.
No horizontal scroll at 320 width (dp or px).
Every gesture (swipe, long-press, pull-to-refresh) also has a visible button.
Safe areas: every screen respects notches, the home indicator and Android navigation bars (react-native-safe-area-context); sticky bars sit above the home indicator.
Android back button: closes the topmost sheet, dialog or keyboard first, then goes back one screen; it never exits the app from a sheet, and never loses a booking in progress without confirmation.
Keyboard: an input never sits under the on-screen keyboard (KeyboardAvoidingView or scroll-into-view); the chat composer stays above it; tapping outside dismisses it; the return key moves to the next field or submits.
7. Screen specifications

Each screen defines its purpose, key content, primary action, and loading, empty, error, and offline states.

7.1 Language and sign-in
First launch asks for language (العربية / English) before anything else; the device language (expo-localization) is preselected, never auto-applied.
Changing language switches layout direction with I18nManager.forceRTL and then reloads the app cleanly (expo-updates reloadAsync) after a one-line explanation, returning the user to the same screen; on the web build the document dir attribute changes without a reload.
Sign in with a university email. The role comes from the account, not from a user choice.
7.2 Student home ("Now")

Purpose: answer "who can I see right now?"

[Good morning, Anas]                                  [bell]
[ Search professors by name or department ...          ]
[ Next appointment: Dr. X, today 10:30, Bldg A room 214 ]   (only if one exists, with countdown)
My professors        (pinned, horizontal row: door, name, status, "updated 3 min ago")
Available now        (list rows from my departments, available first, then by name)
Greeting changes with the time of day.
Empty state (nothing pinned): invite the student to search and pin their professors.
7.3 Search and browse
Instant search across Arabic and English names with Arabic normalization: ignore diacritics; treat أ إ آ ا as equal, ة and ه as equal, ى and ي as equal.
Filter chips: department, status, has office hours today.
Results are list rows: door, name, department, status label, last updated. Available professors first.
7.4 Professor profile
Nameplate header (Section 2) with the door, status label, the professor's short note, and last updated time.
Office location (building, floor, room).
A "Today" timeline showing office-hour blocks with a marker for the current time.
Sticky bottom bar: Book (primary), Message (secondary), Pin (icon button).
7.5 Booking (bottom sheet on phones, dialog on desktop web)
Day strip (Sunday to Thursday, this week and next).
Time chips. Unavailable times stay visible but disabled, and tapping one explains why.
Optional topic chips (Assignment, Exam review, Advising, Other) plus optional short text.
Confirmation summary, then the signature moment (Section 5).
Never lose the user's selection on an error.
7.6 My appointments
Upcoming and Past via a segmented control.
Each appointment: professor, time, location, state pill (Pending, Approved, Declined, Cancelled, Completed).
Actions: Message, Cancel (with confirmation). Inside the 1-hour cancellation window, Cancel is disabled and explains why.
7.7 Messages
Conversation list and thread. Bubbles follow reading direction (correct in RTL and LTR), grouped timestamps, sent and read indicators.
Professor quick replies: "Come now", "Running 10 minutes late", "Let's reschedule".
7.8 Professor home ("My status")

This is the most important professor screen and must be usable in one tap by anyone.

Top: a large status control with the four doors; the current one clearly selected.
Below: quick presets ("Back in 15 min", "Back in 30 min", "In office until ...", "Away for today") and an optional note of up to 60 characters.
Then: today's schedule timeline and pending requests with Approve and Decline buttons (swipe is only a shortcut).
Desktop web: compact enough to keep open in a browser tab. Reflect the current status in the tab title and favicon (web only; native apps have no equivalent and use no app-icon badge).
7.9 Notifications and settings
Notifications grouped by today and earlier, each linking to its source.
Settings: language, theme (system, light, dark), text size (default, large, larger; multiplies the system font scale, capped at 200% total), notification preferences (in-app only).
8. Content and voice
Plain, warm, respectful. Arabic must read as natural Modern Standard Arabic, never machine-translated. Address the user directly.
Buttons say exactly what happens: "Book 10:30", "Send", "Cancel appointment". The same verb carries through the flow (Book, then Booked).
Status labels:
في المكتب / In office
في محاضرة / In class
مشغول / Busy
خارج المكتب / Away
غير مؤكد / Not confirmed
Relative time: "updated 3 min ago" / "آخر تحديث قبل 3 دقائق".
Errors state what happened and how to fix it, without apologizing or blaming. Empty states invite an action.
All strings live in i18n files (ar.json, en.json). No hard-coded UI text.
9. Inclusive by default
WCAG 2.2 AA (applied to the native app as well as the web build). Native: every control has accessibilityRole, accessibilityLabel and accessibilityState (selected, disabled, busy); logical reading order for TalkBack and VoiceOver; accessibilityViewIsModal on sheets and dialogs so focus stays inside. Web: semantic HTML via React Native Web roles, visible focus rings, full keyboard navigation. Both: labelled inputs, screen-reader announcements for status changes and toasts.
Text can grow to 200% without lost content or overlap (system font scale on native, browser zoom on web).
Status is readable without color (icon plus label).
RTL and LTR are both first-class: direction comes from I18nManager on native and the dir attribute on web; styles use logical properties only (marginStart/End, paddingStart/End, start/end, textAlign "auto"), directional icons are mirrored in RTL, numbers and times are never mirrored.
Native performance (mid-range Android phone, release build): cold start to an interactive Home under 2 s; scrolling and animations at a steady 60 fps (long lists use FlatList virtualization, no layout animations on scroll). Measured on a release build; numbers taken in Expo Go development mode are reported but are not representative.
Web build performance (mid-range Android phone over 4G, web build only): LCP under 2.5 s, INP under 200 ms, initial JavaScript at most 200 KB gzipped, lazy-loaded secondary routes, font-display: swap with a sensible system fallback stack.
Slow or offline: show the last known status with its timestamp and a clear offline notice (connectivity from @react-native-community/netinfo; last known data persisted on the device). Never show a blank screen.
10. Design process for Claude Code
Design plan (no code). Propose two clearly different directions grounded in Sections 1 and 2. For each give:
4 to 6 named hex colors for light and for dark,
the typeface choice and type scale,
a layout concept with ASCII wireframes of Student Home and Professor Status,
how the door signature will be drawn and animated,
a short motion plan. Then critique each direction against Section 3. Revise anything that reads as generic and state what you changed and why. Write it to docs/design-plan.md, commit, and stop for my choice.
Foundations. Implement the typed theme module, fonts, theme switching, RTL (with the reload flow), the i18n scaffold, and a /styleguide route (an Expo Router screen available on native and web) that shows every token and component (buttons, chips, inputs, all door states, list rows, cards, bottom sheet, toast, skeletons, empty state) in Arabic and English, light and dark. Stop for review.
Screens. Build one screen at a time in the order of Section 7, using real seed data.
Visual self-review. Capture Playwright screenshots of the Expo web build at 360, 768, and 1280 px in Arabic-light and English-dark, review them, and fix problems before reporting. Native-only behavior (haptics, TalkBack/VoiceOver, system font scale, safe areas, Android back, keyboard, RTL reload, performance) cannot be seen in those screenshots: list these as manual checks on a real phone, with exact steps, and report them as unverified until I confirm them.
Run the Section 12 checklist for each screen and report the results honestly, including failures.
11. Design decisions log

Append entries as: date, decision, reason.

2026-10-05, The client is one Expo (React Native) + TypeScript + Expo Router codebase for Android, iOS and web; every web-only rule in this file now has a stated native equivalent, Reason: students are mostly on phones; professors still get a desktop web build.
2026-10-05, Tokens live in a typed theme module read through StyleSheet instead of NativeWind or CSS variables, Reason: type-checked tokens, no extra Babel/Metro layer, logical start/end properties are built into React Native, and it works unchanged in Expo Go and on web.
2026-10-05, Minimum touch target raised from 44 to 48, Reason: 48 dp is the Android guideline and also satisfies the 44 pt iOS minimum.
2026-10-05, Chosen direction: Direction A "Nameplate" with square lit doors (docs/design-plan.md Section 9), Reason: chosen by the product owner after comparing Directions A, B, the B/Plex mix, A with arched doors and A with square doors.
2026-10-05, Palette = Direction A: light Wall #F2F5F8, Plate #FFFFFF, Ink #15212E, Graphite #4B5A69, Corridor blue #1F4F8C (on it #FFFFFF), Rule #D6DEE6, Lamp #FFE9A8; dark Night wall #0D151E, Night plate #152030, Chalk #E7EEF5, Slate #A3B2C2, Lit blue #8AB6EE (on it #0D151E), Night rule #263445, Lamp #F6D985. Status light / dark: in office #178C55 / #63D69A, in class #B06C00 / #F2B544, busy #9F1F1A / #E8524C, away #66727F / #94A2B1, Reason: all WCAG 2.2 AA pairs pass and status colours stay at least delta E 23.5 apart under simulated protanopia and deuteranopia (scripts/check_palette.py).
2026-10-05, Typeface = IBM Plex Sans Arabic + IBM Plex Sans, weights 400/500/600, body 17, scale 13/15/17/20/24/30, Reason: Arabic and Latin drawn as one system; the Arabic is about 17% narrower than Readex Pro (measured), so labels fit small phones and 200% text.
2026-10-05, Door = square doorway on a 24-unit grid, solid shapes lit from inside: open = leaf swung toward the viewer as a hinge-side trapezoid with lamp light in the doorway and on the floor; busy = nearly closed with a glowing latch-side seam and a no-entry bar; in class = closed with a book mark; away = closed and dark with a knob; not confirmed = dashed outline on a solid floor line, Reason: the owner preferred square doors to arches; solid lit shapes read better at 16 px than line art.
2026-10-05, Layout = Direction A: list-first Home with flat hairline rows, cards only for the next appointment and pinned nameplates; Professor Status as 2 x 2 status tiles with presets, note, today's timeline and requests, Reason: chosen direction.

12. Quality checklist (every screen)
 Answers its main question within 3 seconds of looking
 One clear primary action
 Loading, empty, error, and offline states designed
 Arabic (RTL) and English (LTR) both correct; no clipped Arabic text
 Light and dark both pass contrast
 Nothing from Section 3 present
 Works at 320 width and at 200% text size (system font scale on native, zoom on web)
 Screen-reader usable (TalkBack, VoiceOver, and the web build); keyboard usable on the web build
 Safe areas respected; Android back button behaves as in Section 6; keyboard never covers an input
 Motion is purposeful; reduced motion respected; haptics only where Section 5 allows
 All copy comes from i18n files; every button names its action
 Lighthouse mobile on the web build: accessibility at least 95, performance at least 90 (if Lighthouse is available)
 Each check is marked verified (how) or "needs a real phone"
