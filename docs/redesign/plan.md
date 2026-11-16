# Mawjood: redesign plan (two directions)

> **Status: the owner chose the recommended mix (Section 6) on 2026-11-15.** Phases R1
> (foundations), R2 (student Home, Search, profile, booking sheet) and R3 (professor My status,
> Requests, Schedule; every appointment as a ticket) are built; R3 waits for review. Chat,
> notifications, settings, admin and sign-in screens are not rebuilt yet (R4). Owner request
> (2026-11-14): rebuild the interface so it is more beautiful, more modern, more practical,
> and innovative. This follows the process in [DESIGN.md](../DESIGN.md) Section 10, step 1.
>
> Changed while building R1 (reasons in DESIGN.md Section 11): the light band is `#0E2441`,
> not `#0F2747`; the status sentence says "until 11:00 AM", not "back at 11:00 AM".

Live preview: open [preview.html](preview.html) in a browser and switch direction and theme
with the buttons. Screenshots of it:
[1 light](direction-1-light.png), [1 dark](direction-1-dark.png),
[2 light](direction-2-light.png), [2 dark](direction-2-dark.png).

The previews use the fictional seed professors at the demo moment (Monday 10:00 AM), but
their statuses are chosen to show every door state; they are not the seed's real statuses.
The Direction 2 screenshots show headings in IBM Plex because the Reem Kufi font could not be
downloaded where the screenshots were taken; the live preview shows it.

## 1. What is weak today

Looked at in `docs/screenshots/` (phone and 1280 px):

1. **The signature is too small to be one.** The door is 24 to 32 px beside a name. Nothing on
   Home is recognisably Mawjood from across a room.
2. **Everything has the same weight.** Pale wall, white plates, hairlines. No anchor, and on a
   laptop most of the screen is empty wall.
3. **The status line answers the wrong follow-up.** "Away, updated 5 days ago" tells a student
   nothing they can act on. The API already returns `until`; the list never shows it.
4. **"When can I catch him?" costs a tap per professor.** Today's blocks are only on the
   profile.

Both directions fix 1 to 3. Direction 2 also fixes 4 in the list itself.

## 2. Shared by both directions

- Status colours stay as they are (checked by `scripts/check_palette.py`), with the door icon
  and a text label every time. Colour-vision palettes stay.
- **Status sentence:** label plus what happens next, from `status.until`: "In office until
  12:00 PM", "In class, back at 11:00 AM", "Away, back at 1:00 PM". "Updated X ago" moves to
  the profile and appears in lists only for a not-confirmed status.
- The next appointment becomes a **ticket**: time large on the start edge, a dashed fold,
  then professor, room and state.
- Tab bar: the current tab gets a filled pill behind its icon as well as colour and weight.
- Arabic-first RTL, 48 px targets, 200% text, reduced motion, and the Section 12 checklist are
  unchanged requirements.

## 3. Direction 1: "The corridor" (الممر)

**Idea:** Home is the department corridor seen from the front. A dark band holds a row of tall
doors; a lit door means the professor is in. The answer arrives as light before any word is
read, and it works without colour.

### Colour

| Role | Light | Dark |
| --- | --- | --- |
| Corridor (band, rail) | `#0F2747` | `#060C15` |
| Wall (screen) | `#F1F4F8` | `#0C1420` |
| Plate (cards, inputs) | `#FFFFFF` | `#141F2E` |
| Ink / Chalk (text) | `#101C2B` | `#E8EEF6` |
| Door blue (actions) | `#1B5BD0` | `#86B4FF` |
| Lamp (light, decorative) | `#FFD56B` | `#F8D572` |

The band is dark in both themes, so it always uses the dark-theme status colours. Checked by
hand: Door blue on white 6.1:1; the busy label on the band is `#F06A64` (4.96:1) because the
dark busy red `#E8524C` is only 4.1:1 there. Every other pair is to be checked in
`tokens.test.ts` and `check_palette.py` in phase R1 before any screen is built.

### Type

IBM Plex Sans Arabic + IBM Plex Sans stay (no new dependency). One change: weight 700 for the
screen heading only (the package already contains it). Scale unchanged: 13, 15, 17, 20, 24, 30.

### Layout

```
Student Home (phone)                 Professor "My status" (phone)
+------------------------------+     +------------------------------+
|# Mawjood                 bell|     |# Mawjood               bell 1|
| Good morning, Saad           |     |  +----+  Students see you now|
| Two of your professors are in|     |  |    |  In office           |
|  __    __    __    __        |     |  |LIT |  until 12:00 PM,     |
| |LT|  |BK|  |LT|  |--|  ->   |     |  +----+  by your timetable   |
| ============================ |     |  [In] [Class] [Busy] [Away]  |
| Noura Khalid Omar  Huda      |     +------------------------------+
| until  back   until until    |     | (Back in 15) (Back in 30)    |
|   ( Search professors ... )  |     | (Away for today)             |
+------------------------------+     | + Add a note for students    |
| 10:30 AM | Dr. Noura Al-Harbi|     | One request is waiting       |
| Sunday   | Bldg A, room 214  |     | [ Saad, Tue 10:00, 15 min  ] |
| Software Engineering now     |     | [ Approve  Decline  Message ]|
| door  name, sentence     pin |     +------------------------------+
+------------------------------+     | tabs                         |
| tabs                         |
```

- The corridor scrolls sideways on phones (a fourth door peeks in to show it); on desktop it is
  a wide band beside the greeting, with the navy side rail joining it.
- Search sits on the band's lower edge, so it is reachable without scrolling.
- Lists below stay flat rows on the wall. Text is start-aligned everywhere; only door captions
  in the corridor are centred under their door.

### The door

A tall doorway (2:3, on a 64 x 96 grid) for the corridor and the professor's hero, with the
same five states and the same construction as today: lit doorway, leaf swung on the hinge
side, pool of light on the floor. The current 24-grid door stays for 16 to 32 px and the app
icon. Animation is the existing one (leaf and lamp, 300 to 400 ms, Reanimated).

### Motion

The door animation on a status change, press feedback, sheets. Nothing new, nothing on load.

### Needs

No API change, no schema change, no new dependency.

## 4. Direction 2: "The day line" (خط اليوم)

**Idea:** a professor's presence is a line through the day. Every row carries a ribbon from
8 AM to 5 PM with office hours, classes and meetings on it, and one "now" line crosses all of
them. You see who is in and when the others will be, without opening anyone.

### Colour

| Role | Light | Dark |
| --- | --- | --- |
| Paper (screen) | `#F8F9FB` | `#0E1116` |
| Plate | `#FFFFFF` | `#171B22` |
| Ink / Chalk (text and actions) | `#14181F` | `#ECEFF3` |
| Muted | `#505A66` | `#A5AEB9` |
| Rule | `#DDE2E8` | `#2A303A` |
| Link and focus | `#1F4F8C` | `#8AB6EE` |

Colour is reserved for status. Buttons, the current tab and the now line are ink, so nothing
competes with the green of "in office". Ribbon kinds also differ by pattern: office hours
solid, classes hatched, meetings dotted, not-confirmed office hours a dashed outline.

### Type

Screen headings in **Reem Kufi** (a squared Kufic face that echoes the square doors), body and
everything else in IBM Plex Sans Arabic + IBM Plex Sans. English headings stay in IBM Plex.

### Layout

```
Student Home (phone)                 Professor "My status" (phone)
+------------------------------+     +------------------------------+
|# Mawjood                 bell|     |# Mawjood               bell 1|
| Monday 5 October             |     | [door] You are in the office |
| Two of your professors are   |     |  until 12:00 PM. This is what|
| in their offices now         |     |  students see.               |
| ( Search professors ... )    |     | [In] [Class] [Busy] [Away]   |
|  8AM  [now 10:00]  12   2   4|     | Your day                     |
| door Dr. Noura     In office |     |  8AM [now]   12     2     4  |
|                  until 12:00 |     | [//////][########]  [/////]  |
| --///--|#####----///------   |     |  Class   Office hrs  Class   |
| door Prof. Khalid   In class |     | (Back in 15) (Back in 30)    |
|                back at 11:00 |     | One request is waiting       |
| --##-//|//###-------::---    |     | [ Saad, Tue 10:00, 15 min  ] |
| ...                          |     | [ Approve  Decline  Message ]|
+------------------------------+     +------------------------------+
| tabs                         |     | tabs                         |
```

- On desktop the board becomes a table: names on the start side, wide ribbons, one continuous
  now line; the next appointment sits in a side column.
- Tapping a free stretch of a ribbon opens booking on that time (the row itself still opens
  the profile; the same action is on the profile's Book button).

### The door

The existing door at 22 to 52 px as the row icon and beside the professor's heading. It is no
longer the largest thing on screen; the ribbon is.

### Motion

The door animation, press feedback, sheets. The now line moves with the clock without
animation.

### Needs approval

- A new font dependency: `@expo-google-fonts/reem-kufi`.
- An API addition (no schema change): the professor list must carry today's blocks, which only
  the profile returns now. Cache buster changes.

## 5. Critique against DESIGN.md Section 3, and revisions

**Direction 1**

- Risk: a dark header band over a light page is a common app layout. Kept, because here the
  band is the corridor and exists to make lit doors read; without doors (Search, Appointments,
  Messages) screens keep a plain wall heading, so it does not become a template.
- Revised: the first draft glowed every open door and added a gradient to the band. The band
  is now flat and the glow is only the lamp colour around a lit door: the one decoration left.
- Revised: the busy label on the band failed contrast (4.1:1); changed to `#F06A64`.
- Card kit: cards are only the ticket, a request and the four status tiles. Rows stay flat.

**Direction 2**

- Risk: ink-only UI with hairlines can read as the broadsheet look. Kept rounded ribbons,
  pills and the existing radii; no columns of rules.
- Revised: the first draft set every heading in Reem Kufi. At 20 px it looked stretched, so
  only the screen heading uses it.
- Revised: on phones the continuous now line crossed the professors' names. It is now a tick
  on each ribbon there, and one continuous line on desktop where names have their own column.
- Risk for "must not feel corporate": the board is close to a scheduling tool. The door and
  the sentence beside every name keep it personal, but this is the cooler of the two.

## 6. Recommendation

**Direction 1, plus the day ribbon from Direction 2 where the data already exists**: on the
professor profile and on My status (both already receive today's blocks). Reasons:

1. It makes the door, the app's signature, the first thing seen, which DESIGN.md Section 2
   asks for and the current build does not deliver.
2. It needs no API, schema or dependency change, so it carries the least risk for a graded
   project.
3. It answers "is Dr. X in?" by light alone, before reading, and still works in greyscale.

Ribbons in the list (full Direction 2) can follow later if wanted, with the API addition.

## 7. If approved: phases and acceptance

Each phase stops for review, as in CLAUDE.md Section 13.

| Phase | Work | Done when |
| --- | --- | --- |
| R1 | Tokens (both themes), tall door, band/app bar, status sentence helper, tab bar; `/styleguide` updated | typecheck, lint, Jest (WCAG token test) and `check_palette.py` pass; styleguide screenshots at 360, 768, 1280 |
| R2 | Student Home, Search, profile, booking sheet | Section 12 checklist per screen; Playwright screenshots Arabic light and English dark; sweep has no console errors |
| R3 | Professor My status, Requests, Schedule | same; status still changes in one tap |
| R4 | Messages, notifications, settings, sign-in and sign-up, admin; desktop and tablet layouts | same, plus `e2e/desktop.spec.ts` |
| R5 | Final QA at 320 and 200% text, DESIGN.md Sections 2, 4, 7 and 11 and CLAUDE.md updated | all client checks pass; real-phone checks listed as unverified |

## 8. What I need from you

1. **Choose:** Direction 1, Direction 2, or the recommended mix (Section 6).
2. If Direction 2 or its list ribbons: approve the Reem Kufi dependency and the API addition.
