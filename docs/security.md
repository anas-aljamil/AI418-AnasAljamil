# Mawjood: security and privacy decisions

This file covers the implementation of CLAUDE.md Section 8. The code is in `backend/app/core/security.py`, `backend/app/api/v1/auth.py`, `backend/app/deps.py` and `backend/app/core/rate_limit.py`.

## Passwords
- Hashed with **argon2id** (argon2-cffi defaults: 64 MiB memory, 3 iterations, 4 lanes). Plain passwords are never stored or logged.
- **No account enumeration:** a wrong password and an unknown email return the same 401 `INVALID_CREDENTIALS`. Both take the same time, because an unknown email is still checked against a dummy hash.
- **Minimum length:** 8 characters for accounts created by the admin.
- **Seed accounts:** they all share the password `Mawjood-Demo-2026`. These are fictional demo accounts; never reuse that password anywhere.

## Tokens

| Token | Lifetime | Where it lives | How it is sent |
|---|---|---|---|
| Access (JWT, HS256) | 15 minutes | Client memory only | `Authorization: Bearer …` |
| Refresh (JWT, HS256), **native app** | 7 days | `expo-secure-store` (Android Keystore / iOS Keychain) | JSON body of `POST /auth/refresh` |
| Refresh (JWT, HS256), **web build** | 7 days | `httpOnly`, `SameSite=Strict` cookie, path `/api/v1/auth` | Sent by the browser automatically |

How the tokens behave:
- **What a token contains:** user id, role, type (`access` or `refresh`) and expiry.
  - A refresh token is refused where an access token is expected, and the reverse.
  - Expiry is checked against the application clock, so tests can prove the exact 15-minute and 7-day boundaries.
- **Refreshing:**
  - each refresh returns a new pair;
  - a refresh is refused once an account is deactivated;
  - every request re-reads the user, so a deactivated account loses access within one request.
- **Logging out:**
  - the native app deletes its stored token;
  - the web build calls `POST /auth/logout`, which clears the cookie.
  - Tokens are stateless, so a stolen refresh token stays valid until it expires. This is accepted for the MVP. A server-side token list would add revocation and is noted as possible future work.
- **The signing key:** `JWT_SECRET` (at least 32 characters) lives only in `.env`, which git ignores; `.env.example` holds a placeholder.

## CSRF (cross-site request forgery)
- **The risk exists only on the web build,** because only there does the browser attach a credential (the refresh cookie) by itself.
- **Every other API call is safe:** it needs the `Authorization` header, which another site cannot make the browser add.
- **The cookie is only sent with requests from our own site** (`SameSite=Strict`), and only to `/api/v1/auth/*` (its path).
- **Requests that rely on the cookie** (`/auth/refresh` and `/auth/logout`) must also send `X-Requested-With: mawjood`. Without it the API returns 403 `CSRF_CHECK_FAILED`.
  - A cross-site HTML form cannot set custom headers.
  - A cross-site script would need a CORS preflight, which the API refuses for origins outside `CORS_ORIGINS`.
- **The native app sends no cookies,** so CSRF does not apply there.

## CORS
- **Allowed origins:** only those in `CORS_ORIGINS`. The default is the Expo web dev server, `http://localhost:8081`.
- **Credentials** are allowed only for those origins (for the refresh cookie).
- **The native app** is not a browser and is unaffected by CORS.

## Rate limiting
- **Login:** 5 attempts per minute for each combination of client address and email, then 429 `RATE_LIMITED` with a `Retry-After` header.
- **Sign-up:** 5 accounts per minute for each client address (`SIGNUPS_PER_MINUTE`), then 429 `RATE_LIMITED`.
- **Sending messages:** 20 per minute for each user (`MESSAGES_PER_MINUTE`), then 429 `RATE_LIMITED`.
- **Limitation:** the limiter is in memory, so it resets on restart and covers one server process. That is enough for a single-server MVP.

## Authorization
- **Roles** (student, professor, admin) come from the account, never from the request, and are checked on every endpoint.
- **Ownership:**
  - professors can change only their own status, schedule, settings and appointments;
  - students can see and cancel only their own appointments.
  - An appointment that belongs to someone else returns 404, not 403, so its existence is not revealed.

## Data access and errors
- **Queries:** all of them go through SQLAlchemy with bound parameters; no SQL is built from user input.
  - The only interpolated identifiers are database names in `scripts/`, and those are checked against `^[A-Za-z0-9_]{1,64}$`.
- **Errors:** every error uses `{"error": {"code", "message"}}`. Database rejections are translated into specific codes, for example:
  - `SLOT_TAKEN`;
  - `IN_USE`;
  - `CONFLICT`.
  - Unexpected errors return a generic 500 message; details go to the server log only, never to the client.
- **Privacy:**
  - nothing logs tokens, passwords or request bodies;
  - seed data is fictional (`university.example` is a reserved domain).

## Sign-up (after P6)

- **Who:** students and professors create their own accounts; admins never come from sign-up. The role is part of the request, but the request cannot pick `admin`, and the API refuses it.
- **Only the university domain:** the address must end with `@` + `SIGNUP_EMAIL_DOMAIN` (default `upm.edu.sa`). There is no email verification (email is out of scope, CLAUDE.md Section 3), so the domain rule is the only proof of membership. Look-alikes such as `x@evil.upm.edu.sa` or `x@upm.edu.sa.evil.com` are refused.
- **Students' addresses are their university number** (`4510440@upm.edu.sa`). The number is read from the address, so a student cannot claim a different number. Professors may use a name.
- **Seed accounts** stay on the reserved demo domain `university.example`, because seed data must be fictional (CLAUDE.md Section 8). They can sign in but are not created through sign-up.
- **Students** are active at once and receive tokens exactly as at sign-in (refresh token in the body for the phone, httpOnly cookie for the web build).
- **Professors** are created inactive and receive no tokens (HTTP 202). They cannot sign in, and students do not see them, until an admin sets the account active. So nobody can make themselves a professor and approve bookings or read chats.
- **Passwords:** at least 8 characters, hashed with argon2id like every other account.
- **Errors:** a taken email (409 `EMAIL_TAKEN`) does reveal that an account exists. That is accepted: the address is a university directory entry, and sign-up is rate-limited.

## Chat (P5)

- **Who may chat:** only the student and the professor of a conversation; anyone else gets 404. Eligibility (a non-declined appointment, or the professor accepts messages from everyone) is checked when the conversation opens and again on every message, so a later decline closes the chat.
- **Admins** cannot read conversations (403).
- **Message bodies** are plain text, 1-1000 characters, stored as given and rendered as text (never as HTML).

## Data kept on the phone (P3c, P5)

- **Refresh token:** expo-secure-store only (Keychain on iOS, Keystore-backed storage on Android). The web build never sees it (httpOnly cookie).
- **Access token:** memory only; it is never written to storage.
- **Public profile** (name, role, email, department) in AsyncStorage under `mawjood.user`, so the app can open signed in while offline. It holds no secret.
- **Last known API data** (pins, department list, appointments, conversations and their messages, notifications) in AsyncStorage under `mawjood.cache` for at most 24 hours, so statuses stay readable offline. Search results are not kept.
- **Sign-out** deletes the refresh token, the profile and the cached data. A refresh token the server rejects does the same.
- **Settings** (language, theme, text size, which notifications to show) in AsyncStorage; they are not personal data and stay after sign-out.
