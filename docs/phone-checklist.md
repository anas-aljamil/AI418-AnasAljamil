# Real-phone checklist

The cloud sandbox has no phone or emulator, so these checks cannot run there (see [plan.md, "Checks that need a real phone"](plan.md#checks-that-need-a-real-phone)). They stay marked **needs a real phone** until someone runs them on a device and records the result here.

**Setup:** [run-on-phone.md](run-on-phone.md), Sections 1-3. Start MySQL, the backend and `npx expo start`, then open the app in Expo Go. The app opens on `/styleguide` until P3c adds the real home screen.

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

## Later phases (added when the feature exists)

- **P3c:**
  - the refresh token is stored in secure storage, and you stay signed in after closing the app;
  - the keyboard on the sign-in screen;
  - the offline notice with airplane mode.
- **P4:**
  - booking haptic;
  - the professor's one-tap status change with haptic;
  - Android back on every stack screen.
- **P5:**
  - the chat composer stays above the keyboard;
  - message bubbles in both directions.
- **P6:** a final pass of everything above.
