/**
 * P3c on the web build against the real API and MySQL seed (docs/plan.md, P3c).
 * Expects the API started with DEMO_NOW=2026-10-05T07:00:00Z (Monday 10:00 in Riyadh) and a
 * freshly seeded database; the browser clock is set to the same moment so "updated X ago"
 * matches. Seed accounts use the password Mawjood-Demo-2026 (fictional demo data).
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const SHOTS = path.resolve(__dirname, '../../docs/screenshots/p3c');
const DEMO_NOW = new Date('2026-10-05T07:00:00Z');
const PASSWORD = 'Mawjood-Demo-2026';
const SAAD = 's.almutairi@university.example';

const strings = {
  ar: {
    continue: 'متابعة',
    email: 'البريد الجامعي',
    password: 'كلمة المرور',
    signIn: 'تسجيل الدخول',
    greeting: 'صباح الخير يا سعد',
    khalid: /^أ\.د\. خالد العتيبي، في المكتب \(غير مؤكد\)/,
  },
  en: {
    continue: 'Continue',
    email: 'University email',
    password: 'Password',
    signIn: 'Sign in',
    greeting: 'Good morning, Saad',
    khalid: /^Prof\. Khalid Al-Otaibi, In office \(not confirmed\)/,
  },
} as const;

async function start(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.clock.install({ time: DEMO_NOW });
  await page.addInitScript((th) => localStorage.setItem('mawjood.theme', th), theme);
}

async function signIn(page: Page, language: 'ar' | 'en', email = SAAD, password = PASSWORD) {
  const s = strings[language];
  await page.getByLabel(s.email).fill(email);
  await page.getByLabel(s.password).fill(password);
  await page.getByRole('button', { name: s.signIn }).click();
}

/** Full-length screenshot: the app scrolls inside its own container, so grow the viewport. */
async function shoot(page: Page, name: string) {
  const height = await page.evaluate(() =>
    Math.max(
      800,
      ...[...document.querySelectorAll('*')].map((el) =>
        ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) ? el.scrollHeight + 120 : 0,
      ),
    ),
  );
  await page.setViewportSize({ width: 360, height: Math.min(height, 4000) });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  await page.setViewportSize({ width: 360, height: 800 });
}

for (const [language, theme] of [
  ['ar', 'light'],
  ['en', 'dark'],
] as const) {
  test(`first launch in ${language}-${theme}: language, sign-in, home`, async ({ page }) => {
    const s = strings[language];
    await start(page, theme);
    await page.goto('/');
    await expect(page).toHaveURL(/\/language$/);
    await page.getByRole('radio', { name: language === 'ar' ? 'العربية' : 'English' }).click();
    await shoot(page, `${language}-${theme}-1-language`);
    await page.getByRole('button', { name: s.continue }).click();

    await expect(page).toHaveURL(/\/sign-in$/);
    expect(await page.evaluate(() => document.documentElement.dir)).toBe(
      language === 'ar' ? 'rtl' : 'ltr',
    );
    await shoot(page, `${language}-${theme}-2-sign-in`);
    await signIn(page, language);

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { name: s.greeting })).toBeVisible();
    await expect(page.getByLabel(s.khalid).first()).toBeVisible();
    await shoot(page, `${language}-${theme}-3-home`);
  });
}

test('"Is Dr. X in?" is answered within 3 s of opening the app, with no taps', async ({ page }) => {
  await start(page);
  await page.addInitScript(() => localStorage.setItem('mawjood.language', 'en'));
  await page.goto('/sign-in');
  await signIn(page, 'en');
  await expect(page).toHaveURL(/\/home$/);

  // Open the app again as a returning student: the saved session goes straight to Home.
  const opened = Date.now();
  await page.goto('/');
  await expect(page.getByLabel(strings.en.khalid).first()).toBeVisible({ timeout: 3000 });
  const elapsed = Date.now() - opened;
  console.log(`Pinned professor's status visible ${elapsed} ms after opening, 0 taps`);
  expect(elapsed).toBeLessThan(3000);

  // Still signed in after a reload (web refresh cookie).
  await page.reload();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: strings.en.greeting })).toBeVisible();

  // Server unreachable: the last known statuses stay, with a notice and their time.
  await page.route('**/api/v1/**', (route) => route.abort());
  const notice = page.getByText(/Can't reach the server\. These statuses are from \d\d:\d\d\./);
  // Move the clock past the next poll and its retries until the notice shows.
  await expect(async () => {
    await page.clock.runFor(5_000);
    await expect(notice).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByLabel(strings.en.khalid).first()).toBeVisible();
  await shoot(page, 'en-light-4-unreachable');
});

test('signing out returns to sign-in and stays signed out after a reload', async ({ page }) => {
  await start(page);
  await page.addInitScript(() => localStorage.setItem('mawjood.language', 'en'));
  await page.goto('/sign-in');
  await signIn(page, 'en');
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole('tab', { name: 'Profile' }).click();
  await shoot(page, 'en-light-5-profile');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.reload();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('a wrong password says what happened', async ({ page }) => {
  await start(page);
  await page.addInitScript(() => localStorage.setItem('mawjood.language', 'en'));
  await page.goto('/sign-in');
  await signIn(page, 'en', 'l.alshehri@university.example', 'not-the-password');
  await expect(page.getByText('The email or password is incorrect.')).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('a professor account lands on the notice until the professor screens arrive', async ({
  page,
}) => {
  await start(page);
  await page.addInitScript(() => localStorage.setItem('mawjood.language', 'ar'));
  await page.goto('/sign-in');
  await signIn(page, 'ar', 'n.alharbi@university.example');
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByText('شاشاتك قادمة قريبًا')).toBeVisible();
});
