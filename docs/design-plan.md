# Mawjood: design plan (P3a)

Two directions for you to choose from, following DESIGN.md Section 10, step 1. No app code yet. Each direction has:
- named colors for light and dark;
- typeface and type scale;
- ASCII wireframes of Student Home and Professor Status;
- how the door is drawn and animated;
- a motion plan.

Section 5 then critiques both directions against DESIGN.md Section 3 and lists what was revised.

**Previews:** [`design-plan/direction-a.png`](design-plan/direction-a.png) and [`design-plan/direction-b.png`](design-plan/direction-b.png). They were rendered with the real fonts, and show:
- the palette;
- all five door states at 96, 24 and 16 px;
- a list row in Arabic (right-to-left) and in English;
- both themes.

They are design sketches, not screens.

**Recommendation:** the mix in Section 7: Direction B's doors and colors with Direction A's IBM Plex typography. Plain B is the alternative if you prefer Readex Pro's rounder voice.

---

## 1. What both directions share

These come from DESIGN.md and do not change between directions.

- **Status meaning:** always icon + label + color.

  | Status | Door | Color | Arabic | English |
  |---|---|---|---|---|
  | in_office | open, light inside | green | في المكتب | In office |
  | in_class | closed, book/board mark | amber | في محاضرة | In class |
  | busy | ajar, no-entry mark | red | مشغول | Busy |
  | away | closed, light off | gray | خارج المكتب | Away |
  | not confirmed / unknown | dashed outline door | gray | غير مؤكد | Not confirmed |

- **Radius by hierarchy:** sheets 20, cards 14, inputs 10, chips fully rounded.
- **Spacing:** 4-unit base (4, 8, 12, 16, 24, 32, 48, 64).
- **Touch targets:** at least 48.
- **Durations:** press 120 ms; small transitions 200 ms; sheets and the door 300–400 ms.
- **Elevation:** at most 3 levels; shadows only on floating layers.
- **Cards** only for self-contained objects: the next appointment, pinned professors, booking slots. Lists are flat rows with hairlines.
- **Brand hue: why blue.** DESIGN.md excludes green, amber and red (the status colors) and indigo/violet. That leaves roughly the blue-to-cyan band, about 190°–220° hue. Blue is also the conventional interactive color, so it never reads as a status. A uses a cobalt blue (213°), B a petrol blue-teal (193°). Both are dark enough to be used as text (4.5:1).
- **Neutrals:** tinted toward each direction's blue. Not pure gray, not cream.
- **Numbers:** Western digits in both languages. Times use our own Riyadh formatter.

## 2. Direction A: "Nameplate"

**Idea:** the corridor of a well-run department. Each professor is a crisp nameplate beside a modern door. The interface is calm, precise and institutional; it feels trustworthy because it is orderly. Boldness lives in the door line-art and in confident typography. Everything else is quiet.

### Color

| Role | Light | Dark |
|---|---|---|
| Background | Wall `#F2F5F8` | Night wall `#0D151E` |
| Surface (cards, sheets) | Plate `#FFFFFF` | Night plate `#152030` |
| Text | Ink `#15212E` | Chalk `#E7EEF5` |
| Secondary text | Graphite `#4B5A69` | Slate `#A3B2C2` |
| Primary (actions, focus, links) | Corridor blue `#1F4F8C` | Lit blue `#8AB6EE` |
| Text on primary | `#FFFFFF` | `#0D151E` |
| Hairline | Rule `#D6DEE6` | Night rule `#263445` |
| Door light (decorative) | Lamp `#FFE9A8` | Lamp `#F6D985` |
| Status: in office / in class / busy / away | `#178C55` / `#B06C00` / `#9F1F1A` / `#66727F` | `#63D69A` / `#F2B544` / `#E8524C` / `#94A2B1` |

The dark theme is designed separately, not inverted. It shows the corridor after hours: deep blue-black walls, slightly raised plates, and a lighter blue primary so buttons stay visible without glowing.

### Type: IBM Plex Sans Arabic + IBM Plex Sans

**Why this pair:**
- The Arabic and Latin were drawn as one system, with the same stroke contrast and matched vertical metrics, so mixed Arabic-English lines (names, course codes like CS 211) sit on one baseline.
- The Arabic is a low-contrast sans with open counters, so it reads cleanly at 13–15 on phones. Its signage-like neutrality matches the nameplate idea, and it is compact: about 17% narrower than Readex Pro in Arabic (measured below).
- Weights used: 400, 500 and 600.

| Role | Mobile size / weight | Arabic line height (1.7) | Latin line height (1.5) | Desktop |
|---|---|---|---|---|
| Caption ("updated 3 min ago") | 13 / 400 | 22 | 20 | same |
| Label, chip, button | 15 / 500 | 26 | 23 | same |
| Body | 17 / 400 | 29 | 26 | same |
| Title (row names, sheet titles) | 20 / 600 | 34 | 30 | 24 |
| Heading (screen titles) | 24 / 600 | 41 | 36 | 30 |
| Display (the professor's own status) | 30 / 600 | 51 | 45 | 30 |

### Layout concept

**Approach:** list-first and dense, start-aligned. In Arabic everything starts at the right edge.

- **Rows:** each list row is a nameplate: door (32) at the start edge, name and department, then status label and "updated…" at the end edge.
- **Cards:** used only for the next appointment and the pinned row.

The wireframes below are drawn in English (left-to-right). In Arabic they mirror horizontally; numbers and times do not mirror.

**Student Home** (360 wide):
```
┌────────────────────────────────────────┐
│ Good morning, Saad               [bell]│  heading 24
│ ┌────────────────────────────────────┐ │
│ │ [search] Search professors         │ │  input, radius 10
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │  card, radius 14 (only if one exists)
│ │ Next appointment                   │ │
│ │ Dr. Noura Al-Harbi                 │ │
│ │ Sunday 10:30, in 6 days            │ │
│ │ Building A, room 214               │ │
│ └────────────────────────────────────┘ │
│ My professors                          │  title 20
│ ┌───────────┐ ┌───────────┐ ┌─────────  pinned nameplates, scroll sideways
│ │[door]     │ │[door]     │ │[door]
│ │Dr. Noura  │ │Dr. Khalid │ │Mr. Faisal
│ │Away       │ │In office  │ │Away
│ │2 h ago    │ │not confirm│ │1 h ago
│ └───────────┘ └───────────┘ └─────────
│ Available now                          │
│ [door] Dr. Huda Al-Qahtani   In office │  flat row, 64 high
│        Information Systems   12 min ago│
│ ────────────────────────────────────── │  hairline
│ [door] Dr. Khalid Al-Otaibi  In office │
│        Computer Science    not confirmed│
├────────────────────────────────────────┤
│ Home   Search   Appts   Messages  Me   │  bottom tabs
└────────────────────────────────────────┘
```

**Professor Status:** one tap on a tile changes the status.
```
┌────────────────────────────────────────┐
│ My status                              │
│ ┌──────────────────┐┌─────────────────┐│  2 x 2 tiles, radius 14, 72 high
│ │[door] In office ✓││[door] In class  ││  selected: 2 px primary border + check
│ └──────────────────┘└─────────────────┘│
│ ┌──────────────────┐┌─────────────────┐│
│ │[door] Busy       ││[door] Away      ││
│ └──────────────────┘└─────────────────┘│
│ Updated just now, until 12:00          │  caption
│ (Back in 15 min) (Back in 30 min) (In… │  preset chips, scroll sideways
│ ┌────────────────────────────────────┐ │
│ │ Note for students            0/60  │ │
│ └────────────────────────────────────┘ │
│ Today                                  │
│ 08 ─────[class]──[office]────●──── 16  │  timeline, ● = now
│ Requests (2)                           │
│ Saad Al-Mutairi   Sun 10:30  [Decline] [Approve] │
├────────────────────────────────────────┤
│ Status  Requests  Schedule  Messages  Me│
└────────────────────────────────────────┘
```

### The door

**Drawing:**
- Line art on a 24-unit grid with a 1.75 stroke (the same stroke as Lucide), so the doors sit naturally among the UI icons.
- A rectangular frame with a solid floor line. The panel is a light 14–18% tint of the status color.
- Open: the panel swings toward the hinge as a narrow parallelogram, and warm lamp light fills the doorway and spills onto the floor.
- Busy: ajar, with a sliver of light and a small filled no-entry badge.
- In class: a closed door with a small board mark.
- Away: a solid gray panel (light off).
- Not confirmed: a dashed frame. The floor line stays solid so it still reads as a door.
- The app icon is the open door with a dot of light. It holds up at 16 px, though the line weight gets thin there.

**Animation** (react-native-svg + Reanimated):
- **Opening** (320 ms, ease-out): the panel's latch-side corners move from the latch edge to the hinge (animated path points). The lamp light fades in 80 ms after the panel starts.
- **Closing** (300 ms, ease-in): the reverse, with the light fading out first.
- **Color change:** a 200 ms cross-fade.

### Motion plan
- **Status change** (professor taps a tile): tile press scale 0.97 (120 ms), then the door animation, plus a light haptic. Students' screens cross-fade the door and label on the next poll, announced politely to screen readers.
- **Booking confirmed** (the one orchestrated moment):
  1. The sheet's door opens (320 ms).
  2. A checkmark draws inside the doorway (250 ms).
  3. The summary appears: "Booked with Dr. Noura, Sunday 10:30".
  4. A success haptic fires.
- **Sheets:** spring in (about 350 ms), ease-in out.
- **Skeletons:** shaped like nameplate rows.
- **Reduced motion:** instant state swaps plus 150 ms opacity fades; no door swing.

## 3. Direction B: "Lantern"

**Idea:** a doorway with a lamp behind it. The door is a simple round-arched doorway, a quiet nod to the arched doors of the region. It is drawn as pure geometry (one semicircle), never ornament.

- Doors are **solid shapes**, and light is the expressive element: an open door glows, and a closed one is dark.
- The interface around it is plain and roomy. The doors themselves are the memorable thing, larger than in A, and on Home the pinned professors appear as a short row of doorways rather than cards.

### Color

| Role | Light | Dark |
|---|---|---|
| Background | Mist `#F1F5F4` | Evening `#0A1A1E` |
| Surface | Paper `#FFFFFF` | Alcove `#12262B` |
| Text | Deep ink `#10262B` | Moonlight `#E4F0EF` |
| Secondary text | Stone `#46595D` | Haze `#9DB3B5` |
| Primary | Petrol `#0F5E73` | Lantern teal `#6CC3D6` |
| Text on primary | `#FFFFFF` | `#0A1A1E` |
| Hairline | Seam `#D2DEDD` | Dusk seam `#22393E` |
| Door light (decorative) | Lamp `#FFE3A1` | Lamp `#FFD27A` |
| Status: in office / in class / busy / away | `#21894F` / `#B06C00` / `#9F1F1A` / `#637174` | `#4FD18E` / `#F2B544` / `#F0564F` / `#93A6A9` |

**Dark mode is this direction's best moment:** "the corridor in the evening". Lit doorways glow against a deep petrol-black, which makes "who is in" readable at a glance.

### Type: Readex Pro (one family for Arabic and Latin)

**Why this typeface:**
- Readex Pro extends Lexend (a Latin face designed for reading ease) to Arabic. Both scripts share proportions, weights and vertical metrics in a single family, so there is no pairing to tune and only one font family to bundle.
- Its generous widths and large x-height suit small phone screens and quick glances between classes. Its rounded geometry is friendly without being childish at weights 400–600.
- **The cost: it is wide.** Measured with the real fonts at the same size on a sample of our own labels and names, it is **8% wider than IBM Plex in Latin and 20% wider in Arabic**. Arabic lines therefore wrap and truncate sooner on narrow phones, especially at 200% text size.
  - Body text is set at 16 rather than 17 to partly compensate.
  - Labels get reserved minimum widths.

| Role | Mobile size / weight | Arabic line height (1.7) | Latin line height (1.5) | Desktop |
|---|---|---|---|---|
| Caption | 13 / 400 | 22 | 20 | same |
| Label, chip, button | 15 / 500 | 26 | 23 | same |
| Body | 16 / 400 | 27 | 24 | 17 |
| Title | 20 / 600 | 34 | 30 | 24 |
| Heading | 24 / 600 | 41 | 36 | 30 |
| Display (the big status label) | 30 / 600 | 51 | 45 | 30 |

### Layout concept

**Approach:** door-forward, generous spacing, start-aligned text.

- **Home:** shows pinned professors as a row of large doorways (56) with names under them. There's no card chrome: the doors are the objects.
- **Professor Status:** opens on one large hero door (120) showing the current status, with four door buttons below.

**Student Home** (360 wide):
```
┌────────────────────────────────────────┐
│ Good morning, Saad               [bell]│
│ ┌────────────────────────────────────┐ │
│ │ [search] Search professors         │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │  card, radius 14
│ │ [door] Next: Dr. Noura Al-Harbi    │ │
│ │        Sunday 10:30, room A 214    │ │
│ └────────────────────────────────────┘ │
│ My professors                          │
│    ╭──╮       ╭──╮       ╭──╮          │  doorways 56, scroll sideways
│    │░░│       │██│       │██│          │  ░ lit (open)   █ closed
│   ─┴──┴─     ─┴──┴─     ─┴──┴─         │
│   Noura      Khalid     Faisal         │
│   Away       In office  Away           │
│              not confirmed             │
│ Available now                          │
│ [door] Dr. Huda Al-Qahtani   In office │  flat rows, door 40
│        Information Systems  12 min ago │
│ ────────────────────────────────────── │
├────────────────────────────────────────┤
│ Home   Search   Appts   Messages  Me   │
└────────────────────────────────────────┘
```

**Professor Status:** one tap on a door button changes the status, and the hero door animates.
```
┌────────────────────────────────────────┐
│                 ╭────╮                 │
│                 │░░░░│                 │  hero door 120 (current status)
│                ─┴────┴─                │
│                In office               │  display 30
│      Updated just now, until 12:00     │  caption
│  ╭──╮        ╭──╮        ╭──╮   ╭──╮   │  4 door buttons, 72 x 88 each
│  │░░│        │██│        │▓▓│   │██│   │
│ In office   In class     Busy    Away  │
│ (Back in 15 min) (Back in 30 min) (In… │  preset chips
│ ┌────────────────────────────────────┐ │
│ │ Note for students            0/60  │ │
│ └────────────────────────────────────┘ │
│ Today                                  │
│ 08 ─────[class]──[office]────●──── 16  │
│ Requests (2)                           │
├────────────────────────────────────────┤
│ Status  Requests  Schedule  Messages  Me│
└────────────────────────────────────────┘
```

### The door

**Drawing:**
- The doorway is a 12-wide, 15-tall arch on the 24-unit grid. Panels are solid status color, and the floor line uses the 1.75 stroke.
- Open: the leaf folds back to a slim strip at the hinge, the doorway fills with lamp light, and a soft pool of light sits on the floor.
- Busy: the leaf is almost closed with a glowing seam at the latch side, and a white bar on the leaf forms the no-entry mark.
- In class: a closed leaf with an open-book mark.
- Away: a closed gray leaf with a small knob and no light.
- Not confirmed: a dashed arch with a solid floor line.
- **At 16 px,** solid shapes read better than line art (compare the small icons in the previews). The arch silhouette makes a distinctive app icon: the doorway with a dot of light.

**Animation** (react-native-svg + Reanimated):
- **Opening** (360 ms, ease-out): the leaf path narrows toward the hinge. The lamp light rises from 0 to full opacity, starting 60 ms in, and the floor pool fades in last (120 ms).
- **Closing** (two beats, 400 ms total): the light goes out first (150 ms), then the leaf closes (250 ms, ease-in). Reading as "lights off, door shut" makes away and closed feel deliberate.
- **Busy:** the leaf stops at the ajar position.
- **Color change:** a 200 ms cross-fade.

### Motion plan
- **Status change:** door button press scale 0.97 (120 ms), the hero door animates, light haptic. Students' doors cross-fade on the next poll, with a polite screen-reader announcement.
- **Booking confirmed** (the one orchestrated moment):
  1. The professor's doorway lights up and opens (360 ms).
  2. A checkmark draws inside the lit doorway (250 ms).
  3. The summary appears: "Booked with Dr. Noura, Sunday 10:30".
  4. A success haptic fires.
- **Sheets:** spring in (about 350 ms).
- **Skeletons:** a row of gray arch silhouettes on Home, rows elsewhere.
- **Reduced motion:** the light and leaf swap instantly with a 150 ms opacity fade; no folding.

## 4. Measured checks

Checked with `python3 scripts/check_palette.py`. It reads [`design-plan/palettes.json`](design-plan/palettes.json) and fails if any check fails.

**WCAG 2.2 AA:** all 64 pairs pass, covering both directions and both themes.
- Body text, secondary text and primary-as-link reach 4.5:1 on both background and surface.
- Every status color reaches 3:1 as a UI component.
- Text on primary buttons reaches 4.5:1.

**Color blindness.** These figures are the smallest difference between any two status colors. CIE76 ΔE: about 2 is barely noticeable; 20+ is clearly different.

| Theme | Normal vision | Protanopia | Deuteranopia |
|---|---|---|---|
| A light | 41.3 | 26.5 | 23.5 |
| A dark | 54.7 | 33.0 | 28.6 |
| B light | 41.3 | 25.5 | 23.4 |
| B dark | 53.0 | 29.4 | 24.7 |

The first draft scored 11–14 under deuteranopia (green, red and amber collapsed toward olive). I separated them by **lightness**, using a lighter green and a deeper red in light themes and the reverse spread in dark themes, which roughly doubled the separation. Status is still never color-only: the door shape and the label carry it.

**Brand color vs status colors:** A's cobalt stays at least ΔE 24 from every status color. B's petrol stays at least ΔE 40 from "in office" green. It sits closer to "away" gray (ΔE 15–22 under simulation), which is acceptable because the brand color is never used on status elements.

## 5. Critique against DESIGN.md Section 3, and revisions

### Direction A

| Risk from Section 3 | Finding | Revision |
|---|---|---|
| Generic SaaS card kit | The first preview drew every list row as a bordered card. | List rows are now flat with hairlines; cards appear only for the next appointment and pinned nameplates. |
| "Corporate" feel (DESIGN.md: must not feel corporate) | Blue and white is the default palette of banks and enterprise tools; this is A's biggest risk. | Blue is used only for actions, links and focus rings, never for headers, banners or tinted backgrounds. Personality comes from the doors and the nameplate typography. The risk is reduced, not gone. |
| Skeuomorphism | A "nameplate" invites brass and wood. | Flat surfaces, a hairline frame and type only. |
| Door legibility | The dashed "not confirmed" door read as a selection marquee, and the busy badge was a blob at 16 px. | The floor line stays solid so the dashed shape still reads as a door; the badge is smaller and filled. |
| Templated chrome | Checked: no all-caps labels, no middle-dot meta strings, no arrows in buttons, no single-word highlights, no numbered markers, no fade-and-slide on sections. | Captions use plain sentences ("updated 12 min ago"). |

### Direction B

| Risk from Section 3 | Finding | Revision |
|---|---|---|
| Kitsch or decorative "local color" | Arches can slide into ornament (patterns, lattice, gold). | The arch is one semicircle and appears only in the doors and the app icon. No patterns, frames or textures anywhere. |
| Childish | Readex Pro's rounded forms can look playful at heavy weights. | Only weights 400–600; restrained scale; no bouncy motion except the sheet spring DESIGN.md allows. |
| Neon accents on near-black | The dark theme is dark with glowing doors. | The background is a petrol-tinted `#0A1A1E`, not black. The glow is a warm, desaturated lamp color, not neon, and the teal primary is used sparingly. |
| Floor glow | In light mode the light pool under the open door read as a smudge. | The pool is narrower and lower. |
| Text fitting | Readex Pro wrapped "Not confirmed" in the first preview; measured, it is 20% wider than Plex in Arabic. | Body 16 instead of 17, reserved minimum label widths, and names may wrap to two lines in rows instead of truncating. 320 width and 200% font scale are tested first thing in P3b. If Arabic still crowds, the fallback is B with IBM Plex typography. |
| Templated chrome | Same check as A, nothing found. | None needed. |

## 6. Recommendation

**Direction B, "Lantern".** Four reasons:

1. **It spends the boldness where DESIGN.md says to: the door.** Solid arched doorways with light are recognizable at a glance, and the open door literally glows. That directly answers "is Dr. X there?".
2. **It is more legible at 16 px.** Solid shapes survive small sizes better than line art (compare the small icons in the two previews), which matters for list rows and the app icon.
3. **It needs one font family for both scripts,** so mixed Arabic-English lines need no pairing work and there is less to bundle.
4. **Its dark theme feels "quietly alive"** without decoration.

**B's main cost is width.** Readex Pro's Arabic is 20% wider than Plex's, which matters for an Arabic-first app on small phones. If that worries you, the safest choice is the mix below: B's doors and colors with A's IBM Plex typography.

**Choose A** if you prefer a quieter, more institutional tone with denser lists. Its line-art doors match the UI icons exactly, and its Arabic type is the most compact of the options.

**Mixing is possible.** For example, B's doors and dark theme with A's IBM Plex typography, or A's layout density with B's doors.

## 7. The mix: B's doors and colors with A's typography

Preview: [`design-plan/direction-mix.png`](design-plan/direction-mix.png).

**What it combines:**
- **From Direction B:** everything visual. That is the petrol palette (light and dark), the solid arched doors that light up, the door-forward Home and the hero door on Professor Status, and the motion plan.
- **From Direction A:** only the typefaces, IBM Plex Sans Arabic and IBM Plex Sans, with A's type scale (body 17).

**What changes compared with B:**
- **Arabic text is about 17% narrower** (measured), so names, departments and status labels fit on small phones and at 200% text size with fewer wraps. This removes B's main cost.
- **Mixed lines still match:** Plex Arabic and Plex Latin were drawn together, so Arabic and English on one line still share a baseline.
- **The cost:** a slightly more neutral, less rounded voice than Readex Pro, and two font families to bundle instead of one.
- **Unchanged:** colors, doors and layout, so the contrast and color-blindness results in Section 4 apply as they are.

**This is now my recommendation:** B's signature with the most compact, legible Arabic.

## 8. Option requested: Direction A with the Lantern doors

Preview: [`design-plan/direction-a-lantern-doors.png`](design-plan/direction-a-lantern-doors.png).

**What it combines:**
- **From Direction A:** everything except the doors. That is the cobalt palette (light and dark), IBM Plex Sans Arabic + IBM Plex Sans with A's type scale, the list-first Home with pinned nameplates, and the 2 x 2 status tiles.
- **From Direction B:** the solid round-arched doors in all five states, lit from inside when open, with B's door animation (the light comes on, then the leaf folds back; closing is light off, then door shut).

**Notes:**
- **Colors are A's,** so the Section 4 results for A apply unchanged: all contrast pairs pass, and color-blind separation is at least ΔE 23.5.
- **The doors are solid shapes** while the other UI icons (Lucide) are line drawings. The doors are meant to be the one bold element, so the contrast in style is acceptable, but the icon set is less uniform than A's line doors.
- **Arabic is compact** because the type is Plex, the same as the mix in Section 7.

## 9. What I need from you
1. **Choose:** A, B, the mix (Section 7), or A with the Lantern doors (Section 8). I will record the choice in DESIGN.md Section 11.
2. **Approve the Expo client dependency list** in [plan.md](plan.md) so P3b can start. Readex Pro and IBM Plex Sans Arabic are both available as `@expo-google-fonts/*` packages; I used their files for these previews.
