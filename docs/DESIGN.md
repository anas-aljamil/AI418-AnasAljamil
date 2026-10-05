Mawjood: Design Brief and Design System
0. How to use this document

This file is authoritative for all UI work. Read it fully before any frontend task. If something is not covered, choose the option most consistent with Sections 1 to 3, then record it in Section 11 (Design decisions log). "Remove one accessory": before finishing any screen, look for one decorative element that does not serve the user and remove it.

1. The brief
Product: Mawjood (موجود, "present, here"). It tells students whether a professor is in their office right now, and lets them book a slot and send a message.
Audience:
Students (primary): mostly on phones, between classes, impatient, Arabic-first with mixed English.
Professors (secondary): all ages and comfort levels with technology, often on a desktop between tasks, with little patience for admin work.
Design for the least tech-comfortable professor and the most impatient student at the same time.
Primary job of the interface: answer "Is Dr. X there right now, and can I trust that?" in under 3 seconds.
Personality: calm, warm, trustworthy, quietly alive. A well-run department corridor, not a corporate dashboard and not a game.
Must feel: clear, warm, alive, respectful.
Must not feel: corporate, gimmicky, cluttered, childish, boring.
2. Signature element: the door

Spend the boldness here. Keep everything around it quiet and disciplined.

Every professor's status is shown with a small custom SVG door icon plus a text label:
In office: door open, warm light spilling out.
In class: door closed, small board/book mark.
Busy: door ajar, small "do not disturb" mark.
Away: door closed, light off.
Not confirmed / Unknown: dashed-outline door.
The professor profile header is a modern, subtle take on the office nameplate beside a real office door: name, title, department, building and room. No wood or metal textures, no skeuomorphism.
When a status changes, the door animates (opens, closes, light fades in or out) in 300 to 400 ms. This is the app's one recognizable motion.
The logo and favicon come from the same idea (for example, a door shape with a dot of light). It must stay legible at 16 px.
3. Avoid templated defaults

Do not ship any of the following unless I explicitly ask for it:

The generic SaaS card kit: everything chopped into identical rounded cards, one radius on everything, the same grey shadow under each, gradient washes as decoration.
Indigo or violet gradients, glassmorphism everywhere, neon accents on black.
Cream background with serif display and terracotta accent; near-black background with acid-green accent.
Tracked ALL-CAPS labels above headings; meta strings joined with middle dots; arrows appended to button text; monospace for small labels; numbered 01/02/03 markers on content that is not a sequence.
Highlighting a single word in a headline with a different color or weight.
Fade-and-slide-up on every section, hover effects on every card, decorative auto-playing animation.
Emoji used as icons, stock illustrations, lorem ipsum, real-looking stock photos of people.
A grid of identical professor cards as the only way to browse.

Use cards only for self-contained objects (an appointment, a professor in a pinned row). Use lists, rows, and plain sections elsewhere. Vary radius by hierarchy: large surfaces and sheets 20 px, cards 14 px, inputs 10 px, chips and pills fully rounded.

4. Visual foundations (tokens)

All values live in CSS variables and the Tailwind theme. No hard-coded colors, spacing, radii, or durations in components.

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
Light and dark themes are two separately designed palettes; dark is not an inverted light theme.
Contrast (WCAG 2.2 AA) in both themes: 4.5:1 for body text, 3:1 for large text and UI components.
Color is never the only carrier of meaning.
4.2 Typography
Arabic-first. Use one family that covers Arabic and Latin with matched metrics, or a deliberate, well-matched pair (candidates: Readex Pro; IBM Plex Sans Arabic with IBM Plex Sans). Justify the choice. Do not default to Inter alone.
Mobile type scale: 13, 15, 17, 20, 24, 30 px. Body text 16 to 17 px. Headings step up one level on desktop.
Line height: about 1.7 for Arabic, about 1.5 for Latin. Line length at most 70 characters.
Sentence case everywhere. Build hierarchy with size and weight, not color tricks.
Numerals: Western digits (0 to 9) in both languages for times, dates, and room numbers, used consistently.
4.3 Space, shape, elevation
Spacing scale on a 4 px base: 4, 8, 12, 16, 24, 32, 48, 64.
Radius by hierarchy (Section 3).
At most 3 elevation levels. Prefer surface-color contrast and hairline borders; use shadows only for floating layers (sheets, menus, toasts).
4.4 Icons and illustration
Lucide icons with a consistent stroke (about 1.75 px) for UI.
Custom SVG doors for status (Section 2).
Empty-state illustrations: simple line drawings in the same stroke style (a corridor, a door, a calendar) using only brand and neutral colors.
5. Motion
Motion only answers a user action or shows a state change.
Durations: 120 ms for press feedback, 200 ms for small transitions, 300 to 400 ms for sheets and the door animation. Ease-out on enter, ease-in on exit, springs for sheets.
Press feedback: subtle scale (about 0.97) on primary controls.
One orchestrated moment: booking confirmed. The door opens, a checkmark appears, and the summary reads like "Booked with Dr. X, Sunday 10:30".
Live updates: when a visible professor's status changes, cross-fade the door and label and announce it with aria-live="polite".
Skeleton loaders shaped like the real content. Optimistic updates for status changes and messages, with clear rollback on failure.
prefers-reduced-motion: replace movement with instant or opacity-only changes.
Use Motion (Framer Motion) for React animation; no second animation library.
6. Layout and navigation
Mobile-first.
Phones: bottom tab bar.
Students: Home, Search, Appointments, Messages, Profile.
Professors: Status, Requests, Schedule, Messages, Profile.
Desktop (1024 px and up): side rail navigation and two-pane layouts (list plus detail) where it helps.
Primary actions sit within thumb reach on phones; sticky where useful (Book and Message on the profile).
Touch targets at least 44 x 44 px with at least 8 px between them.
No horizontal page scroll at 320 px.
Every gesture (swipe, long-press) also has a visible button.
7. Screen specifications

Each screen defines its purpose, key content, primary action, and loading, empty, error, and offline states.

7.1 Language and sign-in
First launch asks for language (العربية / English) before anything else.
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
7.5 Booking (bottom sheet on mobile, dialog on desktop)
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
Desktop: compact enough to keep open in a browser tab. Reflect the current status in the tab title and favicon.
7.9 Notifications and settings
Notifications grouped by today and earlier, each linking to its source.
Settings: language, theme (system, light, dark), text size (default, large, larger), notification preferences.
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
WCAG 2.2 AA. Semantic HTML, labelled inputs, visible focus rings, full keyboard navigation, screen-reader announcements for status changes and toasts.
Text can grow to 200% without lost content or overlap.
Status is readable without color (icon plus label).
RTL and LTR are both first-class: logical CSS properties (ms, me, ps, pe, text-start), mirrored directional icons, numbers and times never mirrored.
Performance on a mid-range Android phone over 4G: LCP under 2.5 s, INP under 200 ms, initial JavaScript at most 200 KB gzipped, lazy-loaded secondary routes, font-display: swap with a sensible system fallback stack.
Slow or offline: show the last known status with its timestamp and a clear offline notice. Never show a blank screen.
10. Design process for Claude Code
Design plan (no code). Propose two clearly different directions grounded in Sections 1 and 2. For each give:
4 to 6 named hex colors for light and for dark,
the typeface choice and type scale,
a layout concept with ASCII wireframes of Student Home and Professor Status,
how the door signature will be drawn and animated,
a short motion plan. Then critique each direction against Section 3. Revise anything that reads as generic and state what you changed and why. Write it to docs/design-plan.md, commit, and stop for my choice.
Foundations. Implement tokens, fonts, theme switching, RTL, the i18n scaffold, and a /styleguide route that shows every token and component (buttons, chips, inputs, all door states, list rows, cards, bottom sheet, toast, skeletons, empty state) in Arabic and English, light and dark. Stop for review.
Screens. Build one screen at a time in the order of Section 7, using real seed data.
Visual self-review. If a headless browser is available (for example Playwright), capture screenshots at 360, 768, and 1280 px in Arabic-light and English-dark, review them, and fix problems before reporting. If not, describe the manual checks I should do.
Run the Section 12 checklist for each screen and report the results honestly, including failures.
11. Design decisions log

Append entries as: date, decision, reason.

12. Quality checklist (every screen)
 Answers its main question within 3 seconds of looking
 One clear primary action
 Loading, empty, error, and offline states designed
 Arabic (RTL) and English (LTR) both correct; no clipped Arabic text
 Light and dark both pass contrast
 Nothing from Section 3 present
 Works at 320 px width and at 200% text size
 Keyboard and screen-reader usable
 Motion is purposeful; reduced motion respected
 All copy comes from i18n files; every button names its action
 Lighthouse mobile: accessibility at least 95, performance at least 90 (if Lighthouse is available)
