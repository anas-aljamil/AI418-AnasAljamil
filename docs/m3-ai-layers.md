# M3: the two AI layers

Milestone 3 (AI 418) asks Lab Track teams for two working intelligent layers that participants use in the usability study. Mawjood has these two, both client only. They add no API, schema or dependency change.

| | Layer 1: adaptive, "Suggested next step" | Layer 2: conversational, "Ask by voice" |
|---|---|---|
| Where | Professor profile, under the band (students) | Microphone on student Home, beside the bell |
| M2 task flow | Intelligent layer 1 on W6: "how likely the status is right now, shown with its uncertainty" | Replaces M2's layer 2 (a status suggestion for professors): M3 participants are students, and every layer must be used in a student task |
| Code | `app/src/features/adaptive/` (`nextStep.ts`, `habits.ts`, `NextStepCard.tsx`) | `app/src/features/voice/` (`commands.ts`, `useSpeech.ts`, `VoiceAssistant.tsx`) |
| How it is built | Rules over the live status, the timetable, booking times, closed message hours, and a count kept on the device of whether this student books or messages first | The browser's Web Speech API (`SpeechRecognition`, `ar-SA` or `en-US`, 3 guesses). Rules map the words to an intent (status, book or message) and a professor's name (Arabic letter folding, one-letter tolerance) |
| When it is unsure | A confidence pill (Sure, Likely, Not sure). "Not sure" keeps Message first ("Ask if they're in"). "Why this?" lists the reasons | Always shows "I heard: …". A tie gives "Which professor did you mean?". No match gives "Try again" or "Type instead". A denied microphone says how to allow it |
| Correct, undo, turn off | Hide tip (this professor, until the app reopens). Settings: Next-step tips off, and "Forget whether I book or message first". Habits are deleted on sign-out | "Not this professor" listens again. Nothing happens without a tap. Settings: Voice commands off, Read answers aloud off |

## Layer 1 rules (`nextStep.ts`)

| Status | Kind | Confidence | First move |
|---|---|---|---|
| In office, confirmed | go ("You can go now", until when) | Sure if set by the professor, Likely from the timetable | Message ("Say you're coming") |
| In office by the timetable, not confirmed in 4 h | check_first | Not sure | Message ("Ask if they're in") |
| In class or busy | wait (until when) | Sure or Likely | Book |
| Away with a return time | back_later | Likely | Book |
| Away otherwise | next_hours (later today, else the first later day this week) | Likely | Book |
| No office hours left this week | no_hours | Not sure | Message |

After two or more Book or Message taps on profiles, the student's more frequent move goes first. A "Not sure" tip is the exception. Book is left out when the professor has no booking times. Message is left out while the professor's message hours are closed.

## Layer 2 commands (`commands.ts`)

- Status (the default): "Is Dr. Noura in?", "هل د. نورة موجودة؟". The answer is shown with the door, the status sentence and the office, read aloud, and offers "Open profile".
- Book: "book", "appointment", "احجز", "موعد". Offers "Book with …", which opens the profile with the booking sheet up.
- Message: "message", "text", "راسل", "رسالة". Offers "Message …", which opens the conversation.

The listening language follows the app and can be switched in the sheet. The microphone is hidden where the browser has no recognizer (Firefox, Expo Go on a phone) and when Voice commands are off.

## Checks

- Jest: `features/voice/commands.test.ts` (Arabic and English, spelling tolerance, intents, a tie, no match, alternatives) and `features/adaptive/nextStep.test.ts` (every kind, habits, unsure keeps Message first, impossible moves left out).
- By hand, on the public link in Chrome: allow the microphone, say "هل د. نورة موجودة؟", and check the answer, the read-aloud and "Not this professor". Deny the microphone and check the message. Open a professor whose office hours are on but who has not set a status, and check "Not sure" with Message first. Turn both layers off in Profile and check that they disappear.
