/**
 * Everyday flows not covered elsewhere, end to end on the web build and checked in MySQL:
 * status presets, note and back to the schedule; editing and deleting a schedule block;
 * declining a request and what the student then sees; cancelling; mark all as read; switching
 * the language from the profile. Same setup as the other specs (seeded database, DEMO_NOW);
 * the seed is loaded again afterwards.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';

const DEMO_NOW = new Date('2026-10-05T07:00:00Z'); // Monday 10:00 AM in Riyadh
const POLL_MS = 20_000;

function sql(query: string): string {
  return execFileSync(
    'python3',
    [
      '-c',
      'import sys, mysql_cli as m; c = m.load_config(); print(m.scalar(sys.argv[1], c, c.database))',
      query,
    ],
    { cwd: path.resolve(__dirname, '../../scripts'), encoding: 'utf8' },
  ).trim();
}

async function open(browser: Browser, email: string, language: 'ar' | 'en' = 'en'): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  await page.clock.install({ time: DEMO_NOW });
  await page.addInitScript((lng) => localStorage.setItem('mawjood.language', lng), language);
  await page.goto('/sign-in');
  await page.getByLabel('University email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Mawjood-Demo-2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
  return page;
}

// These flows change rows the later specs read (statuses, Saad's appointments, Noura's
// schedule), so the seed is loaded again when they are done.
test.afterAll(() => {
  execFileSync('python3', ['scripts/reset_db.py'], { cwd: path.resolve(__dirname, '../..') });
});

const latestOverride = (professorId: number) =>
  sql(
    `SELECT CONCAT(status, '/', COALESCE(note, '-'), '/', COALESCE(expires_at, '-')) FROM status_overrides ` +
      `WHERE professor_id = ${professorId} ORDER BY override_id DESC LIMIT 1`,
  );

test('status presets, a note, and back to the schedule', async ({ browser }) => {
  const noura = await open(browser, 'n.alharbi@university.example');
  await expect(noura).toHaveURL(/\/staff\/status$/);

  await noura.getByRole('button', { name: 'Back in 15 min', exact: true }).click();
  await expect(noura.getByText(/until 10:15 AM/)).toBeVisible();
  expect(latestOverride(1)).toBe('away/-/2026-10-05 07:15:00');

  await noura.getByLabel('Note for students').fill('In the lab, back soon');
  await noura.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(noura.getByText('Note saved', { exact: true })).toBeVisible();
  expect(latestOverride(1)).toBe('away/In the lab, back soon/2026-10-05 07:15:00');

  await noura.getByRole('button', { name: 'Away for today', exact: true }).click();
  await expect(noura.getByText(/for the rest of today/)).toBeVisible();

  await noura.getByRole('button', { name: 'Follow my schedule', exact: true }).click();
  await expect(noura.getByText(/^Following your schedule/)).toBeVisible();
  // Nothing set by hand is left: no override counts, and the note field is empty again.
  await expect(noura.getByLabel('Note for students')).toHaveValue('');
  expect(
    sql(
      `SELECT COUNT(*) FROM status_overrides WHERE professor_id = 1 AND created_at <= '2026-10-05 07:00:00' ` +
        `AND COALESCE(expires_at, '2026-10-05 21:00:00') > '2026-10-05 07:00:00'`,
    ),
  ).toBe('0');

  // A professor in office hours gets "In office until" the end of the block (11:00 AM).
  const khalid = await open(browser, 'k.alotaibi@university.example');
  await khalid.getByRole('button', { name: 'In office until 11:00 AM', exact: true }).click();
  await expect(khalid.getByText(/until 11:00 AM/).first()).toBeVisible();
  expect(latestOverride(2)).toMatch(/^in_office\/.*\/2026-10-05 08:00:00$/);
});

test('a schedule block is edited with the time picker, and another deleted', async ({
  browser,
}) => {
  const noura = await open(browser, 'n.alharbi@university.example');
  await noura.getByRole('tab', { name: 'Schedule' }).click();
  await noura.getByRole('button', { name: '10:00 AM–12:00 PM Office hours', exact: true }).click();
  const sheet = noura.getByRole('dialog', { name: 'Edit block' });
  await sheet.getByRole('button', { name: 'End, hour 11', exact: true }).click();
  await sheet.getByRole('button', { name: 'End, 30 minutes', exact: true }).click();
  // The hour keeps its half of the day (12 PM -> 11 PM), so morning is chosen too.
  await sheet.getByRole('button', { name: 'End, AM', exact: true }).click();
  await expect(sheet.getByText('11:30 AM', { exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Save block', exact: true }).click();
  await expect(noura.getByText('Schedule saved', { exact: true })).toBeVisible();
  expect(sql('SELECT end_time FROM schedule_blocks WHERE block_id = 2')).toBe('11:30:00');

  await noura.getByRole('button', { name: /^1:00 PM–2:30 PM Class/ }).click();
  await noura.getByRole('button', { name: 'Delete block', exact: true }).click();
  await noura
    .getByRole('dialog', { name: 'Delete this block?' })
    .getByRole('button', { name: 'Delete block' })
    .click();
  await expect(noura.getByText('Block deleted', { exact: true })).toBeVisible();
  expect(sql('SELECT COUNT(*) FROM schedule_blocks WHERE block_id = 3')).toBe('0');
});

test('a declined request reaches the student, who cancels the other one and reads all', async ({
  browser,
}) => {
  const noura = await open(browser, 'n.alharbi@university.example');
  await noura.getByRole('tab', { name: 'Requests' }).click();
  await noura.getByRole('button', { name: /^Decline: Saad Al-Mutairi, / }).click();
  await expect(noura.getByText(/^Declined: Saad Al-Mutairi, /)).toBeVisible();
  expect(sql('SELECT status FROM appointments WHERE appointment_id = 7')).toBe('declined');

  const saad = await open(browser, 's.almutairi@university.example');
  await saad.getByRole('tab', { name: 'Appointments' }).click();
  await expect(saad.getByText('Declined', { exact: true }).first()).toBeVisible();

  // Cancel the approved appointment (more than 1 hour away).
  await saad.getByRole('button', { name: 'Cancel appointment', exact: true }).first().click();
  await saad
    .getByRole('dialog', { name: 'Cancel this appointment?' })
    .getByRole('button', { name: 'Cancel appointment' })
    .click();
  await expect(saad.getByText('Appointment cancelled', { exact: true })).toBeVisible();
  expect(sql('SELECT status FROM appointments WHERE appointment_id = 6')).toBe('cancelled');

  await saad.getByRole('tab', { name: 'Home' }).click();
  await saad.clock.runFor(POLL_MS + 1000);
  await saad.getByRole('button', { name: /^Notifications/ }).click();
  await expect(saad.getByText(/^Dr\. Noura Al-Harbi declined your request for /)).toBeVisible();
  await saad.getByRole('button', { name: 'Mark all as read', exact: true }).click();
  await expect(saad.getByText('New', { exact: true })).toHaveCount(0);
  expect(sql('SELECT COUNT(*) FROM notifications WHERE user_id = 9 AND read_at IS NULL')).toBe('0');
});

test('switching to Arabic from the profile turns the layout right to left', async ({ browser }) => {
  const page = await open(browser, 'l.alshehri@university.example');
  await page.getByRole('tab', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'العربية', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('tab', { name: 'حسابي' })).toBeVisible();
  // The root view takes the direction too (rows and reading order follow it).
  const direction = await page.evaluate(
    () => getComputedStyle(document.querySelector('[role="tablist"]')!).direction,
  );
  expect(direction).toBe('rtl');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});
