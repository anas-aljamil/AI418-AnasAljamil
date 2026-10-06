/**
 * Final design QA (docs/plan.md, P6): every tab of every role at 320 px, in Arabic with the light
 * theme and in English with the dark theme. Nothing may stick out of the screen sideways; content
 * inside a horizontal scroller (day strip, quick replies) is allowed to. Same setup as the other
 * specs: seeded database, API with DEMO_NOW=2026-10-05T07:00:00Z, browser clock at that moment.
 */
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const SHOTS = path.resolve(__dirname, '../../docs/screenshots/final');
const DEMO_NOW = new Date('2026-10-05T07:00:00Z');
const PASSWORD = 'Mawjood-Demo-2026';
const WIDTH = 320;

const ROLES = {
  student: {
    email: 's.almutairi@university.example',
    tabs: {
      en: ['Home', 'Search', 'Appointments', 'Messages', 'Profile'],
      ar: ['الرئيسية', 'بحث', 'مواعيدي', 'الرسائل', 'حسابي'],
    },
  },
  professor: {
    email: 'n.alharbi@university.example',
    tabs: {
      en: ['My status', 'Requests', 'Schedule', 'Messages', 'Account'],
      ar: ['حالتي', 'الطلبات', 'الجدول', 'الرسائل', 'حسابي'],
    },
  },
  admin: {
    email: 'admin@university.example',
    tabs: {
      en: ['Overview', 'Campus', 'Professors', 'Students', 'Account'],
      ar: ['نظرة عامة', 'الجامعة', 'الأساتذة', 'الطلاب', 'حسابي'],
    },
  },
} as const;

/** Visible elements that reach past either edge, outside horizontal scrollers. */
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const found: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || !el.checkVisibility()) continue;
      if (box.right <= width + 1 && box.left >= -1) continue;
      let parent = el.parentElement;
      let inScroller = false;
      while (parent && !inScroller) {
        inScroller = ['auto', 'scroll'].includes(getComputedStyle(parent).overflowX);
        parent = parent.parentElement;
      }
      if (!inScroller) {
        const label = el.getAttribute('aria-label') ?? el.textContent?.slice(0, 40) ?? el.tagName;
        found.push(`${label} [${Math.round(box.left)}, ${Math.round(box.right)}]`);
      }
    }
    return found;
  });
}

async function signIn(page: Page, email: string, language: 'ar' | 'en', theme: 'light' | 'dark') {
  await page.setViewportSize({ width: WIDTH, height: 720 });
  await page.clock.install({ time: DEMO_NOW });
  await page.addInitScript(
    ([lng, th]) => {
      localStorage.setItem('mawjood.language', lng);
      localStorage.setItem('mawjood.theme', th);
    },
    [language, theme],
  );
  await page.goto('/sign-in');
  await page.getByLabel(language === 'ar' ? 'البريد الجامعي' : 'University email').fill(email);
  await page.getByLabel(language === 'ar' ? 'كلمة المرور' : 'Password').fill(PASSWORD);
  await page.getByRole('button', { name: language === 'ar' ? 'تسجيل الدخول' : 'Sign in' }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

for (const [language, theme] of [
  ['ar', 'light'],
  ['en', 'dark'],
] as const) {
  for (const [role, { email, tabs }] of Object.entries(ROLES)) {
    test(`${role}, ${language}-${theme}: every tab fits 320 px`, async ({ page }) => {
      await signIn(page, email, language, theme);
      const problems: string[] = [];
      for (const [index, tab] of tabs[language].entries()) {
        await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
        // Let the screen's data arrive before measuring (skeletons are narrower than rows).
        await page.waitForLoadState('networkidle');
        problems.push(...(await overflowing(page)).map((p) => `${tab}: ${p}`));
        if (theme === 'dark') {
          await page.screenshot({ path: `${SHOTS}/${language}-${theme}-${role}-${index + 1}.png` });
        }
      }
      expect(problems).toEqual([]);
    });
  }
}

test('student pushed screens fit 320 px: profile and booking sheet', async ({ page }) => {
  await signIn(page, ROLES.student.email, 'ar', 'light');
  await page
    .getByRole('button', { name: /^د\. نورة الحربي/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/professors\/\d+$/);
  await page.waitForLoadState('networkidle');
  const problems = (await overflowing(page)).map((p) => `profile: ${p}`);
  await page.getByRole('button', { name: 'احجز', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /^احجز مع/ })).toBeVisible();
  await page.waitForTimeout(800); // the sheet slides up; measure it in place
  problems.push(...(await overflowing(page)).map((p) => `booking sheet: ${p}`));
  await page.screenshot({ path: `${SHOTS}/ar-light-student-booking-320.png` });
  expect(problems).toEqual([]);
});

test('professor pushed screens fit 320 px: notifications and a conversation', async ({ page }) => {
  await signIn(page, ROLES.professor.email, 'ar', 'light');
  await page.getByRole('button', { name: /^الإشعارات/ }).click();
  await page.waitForLoadState('networkidle');
  const problems = (await overflowing(page)).map((p) => `notifications: ${p}`);
  await page.goBack();
  await page.getByRole('tab', { name: /^الرسائل/ }).click();
  await page.getByRole('button', { name: /^سعد المطيري/ }).click();
  await expect(page).toHaveURL(/\/conversations\/\d+$/);
  await page.waitForLoadState('networkidle');
  problems.push(...(await overflowing(page)).map((p) => `conversation: ${p}`));
  await page.screenshot({ path: `${SHOTS}/ar-light-professor-thread-320.png` });
  expect(problems).toEqual([]);
});

test('the schedule time picker fits 320 px and reads on the 12-hour clock', async ({ page }) => {
  await signIn(page, ROLES.professor.email, 'en', 'light');
  await page.getByRole('tab', { name: 'Schedule' }).click();
  await expect(page.getByText(/^10:00 AM–12:00 PM Office hours/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add a block' }).click();
  const sheet = page.getByRole('dialog', { name: 'New block' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'End, PM', exact: true }).click();
  await sheet.getByRole('button', { name: 'End, hour 1', exact: true }).click();
  await sheet.getByRole('button', { name: 'End, 30 minutes', exact: true }).click();
  await expect(sheet.getByText('1:30 PM', { exact: true })).toBeVisible();
  await page.waitForTimeout(800); // the sheet slides up; measure it in place
  const problems = (await overflowing(page)).map((p) => `schedule sheet: ${p}`);
  await page.screenshot({ path: `${SHOTS}/en-light-professor-time-picker-320.png` });
  expect(problems).toEqual([]);
});
