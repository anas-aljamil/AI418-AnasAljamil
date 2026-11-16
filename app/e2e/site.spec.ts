/**
 * The additions from the site review (2026-11-16): help and contact, the search list before
 * anything is typed, booking from a booking time, booking again from a past appointment, the
 * professor's one-tap confirmation of a stale status, and the desktop skip button (S2); the
 * week on a profile, a student's own year, the admin's reports and changing a password (S3).
 * Same setup as the other specs: seeded database, API with DEMO_NOW=2026-10-05T07:00:00Z.
 * Several tests change rows the other specs read, so the database is reseeded after the file.
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

const reseed = () =>
  execFileSync(PYTHON, ['scripts/reset_db.py'], { cwd: path.resolve(__dirname, '../..') });
// From the seed at the start too: earlier specs set statuses (p4 makes Prof. Khalid busy), and
// the stale-status test needs his seeded "in office, not confirmed".
test.beforeAll(reseed);
test.afterAll(reseed);

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

test("a professor's profile shows the working week", async ({ page }) => {
  await open(page);
  await signIn(page, 's.almutairi@university.example');
  await page.goto('/professors/2');
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  // One ribbon per working day, each read as one sentence; the demo day is Monday.
  await expect(
    page.getByRole('img', {
      name: /^Monday, 9:00 AM–11:00 AM, Office hours, 11:00 AM–12:30 PM, Class, Now 10:00 AM$/,
    }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'Sunday: no office hours or classes' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^Thursday/ })).toBeVisible();
});

test('a student changes their study year', async ({ page }) => {
  await open(page);
  await signIn(page, 's.almutairi@university.example');
  await page.goto('/profile');
  await expect(page.getByText('Software Engineering, year 3')).toBeVisible();
  await page.getByRole('button', { name: 'Change year or department' }).click();
  const sheet = page.getByRole('dialog', { name: 'My study details' });
  await sheet.getByRole('button', { name: '4', exact: true }).click();
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await expect(page.getByText('Software Engineering, year 4')).toBeVisible();
});

test('the admin overview reports appointments per professor and per hour', async ({ page }) => {
  await open(page, 1280);
  await signIn(page, 'admin@university.example');
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  await expect(
    page.getByLabel(/^Dr\. Noura Al-Harbi, \d+ appointments?, completed: \d+/),
  ).toBeVisible();
  await expect(page.getByLabel(/^10 AM, \d+ appointments?$/)).toBeVisible();
});

test('a message from Help and contact reaches the admin, who marks it handled', async ({
  page,
}) => {
  await open(page);
  await page.goto('/help');
  await page.getByLabel('Your name').fill('Rakan Al-Juhani');
  await page.getByLabel('Your email').fill('r.aljuhani@university.example');
  await page.getByLabel('Message').fill('The site test wrote this message.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(
    page.getByText('The administrator will answer at r.aljuhani@university.example.'),
  ).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, 'admin@university.example');
  await expect(page.getByText('The site test wrote this message.')).toBeVisible();
  await page
    .getByRole('button', { name: 'Mark the message from Rakan Al-Juhani as handled' })
    .last()
    .click();
  await expect(page.getByText('Marked as handled')).toBeVisible();
  await expect(page.getByText('The site test wrote this message.')).toHaveCount(0);
});

test('a professor declines with a reason, and the student reads it', async ({ browser }) => {
  const professor = await browser.newPage();
  await open(professor);
  await signIn(professor, 'o.binsalem@university.example');
  await professor.goto('/staff/requests');
  await professor.getByRole('button', { name: /^Decline: Yousef Al-Ghamdi/ }).click();
  await professor.getByLabel('Reason (optional)').fill('On leave that week.');
  await professor.getByRole('dialog').getByRole('button', { name: 'Decline', exact: true }).click();
  await expect(professor.getByText(/^Declined: Yousef Al-Ghamdi/)).toBeVisible();
  await professor.close();

  const student = await browser.newPage();
  await open(student);
  await signIn(student, 'y.alghamdi@university.example');
  // It was for next Tuesday, so it stays under Upcoming (the tabs split by time), declined.
  await student.goto('/appointments');
  await expect(student.getByText('On leave that week.')).toBeVisible();
  await expect(student.getByText('Reason given')).toBeVisible();
  await student.close();
});

// Last in the file: it changes Saad's password (the database is reseeded after the file).
test('a student changes their password, and only the new one signs in', async ({ page }) => {
  await open(page);
  await signIn(page, 's.almutairi@university.example');
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Change password' }).click();
  const sheet = page.getByRole('dialog', { name: 'Change password' });
  await sheet.getByLabel('Current password').fill('not-the-password');
  await sheet.getByLabel('New password (at least 8 characters)').fill('New-pass-2026');
  await sheet.getByRole('button', { name: 'Save the new password' }).click();
  await expect(sheet.getByText('The current password is incorrect.')).toBeVisible();
  await sheet.getByLabel('Current password').fill('Mawjood-Demo-2026');
  await sheet.getByRole('button', { name: 'Save the new password' }).click();
  await expect(page.getByText('Password changed')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel('University email').fill('s.almutairi@university.example');
  await page.getByLabel('Password', { exact: true }).fill('Mawjood-Demo-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('The email or password is incorrect.')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('New-pass-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
});
