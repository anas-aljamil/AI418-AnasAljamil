/**
 * Every screen opens cleanly: for each role, in Arabic and English, visit every tab and the
 * main pushed screens and fail on any console error, uncaught exception or failed API request
 * (4xx/5xx). Catches the bugs that do not break a flow but show up as red in a console.
 * Same setup as the other specs: seeded database, API with DEMO_NOW=2026-10-05T07:00:00Z.
 */
import { expect, test, type Page } from '@playwright/test';

const DEMO_NOW = new Date('2026-10-05T07:00:00Z');

const ACCOUNTS = {
  student: 's.almutairi@university.example',
  professor: 'n.alharbi@university.example',
  admin: 'admin@university.example',
} as const;

const TABS = {
  student: {
    en: ['Home', 'Search', 'Appointments', 'Messages', 'Profile'],
    ar: ['الرئيسية', 'بحث', 'مواعيدي', 'الرسائل', 'حسابي'],
  },
  professor: {
    en: ['My status', 'Requests', 'Schedule', 'Messages', 'Account'],
    ar: ['حالتي', 'الطلبات', 'الجدول', 'الرسائل', 'حسابي'],
  },
  admin: {
    en: ['Overview', 'Campus', 'Professors', 'Students', 'Account'],
    ar: ['نظرة عامة', 'الجامعة', 'الأساتذة', 'الطلاب', 'حسابي'],
  },
} as const;

/** Collects everything that went wrong while the page was used. */
function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 200)}`);
  });
  page.on('pageerror', (error) => problems.push(`exception: ${error.message.slice(0, 200)}`));
  page.on('response', (response) => {
    const url = response.url();
    // The silent session check before sign-in may answer 401; everything else must succeed.
    if (!url.includes('/api/v1/') || url.endsWith('/auth/refresh')) return;
    if (response.status() >= 400)
      problems.push(`HTTP ${response.status()} ${url.split('/api/v1')[1]}`);
  });
  return problems;
}

async function signIn(page: Page, email: string, language: 'ar' | 'en') {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.clock.install({ time: DEMO_NOW });
  await page.addInitScript((lng) => localStorage.setItem('mawjood.language', lng), language);
  await page.goto('/sign-in');
  await page.getByLabel(language === 'ar' ? 'البريد الجامعي' : 'University email').fill(email);
  await page
    .getByLabel(language === 'ar' ? 'كلمة المرور' : 'Password', { exact: true })
    .fill('Mawjood-Demo-2026');
  await page
    .getByRole('button', { name: language === 'ar' ? 'تسجيل الدخول' : 'Sign in', exact: true })
    .click();
  await expect(page).not.toHaveURL(/sign-in/);
}

async function visitTabs(page: Page, tabs: readonly string[]) {
  for (const tab of tabs) {
    await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
    await page.waitForLoadState('networkidle');
  }
}

for (const language of ['en', 'ar'] as const) {
  test(`student screens open cleanly (${language})`, async ({ page }) => {
    const problems = watch(page);
    await signIn(page, ACCOUNTS.student, language);
    await visitTabs(page, TABS.student[language]);
    // A professor's profile, the booking sheet, notifications and a conversation.
    await page.getByRole('tab', { name: new RegExp(`^${TABS.student[language][0]}`) }).click();
    await page
      .getByRole('button', {
        name: language === 'ar' ? /^د\. نورة الحربي/ : /^Dr\. Noura Al-Harbi/,
      })
      .first()
      .click();
    await page.waitForLoadState('networkidle');
    await page
      .getByRole('button', { name: language === 'ar' ? 'احجز' : 'Book', exact: true })
      .click();
    await page.waitForLoadState('networkidle');
    await page.goBack();
    await page
      .getByRole('button', { name: language === 'ar' ? /^الإشعارات/ : /^Notifications/ })
      .first()
      .click();
    await page.waitForLoadState('networkidle');
    await page.goBack();
    await page.getByRole('tab', { name: new RegExp(`^${TABS.student[language][3]}`) }).click();
    await page
      .getByRole('button', {
        name: language === 'ar' ? /^د\. نورة الحربي/ : /^Dr\. Noura Al-Harbi/,
      })
      .first()
      .click();
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);
  });

  test(`professor screens open cleanly (${language})`, async ({ page }) => {
    const problems = watch(page);
    await signIn(page, ACCOUNTS.professor, language);
    await visitTabs(page, TABS.professor[language]);
    await page.getByRole('tab', { name: new RegExp(`^${TABS.professor[language][0]}`) }).click();
    await page
      .getByRole('button', { name: language === 'ar' ? /^الإشعارات/ : /^Notifications/ })
      .first()
      .click();
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);
  });

  test(`admin screens open cleanly (${language})`, async ({ page }) => {
    const problems = watch(page);
    await signIn(page, ACCOUNTS.admin, language);
    await visitTabs(page, TABS.admin[language]);
    // Every form opens (Campus, Professors, Students), and a professor's quick view.
    for (const tab of TABS.admin[language].slice(1, 4)) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      await page
        .getByRole('button', { name: language === 'ar' ? 'إضافة' : 'Add', exact: true })
        .click();
      await page.waitForLoadState('networkidle');
      await page
        .getByRole('button', { name: language === 'ar' ? 'إغلاق' : 'Close', exact: true })
        .last()
        .click();
    }
    await page.getByRole('tab', { name: new RegExp(`^${TABS.admin[language][2]}`) }).click();
    await page
      .getByRole('button', { name: language === 'ar' ? /^نورة الحربي/ : /^Noura Al-Harbi/ })
      .first()
      .click();
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);
  });
}

test('sign-up and language screens open cleanly', async ({ page }) => {
  const problems = watch(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/language');
  await page.waitForLoadState('networkidle');
  await page.goto('/sign-up');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /^Department, / }).click();
  await expect(page.getByRole('radio').first()).toBeVisible();
  expect(problems).toEqual([]);
});
