# Real-phone checklist

The cloud sandbox has no phone or emulator, so these checks cannot run there (see [plan.md, "Checks that need a real phone"](plan.md#checks-that-need-a-real-phone)). They stay marked **needs a real phone** until someone runs them on a device and records the result here.

**Setup:** [run-on-phone.md](run-on-phone.md), Sections 1-3. Start MySQL, the backend and `npx expo start`, then open the app in Expo Go. The styleguide (P3b checks) is reached from **Profile → Styleguide (development only)** after signing in as a student.

**Record each result as:**
- ✅ passed;
- ❌ failed, with what you saw;
- the phone model and OS version.

Run on at least one Android phone and one iPhone if you can.

## P3b: foundations and /styleguide

| # | Check | Steps | Expected | Android | iOS |
|---|---|---|---|---|---|
| 1 | Opens in Expo Go | Scan the QR code from `npx expo start` | The splash shows a blue door on a light background (dark background in dark mode), then the styleguide in IBM Plex. No flash of a system font or a white screen in dark mode | needs a real phone | needs a real phone |
| 2 | Backend reachable over Wi-Fi | Look at the **Server connection** card at the top | A green check, **Reachable**, and an address like `http://192.168.x.x:8000/api/v1`. If you see **Not reachable**, follow run-on-phone.md Section 4 | needs a real phone | needs a real phone |
| 3 | RTL switch with reload | On first launch with the phone in Arabic, the page should be right-to-left. Tap **English** in Language: a short restart, then left-to-right. Tap **العربية**: restart, right-to-left again. Then close Expo Go fully and reopen | The direction always matches the language, including after the cold restart. The doors open towards the reading direction (hinge on the start side) | needs a real phone | needs a real phone |
| 4 | Haptics | In **Doors**, tap each status chip. Then tap **Show the toast** | A light tap on each status change; a "success" pattern with the toast. Nothing if the system has haptics off | needs a real phone | needs a real phone |
| 5 | Screen reader | Turn on TalkBack (Android) or VoiceOver (iOS) and swipe through the page | Every element is read with its name and role:<br>- headings read as headings;<br>- the large door reads "Status: In office";<br>- chips read as selected or not selected;<br>- each input reads its label and helper;<br>- the toast is announced when shown | needs a real phone | needs a real phone |
| 6 | Bottom sheet with a screen reader | With the screen reader on, tap **Open the sheet** and swipe | Focus stays inside the sheet (iOS: `accessibilityViewIsModal`); the dialog's title is read; **Close** is reachable | needs a real phone | needs a real phone |
| 7 | Android back closes the sheet | Open the sheet and press back (button or gesture) | The sheet closes; a second back leaves the app | needs a real phone | n/a |
| 8 | Font size 200% | Android: *Settings → Display → Font size* at maximum (and *Display size* default). iOS: *Settings → Accessibility → Display & Text Size → Larger Text* at the largest standard size. Reopen the app | Text grows (capped at 200%), nothing is cut off or overlapping, and rows wrap names instead of truncating them to a few letters | needs a real phone | needs a real phone |
| 9 | Keyboard over inputs | Scroll so **Note for students** is near the bottom of the screen and tap it | The field moves above the keyboard and stays visible while typing; tapping a chip while the keyboard is up works on the first tap | needs a real phone | needs a real phone |
| 10 | Safe areas | Look at the top and bottom of the page and the open sheet, on a phone with a notch or punch-hole and a home indicator or gesture bar | Nothing under the status bar, notch or home indicator; the sheet's buttons sit above the gesture bar | needs a real phone | needs a real phone |
| 11 | Reduce motion | Android: *Settings → Accessibility → Remove animations*. iOS: *Settings → Accessibility → Motion → Reduce Motion*. Reopen the app; tap door statuses; open the sheet; press buttons | Door changes are instant, the sheet appears without sliding, buttons don't scale, skeletons don't pulse | needs a real phone | needs a real phone |
| 12 | Dark mode follows the system | Set the theme to **System**, then switch the phone between light and dark | The app follows straight away. **Light** and **Dark** override the system and survive an app restart. The area behind the app (seen briefly on rotation or when swiping back) matches the theme | needs a real phone | needs a real phone |
| 13 | Smoothness (indicative) | Scroll the whole styleguide quickly; tap through the door statuses | Scrolling stays smooth, and the door animation doesn't stutter. Expo Go runs a development build, so this is indicative only; the real numbers (cold start under 2 s, 60 fps) need a release build (plan.md) | needs a real phone | needs a real phone |

## P3c: language, sign-in, student home

Start from a fresh install of the app's data: in Expo Go, long-press the project and clear its data, or delete and re-add it. Sign in with `s.almutairi@university.example` / `Mawjood-Demo-2026`. Run the API without `DEMO_NOW` to see real-time statuses, or with it for the same statuses as the screenshots.

| # | Check | Steps | Expected | Android | iOS |
|---|---|---|---|---|---|
| 14 | Language first | Open the app for the first time with the phone in Arabic, then again (after clearing data) in English | The language screen comes first, the phone's language is preselected but nothing changes until **Continue** | needs a real phone | needs a real phone |
| 15 | Direction after the choice | On the language screen pick the language that is not the phone's and tap Continue | One short restart, then sign-in in the chosen direction | needs a real phone | needs a real phone |
| 16 | Keyboard on sign-in | Tap the email field, type, press the return key; on the password field press return | The fields stay above the keyboard; return moves to the password, then signs in; the email keyboard has @ | needs a real phone | needs a real phone |
| 17 | Password managers | Tap the email field | iOS offers saved passwords (username/password content types); Android autofill offers saved accounts | needs a real phone | needs a real phone |
| 18 | Stay signed in (secure storage) | Sign in, close Expo Go fully, reopen | Home opens straight away, signed in, without the sign-in screen | needs a real phone | needs a real phone |
| 19 | "Is Dr. X in?" in 3 s | With the app closed, start a stopwatch, open it | The pinned professors' doors and statuses are readable within 3 seconds, with no taps | needs a real phone | needs a real phone |
| 20 | Offline | On Home, turn on airplane mode, wait 30 s | The statuses stay, a notice says "You're offline. These statuses are from HH:MM."; turning the connection back on removes it at the next poll | needs a real phone | needs a real phone |
| 21 | Offline cold start | In airplane mode, close and reopen the app | Home opens signed in with the last known statuses and the offline notice; never a blank screen | needs a real phone | needs a real phone |
| 22 | Live status with a screen reader | Turn on TalkBack/VoiceOver on Home; on a computer, set a pinned professor's status in http://localhost:8000/docs (sign in as `n.alharbi@university.example`, `POST /api/v1/me/status`) | Within about 20 s the door changes and the reader says, for example, "Dr. Noura Al-Harbi is now In office" | needs a real phone | needs a real phone |
| 23 | Pin from search | Type part of a name (Arabic or English) in the search field, tap the pin beside a result | A toast confirms; clearing the search shows the professor under **My professors** | needs a real phone | needs a real phone |
| 24 | Arabic alignment | In Arabic, look at the status text at the end of each row and at text typed into the search field | Status text hugs the left edge of the row; typed Arabic starts at the right | needs a real phone | needs a real phone |
| 25 | Tab bar | Look at the tab bar with the largest system text size | Labels are readable and not cut off; the bar sits above the home indicator or navigation bar | needs a real phone | needs a real phone |
| 26 | Sign out | Profile → Sign out, then close and reopen the app | Sign-in screen; reopening does not sign you back in | needs a real phone | needs a real phone |

## P4: search, profile, booking, appointments, professor and admin screens

Sign in as the account named in each check (password `Mawjood-Demo-2026`). `l.alshehri@university.example` can book Dr. Noura; `s.almutairi@university.example` already has the maximum of 2 bookings with her.

| # | Check | Steps | Expected | Android | iOS |
|---|---|---|---|---|---|
| 27 | Profile in 1 tap | As Lama, tap Dr. Noura on Home | Her profile opens: door, name, rank, office, status, today's timeline | needs a real phone | needs a real phone |
| 28 | Back | On the profile, use the back arrow, then the Android back gesture or button | Both return to Home; the arrow points toward the start edge (right in Arabic) | needs a real phone | needs a real phone |
| 29 | Booking in 4 steps | Book, pick a day, pick a time, tap "Book HH:MM" | The door opens with a check, "Booked with ...", and a success vibration | needs a real phone | needs a real phone |
| 30 | Unavailable times | In the booking sheet, tap a greyed-out time; with TalkBack/VoiceOver, swipe over it | It says why (taken or passed); the reader says "HH:MM, unavailable" | needs a real phone | needs a real phone |
| 31 | Booking sheet and keyboard | Type in "Note for the professor" | The field stays above the keyboard; the sheet scrolls; Android back closes the keyboard first, then the sheet | needs a real phone | needs a real phone |
| 32 | Booking limit | As Saad, try to book Dr. Noura | The limit message appears and the chosen day, time and topic stay selected | needs a real phone | needs a real phone |
| 33 | Cancel | Appointments, Cancel appointment, then Cancel appointment again in the sheet | The appointment shows Cancelled; "Keep it" closes without cancelling | needs a real phone | needs a real phone |
| 34 | Search filters | Search tab: tap In office, then a department | Results match; "Clear search and filters" resets everything | needs a real phone | needs a real phone |
| 35 | One-tap status | As `k.alotaibi@university.example`, tap Busy; on another phone, Saad has Dr. Khalid's profile open | A light vibration; the tile is selected at once; Saad's screen shows Busy within about 20 s, and a screen reader announces it on Home | needs a real phone | needs a real phone |
| 36 | Presets and note | Tap "Back in 15 min"; type a note and Save note | The status shows Away until the return time; students see the note on the profile | needs a real phone | needs a real phone |
| 37 | Requests | As Dr. Noura after #29, open Requests, tap Approve | A toast confirms; Lama's Appointments shows Approved within about 20 s | needs a real phone | needs a real phone |
| 38 | Schedule editor | Schedule, Add a block, enter 15:00 and 16:00 on Thursday, Save; open it again and Delete | The block appears and disappears; a wrong time such as 15:10 shows an error next to the field | needs a real phone | needs a real phone |
| 39 | Admin forms | As `admin@university.example`, add a department with an invalid code, then a valid one; delete it | Errors show next to the fields and above Save; delete asks first | needs a real phone | needs a real phone |
| 40 | Five tabs at 200% text | With the largest text size, look at the admin tab bar | All five labels readable, none clipped | needs a real phone | needs a real phone |

## P5: chat, notifications, settings

Use two phones (or one phone and the web build): `s.almutairi@university.example` (student) and `n.alharbi@university.example` (Dr. Noura); `y.alghamdi@university.example` has no booking with Mr. Faisal.

| # | Check | Steps | Expected | Android | iOS |
|---|---|---|---|---|---|
| 41 | Composer and keyboard | As Saad, Messages, Dr. Noura, tap the message field and type three lines | The field and Send stay above the keyboard; the newest message stays visible; Android back closes the keyboard first | needs a real phone | needs a real phone |
| 42 | Bubbles in both directions | Read the thread in Arabic, then in English | Your bubbles at the end edge (left in Arabic, right in English), theirs at the start edge; the back arrow points toward the start edge | needs a real phone | needs a real phone |
| 43 | Send and receipt | Send a message; on Dr. Noura's phone open the conversation | Saad sees "Sent" at once and "Read" within about 15 s | needs a real phone | needs a real phone |
| 44 | Failed send | Turn on airplane mode and send | The message stays, "Not sent. Tap to try again."; tap it after reconnecting and it sends | needs a real phone | needs a real phone |
| 45 | Quick reply | As Dr. Noura, tap "Come now" | It sends in one tap; Saad sees it within about 15 s | needs a real phone | needs a real phone |
| 46 | Badges | After #43 (before reading), look at Dr. Noura's tab bar and bell; turn on TalkBack/VoiceOver and move to the Messages tab | A number on Messages and on the bell; the reader says "Messages, 1 unread" and "Notifications, 2 new" | needs a real phone | needs a real phone |
| 47 | Notifications | Tap the bell, then the new message row | Today / Earlier groups; the row opens the conversation; "Mark all as read" clears the New marks | needs a real phone | needs a real phone |
| 48 | Chat not allowed | As Yousef, open Mr. Faisal's profile and tap Message | A message explains that a booking is needed first; no conversation opens | needs a real phone | needs a real phone |
| 49 | Text size | Profile, Text size: Larger; then also set the phone's largest text size | Every screen grows; nothing is clipped; the five tab labels stay on one line (they shrink rather than overlap) | needs a real phone | needs a real phone |
| 50 | Notification preferences | Turn off Messages; send Saad a message from Dr. Noura | The bell does not count it and the list says some are hidden; the Messages tab still shows it | needs a real phone | needs a real phone |

## Later phases (added when the feature exists)

- **P6:** a final pass of everything above.
