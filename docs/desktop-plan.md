# Mawjood: desktop and tablet layouts (plan, for approval)

Owner decision 2026-11-10: the browser version is the product and must work for anyone, so laptops and tablets need real layouts instead of a stretched phone screen. This plan applies what DESIGN.md already specifies for the desktop web build (Section 6: side rail and two-pane list plus detail from 1024 px; 7.5: booking as a dialog; 4.2: headings one step up; 7.8: status in the tab title) and replaces the 2026-10-05 "no desktop layouts" decision. Colours, type, doors, motion and copy stay as they are (Direction A).

## 1. Breakpoints

| Width | Name | Navigation | Content |
|---|---|---|---|
| under 768 px | phone | bottom tabs (unchanged) | one column, full width (unchanged) |
| 768 to 1023 px | tablet | bottom tabs | one column, centred, at most 720 px wide |
| 1024 px and up | desktop | side rail | two panes where listed below, otherwise one column of at most 760 px |

One hook, `useLayout()` in `app/src/lib/layout.ts`, reads `useWindowDimensions()` and returns `phone | tablet | desktop`. Phones in Expo Go are always `phone`, so the native app does not change. Turning a tablet or resizing a window switches layout live; nothing is lost (selection lives in the URL).

## 2. Side rail (desktop)

```
+----------+---------------------------------------------------------+
| [door]   |                                                         |
| Mawjood  |   screen content                                        |
|          |                                                         |
| > Home   |                                                         |
|   Search |                                                         |
|   Appts  |                                                         |
|   Msgs 2 |                                                         |
|   Profile|                                                         |
|          |                                                         |
| [bell]   |                                                         |
+----------+---------------------------------------------------------+
```

- The same tabs as on phones, drawn by React Navigation's own side position for tabs (`tabBarPosition: 'left'`, which follows the reading direction: on the right in Arabic). No new dependency.
- 240 px wide, labels beside icons, the Mawjood door and name on top, the current tab marked by a primary-coloured bar plus weight (not colour alone), the unread badge as on phones.
- Keyboard: Tab reaches each rail item in order, with the visible focus ring the app already uses; Enter opens it.

## 3. Screens

Two panes = a list on the start side (about 380 px) and the selected item on the end side. The selected item is in the URL (`?id=12`), so Back, reload and shared links work. On phones and tablets the same tap opens the full screen as today.

### Student
- **Home:** two columns. Start: greeting, search, next appointment, Available now. End: My professors as a vertical list of nameplates (on phones it is a horizontal row).
  ```
  | Good afternoon, Saad            [bell] |  My professors           |
  | [ Search professors ...            ]   |  [door] Prof. Khalid  ... |
  | Next appointment: Dr. Noura, 10:30     |  [door] Mr. Faisal    ... |
  | Available now                          |  [door] Dr. Noura     ... |
  |  [door] Dr. Noura   In office  3 min   |                           |
  ```
- **Search:** two panes: results on the start side, the selected professor's full profile (nameplate, Today agenda, booking times, Book / Message / Pin) on the end side. Empty end pane: "Choose a professor to see their status".
- **Professor profile (opened directly):** one column of 760 px; the sticky bottom bar becomes a normal action row under the nameplate.
- **Booking:** a centred dialog (at most 640 px wide, 85% of the window high) instead of the bottom sheet, same steps. Every other sheet (cancel, move earlier, forms, menus) becomes a dialog the same way, from one change in `BottomSheet`.
- **Appointments:** one column of 760 px (cards).
- **Messages:** two panes: conversations on the start side, the open thread with its composer on the end side.

### Professor
- **My status:** two columns. Start: the four status doors, presets and note. End: Today agenda and pending requests. The browser tab title shows the status ("In office | Mawjood"), as DESIGN.md 7.8 asks.
- **Requests:** one column of 760 px.
- **Schedule:** one column of 760 px; its sheets become dialogs.
- **Messages:** two panes, as for students.

### Admin
- **Professors, Students, Campus:** two panes: the list with its filters on the start side; the quick view or the form on the end side instead of a sheet. Add opens the empty form in the end pane.
- **Overview:** number tiles in one row of four; the waiting-for-activation list below.

### Unchanged on every width
Language, sign-in, sign-up and notifications: one centred column of at most 520 px (sign-in, sign-up, language) or 760 px (notifications).

## 4. What does not change
- No API, database or dependency change.
- Phones, including Expo Go, look and behave exactly as now; every existing Jest and Playwright test keeps passing.
- Headings step up one level on desktop only (DESIGN.md 4.2); body text stays 17.

## 5. Acceptance criteria
1. Playwright screenshots of every screen above at 1280 px and 768 px, in Arabic light and English dark, plus the existing 360 px set, in `docs/screenshots/desktop/`; I review each one and fix what looks wrong before reporting.
2. No horizontal scroll at 320, 768, 1024 and 1280 px (checked in Playwright).
3. Two-pane screens: selecting an item updates the URL; reloading the page reopens the same item; browser Back returns to the previous selection.
4. Keyboard only, at 1280 px: reach every rail item, open a professor from Search, book a slot in the dialog and close it with Escape; focus rings visible throughout.
5. Booking still takes at most 4 steps; the professor's status still takes 1 click.
6. The console sweep (`sweep.spec.ts`) passes at 1280 px with no console error or failed request.
7. Jest: tests for `useLayout()` and for the rail, two-pane and dialog switches; all existing tests pass.
8. DESIGN.md Section 11 records the decisions; CLAUDE.md drops "no desktop layouts".

## 6. Order of work
1. `useLayout()`, the side rail and the centred column (every screen benefits at once).
2. Sheets as dialogs on desktop (booking first).
3. Two panes: Search, Messages, admin lists.
4. Two columns: Home, My status; tab title.
5. Screenshots at every width, review, fixes, docs.

## 7. As built (2026-11-10)
Approved by the owner on 2026-11-10 and built as planned, with two changes recorded in DESIGN.md Section 11:
- the rail has no Mawjood logo on top (it would need React Navigation internals; each screen names itself);
- admin panes keep the open row in the screen, not in the URL (a form with unsaved input cannot be restored from a link anyway); Search and Messages use `?id=` as planned.
Browser Back after changing the selection replaces the address instead of stepping back through earlier selections (Expo Router's setParams), so criterion 3 is met for reload and shared links, not for Back.
