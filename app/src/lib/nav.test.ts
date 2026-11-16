import { markSignedIn, pageTitle, pageTitleKey, resetNavMemory, safeNext, signInHref } from './nav';

beforeEach(() => resetNavMemory());

describe('safeNext', () => {
  it.each(['/professors/2', '/conversations/1', '/notifications', '/appointments?move=3'])(
    'keeps %s',
    (path) => expect(safeNext(path)).toBe(path),
  );
  it.each([
    'https://example.com',
    '//example.com',
    '/\\example.com',
    'professors/2',
    '/',
    '/sign-in',
    '/sign-up',
    '/sign-in?next=/home',
    undefined,
    ['/home'],
  ])('refuses %s', (value) => expect(safeNext(value)).toBeNull());
});

describe('signInHref', () => {
  it('remembers the screen a signed-out visitor asked for', () => {
    expect(signInHref('/professors/2')).toBe('/sign-in?next=%2Fprofessors%2F2');
    expect(signInHref('/')).toBe('/sign-in');
  });

  it('forgets it after a sign-out in the same visit', () => {
    markSignedIn();
    expect(signInHref('/profile')).toBe('/sign-in');
  });
});

describe('pageTitleKey', () => {
  it.each([
    ['/home', 'tabs.home'],
    ['/staff/messages', 'tabs.messages'],
    ['/admin/account', 'tabs.account'],
    ['/professors/12', 'titles.professor'],
    ['/conversations/3/', 'titles.conversation'],
    ['/no-such-page', 'not_found.title'],
  ])('names %s', (path, key) => expect(pageTitleKey(path)).toBe(key));

  it('leaves the start route and My status alone', () => {
    expect(pageTitleKey('/')).toBeNull();
    expect(pageTitleKey('/staff/status')).toBeNull();
  });
});

describe('pageTitle', () => {
  it('puts the unread count first and caps it', () => {
    expect(pageTitle('Search', 'Mawjood', 0)).toBe('Search | Mawjood');
    expect(pageTitle('Search', 'Mawjood', 2)).toBe('(2) Search | Mawjood');
    expect(pageTitle(null, 'Mawjood', 12)).toBe('(9+) Mawjood');
  });
});
