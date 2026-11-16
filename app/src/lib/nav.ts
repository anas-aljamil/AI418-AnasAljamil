/**
 * Small rules about addresses: where a signed-out visitor is sent and brought back to, and
 * what the browser tab is called on each screen.
 */

// A sign-out or an expired session in this visit: the next sign-in opens the role's home,
// not the screen that was left.
let signedInBefore = false;

/** Called once a session exists, so later sign-outs do not remember where they happened. */
export function markSignedIn(): void {
  signedInBefore = true;
}

/** For tests. */
export function resetNavMemory(): void {
  signedInBefore = false;
}

/**
 * A path inside the app that sign-in may lead back to: it starts with one slash and is not
 * an entry screen. Anything else (another site, "//host", a backslash) is refused.
 */
export function safeNext(next: unknown): string | null {
  if (typeof next !== 'string' || !/^\/[^/\\]/.test(next) || next.includes('\\')) return null;
  if (/^\/(sign-in|sign-up)(\/|\?|$)/.test(next)) return null;
  return next;
}

/**
 * Where to send a visitor who is not signed in. Someone who opened a link to a screen is
 * brought back to it after signing in (`next`).
 */
export function signInHref(pathname: string): string {
  const next = signedInBefore ? null : safeNext(pathname);
  return next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in';
}

const TITLES: [RegExp, string][] = [
  [/^\/sign-in$/, 'signin.title'],
  [/^\/sign-up$/, 'signup.title'],
  [/^\/home$/, 'tabs.home'],
  [/^\/search$/, 'tabs.search'],
  [/^\/appointments$/, 'tabs.appointments'],
  [/^\/(staff\/)?messages$/, 'tabs.messages'],
  [/^\/profile$/, 'tabs.profile'],
  [/^\/staff\/requests$/, 'tabs.requests'],
  [/^\/staff\/schedule$/, 'tabs.schedule'],
  [/^\/(staff|admin)\/account$/, 'tabs.account'],
  [/^\/admin\/overview$/, 'tabs.overview'],
  [/^\/admin\/campus$/, 'tabs.campus'],
  [/^\/admin\/professors$/, 'tabs.professors'],
  [/^\/admin\/students$/, 'tabs.students'],
  [/^\/notifications$/, 'notifications.title'],
  [/^\/professors\/\d+$/, 'titles.professor'],
  [/^\/conversations\/\d+$/, 'titles.conversation'],
  [/^\/help$/, 'help.title'],
  [/^\/styleguide$/, 'styleguide.title'],
];

/**
 * The i18n key of a screen's name for the browser tab; null for the start route (which only
 * redirects) and for My status, which writes the live status there itself; the not-found
 * title for an address the app does not have.
 */
export function pageTitleKey(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/staff/status') return null;
  return TITLES.find(([pattern]) => pattern.test(path))?.[1] ?? 'not_found.title';
}

/** "(2) Appointments | Mawjood": the unread count leads, so it shows in a narrow tab. */
export function pageTitle(screen: string | null, app: string, unread: number): string {
  const count = unread > 0 ? `(${unread > 9 ? '9+' : unread}) ` : '';
  return `${count}${screen ? `${screen} | ` : ''}${app}`;
}
