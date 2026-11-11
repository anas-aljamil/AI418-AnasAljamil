/**
 * Desktop and tablet layouts (docs/desktop-plan.md): every tab of every role at 1280 and 768 px,
 * in Arabic light and English dark, with nothing sticking out sideways; the two-pane screens keep
 * their selection in the URL across a reload; the booking dialog is centred, reachable with the
 * keyboard and closes with Escape. Same setup as the other specs: seeded database, API with
 * DEMO_NOW=2026-10-05T07:00:00Z, browser clock at that moment. Changes no data.
 */
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { navTab } from './nav';

const SHOTS = path.resolve(__dirname, '../../docs/screenshots/desktop');
const DEMO_NOW = new Date('2026-10-05T07:00:00Z');
const PASSWORD = 'Mawjood-Demo-2026';

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

async function signIn(
  page: Page,
  email: string,
  width: number,
  language: 'ar' | 'en' = 'en',
  theme: 'light' | 'dark' = 'dark',
) {
  await page.setViewportSize({ width, height: 800 });
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

/** Screenshot once the screen has drawn (a frame after the last request settles). */
async function shoot(page: Page, name: string) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

for (const width of [1280, 768]) {
  for (const [language, theme] of [
    ['ar', 'light'],
    ['en', 'dark'],
  ] as const) {
    for (const [role, { email, tabs }] of Object.entries(ROLES)) {
      test(`${role} at ${width} px, ${language}-${theme}: every tab fits`, async ({ page }) => {
        await signIn(page, email, width, language, theme);
        const problems: string[] = [];
        for (const [index, tab] of tabs[language].entries()) {
          await navTab(page, tab).click();
          await page.waitForLoadState('networkidle');
          problems.push(...(await overflowing(page)).map((p) => `${tab}: ${p}`));
          await shoot(page, `${width}-${language}-${theme}-${role}-${index + 1}`);
        }
        expect(problems).toEqual([]);
      });
    }
  }
}

test('the side rail replaces the bottom tabs from 1024 px only', async ({ page }) => {
  await signIn(page, ROLES.student.email, 1280);
  const home = navTab(page, 'Home');
  const railBox = await home.boundingBox();
  // On the start side (left in English), not along the bottom.
  expect(railBox!.x).toBeLessThan(240);
  expect(railBox!.y).toBeLessThan(400);
  await page.setViewportSize({ width: 1023, height: 800 });
  await expect.poll(async () => (await home.boundingBox())!.y).toBeGreaterThan(700); // back to the bottom bar
});

test('Search opens the profile beside the results and keeps it after a reload', async ({
  page,
}) => {
  await signIn(page, ROLES.student.email, 1280);
  await navTab(page, 'Search').click();
  await expect(page.getByText(/^Choose a professor/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Search professors' }).fill('Noura');
  await page.getByRole('button', { name: /^Dr\. Noura Al-Harbi/ }).click();
  await expect(page).toHaveURL(/\/search\?id=1$/);
  // The list stays; the profile is beside it, with its actions under the nameplate.
  await expect(page.getByRole('textbox', { name: 'Search professors' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Dr\. Noura Al-Harbi/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await shoot(page, '1280-en-dark-search-pane');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Book', exact: true })).toBeVisible();
});

test('booking opens as a centred dialog, keyboard-reachable, and Escape closes it', async ({
  page,
}) => {
  await signIn(page, ROLES.student.email, 1280);
  await page.goto('/search?id=1');
  const book = page.getByRole('button', { name: 'Book', exact: true });
  await book.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /^Book with/ });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(500); // let it finish fading in
  const box = (await dialog.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(640);
  expect(box.y).toBeGreaterThan(0); // floats in the middle, not along the bottom edge
  expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThan(4);
  await shoot(page, '1280-en-dark-booking-dialog');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Messages opens the thread beside the conversation list', async ({ page }) => {
  await signIn(page, ROLES.student.email, 1280);
  await navTab(page, 'Messages').click();
  await expect(page.getByText(/^Choose a conversation/)).toBeVisible();
  await page.getByRole('button', { name: /^Dr\. Noura Al-Harbi/ }).click();
  await expect(page).toHaveURL(/\/messages\?id=\d+$/);
  await expect(page.getByRole('heading', { name: 'Dr. Noura Al-Harbi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
  await shoot(page, '1280-en-dark-messages-pane');
});

test('admin rows open beside the list instead of a sheet', async ({ page }) => {
  await signIn(page, ROLES.admin.email, 1280);
  await navTab(page, 'Professors').click();
  await expect(page.getByText(/^Choose a row/)).toBeVisible();
  await page.getByRole('button', { name: /^Noura Al-Harbi/ }).click();
  await expect(page.getByRole('button', { name: 'Edit details' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await shoot(page, '1280-en-dark-admin-pane');
});

test('no sideways scrolling at 320, 768, 1024 and 1280 px', async ({ page }) => {
  await signIn(page, ROLES.student.email, 320);
  for (const width of [320, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const tab of ['Home', 'Search']) {
      await navTab(page, tab).click();
      await page.waitForLoadState('networkidle');
      expect(await overflowing(page), `${tab} at ${width} px`).toEqual([]);
      const scrolls = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(scrolls, `${tab} at ${width} px`).toBe(false);
    }
  }
});

test('the screens of other tabs cannot take keyboard focus', async ({ page }) => {
  await signIn(page, ROLES.student.email, 1280);
  await navTab(page, 'Search').click();
  await expect(page.getByRole('textbox', { name: 'Search professors' })).toHaveCount(1);
  // Home stays mounted behind Search; none of its controls may be reachable with Tab.
  const reachable = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '[aria-hidden="true"] input, [aria-hidden="true"] button',
      ),
    ]
      .filter((el) => el.tabIndex >= 0 && el.checkVisibility({ visibilityProperty: true }))
      .map((el) => el.getAttribute('aria-label') ?? el.textContent),
  );
  expect(reachable).toEqual([]);
});
