/**
 * The additions from the site review (2026-11-16): help and contact, the search list before
 * anything is typed, booking from a booking time, booking again from a past appointment, the
 * professor's one-tap confirmation of a stale status, and the desktop skip button.
 * Same setup as the other specs: seeded database, API with DEMO_NOW=2026-10-05T07:00:00Z.
 * The confirmation changes a status the other specs read, so the database is reseeded after.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { PYTHON } from './python';

const DEMO_NOW = new Date('2026-10-05T07:00:00Z');

async function open(page: Page, width = 360) {
  await page.setViewportSize({ width, height: 800 });
  await page.clock.install({ time: DEMO_NOW });
  await page.addInitScript(() => localStorage.setItem('mawjood.language', 'en'));
}

async function signIn(page: Page, email: string) {
  await page.goto('/sign-in');
  await page.getByLabel('University email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Mawjood-Demo-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

test.afterAll(() => {
  execFileSync(PYTHON, ['scripts/reset_db.py'], { cwd: path.resolve(__dirname, '../..') });
});

test('help and contact opens from sign-in without an account', async ({ page }) => {
  await open(page);
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Help and contact' }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page).toHaveTitle('Help and contact | Mawjood');
  await expect(page.getByRole('heading', { name: 'Common questions' })).toBeVisible();
  await expect(page.getByText('I forgot my password.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Contact', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('search lists every professor before anything is typed', async ({ page }) => {
  await open(page);
  await signIn(page, 's.almutairi@university.example');
  await page.goto('/search');
  await expect(page.getByText('All professors, in office first')).toBeVisible();
  // Professors of other departments too, not only the student's own (earlier specs may have
  // added an account, so the exact number is not checked).
  for (const name of ['Dr. Noura Al-Harbi', 'Prof. Khalid Al-Otaibi', 'Dr. Huda Al-Qahtani']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name},`) })).toBeVisible();
  }
});

test('a booking time opens the sheet on its day, and a past appointment books again', async ({
  page,
}) => {
  await open(page);
  await signIn(page, 's.almutairi@university.example');
  await page.goto('/professors/1');
  // Dr. Noura's last booking time is on Tuesdays; the demo day is Monday 5 October.
  await page.getByRole('button', { name: /^Book on Tuesday, 10:00 AM–11:30 AM/ }).click();
  const sheet = page.getByRole('dialog', { name: /^Book with Dr\. Noura/ });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('radio', { name: 'Tuesday 6 October', exact: true })).toBeChecked();
  await page.keyboard.press('Escape');

  await page.goto('/appointments');
  await page.getByText('Past', { exact: true }).click();
  await page.getByRole('button', { name: 'Book again with Dr. Noura Al-Harbi' }).click();
  await expect(page).toHaveURL(/\/professors\/1\?book=1$/);
  await expect(page.getByRole('dialog', { name: /^Book with Dr\. Noura/ })).toBeVisible();
});

test('a professor confirms a stale status in one tap', async ({ page }) => {
  await open(page);
  await signIn(page, 'k.alotaibi@university.example');
  await expect(page.getByText('In office (not confirmed)')).toBeVisible();
  await page.getByRole('button', { name: "I'm in my office" }).click();
  await expect(page.getByText(/^Set by you, updated just now/)).toBeVisible();
  await expect(page.getByRole('button', { name: "I'm in my office" })).toHaveCount(0);
  await expect(page.getByText('In office (not confirmed)')).toHaveCount(0);
});

test('on desktop the first Tab stop skips to the content', async ({ page }) => {
  await open(page, 1280);
  await signIn(page, 's.almutairi@university.example');
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Good morning, Saad/ })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /^Good morning, Saad/ })).toBeFocused();
});
