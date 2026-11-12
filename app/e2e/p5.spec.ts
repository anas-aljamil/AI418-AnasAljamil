/**
 * P5 on the web build against the real API and MySQL (docs/plan.md, P5). Same setup as
 * p4.spec.ts: freshly seeded database, API with DEMO_NOW=2026-10-05T07:00:00Z, browser clock
 * at the same moment, one browser context per user.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';

import { painted } from './paint';

import { PYTHON } from './python';

const SHOTS = path.resolve(__dirname, '../../docs/screenshots/p5');
const DEMO_NOW = new Date('2026-10-05T07:00:00Z');
const PASSWORD = 'Mawjood-Demo-2026';
const THREAD_POLL_MS = 15_000;
const POLL_MS = 20_000;

/** One value from MySQL, through the project's own client wrapper (scripts/mysql_cli.py). */
function sql(query: string): string {
  return execFileSync(
    PYTHON,
    [
      '-c',
      'import sys, mysql_cli as m; c = m.load_config(); print(m.scalar(sys.argv[1], c, c.database))',
      query,
    ],
    { cwd: path.resolve(__dirname, '../../scripts'), encoding: 'utf8' },
  ).trim();
}

async function open(browser: Browser, email: string, language: 'ar' | 'en' = 'en') {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  await page.clock.install({ time: DEMO_NOW });
  await page.addInitScript((lng) => localStorage.setItem('mawjood.language', lng), language);
  await page.goto('/sign-in');
  const ar = language === 'ar';
  await page.getByLabel(ar ? 'البريد الجامعي' : 'University email').fill(email);
  await page.getByLabel(ar ? 'كلمة المرور' : 'Password').fill(PASSWORD);
  await page.getByRole('button', { name: ar ? 'تسجيل الدخول' : 'Sign in' }).click();
  await expect(page).not.toHaveURL(/sign-in/);
  return page;
}

/** Screens under a pushed screen stay mounted on the web build; match only what is shown. */
const shown = (page: Page, text: string | RegExp) =>
  page.getByText(text, { exact: typeof text === 'string' }).filter({ visible: true });

async function shoot(page: Page, name: string) {
  await painted(page);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

// Close the browser contexts this test opened: the browser is shared by every spec (one
// worker), so pages left open would keep polling the API and slow the later tests down.
test.afterEach(async ({ browser, context }) => {
  await Promise.all(
    browser
      .contexts()
      .filter((c) => c !== context)
      .map((c) => c.close()),
  );
});

test('a student writes, the professor gets the badge and replies in one tap', async ({
  browser,
}) => {
  const student = await open(browser, 's.almutairi@university.example');
  await student.getByRole('tab', { name: /^Messages/ }).click();
  const noura = student.getByRole('button', { name: /^Dr\. Noura Al-Harbi/ });
  await expect(noura).toBeVisible();
  await shoot(student, 'en-1-conversations');
  await noura.click();
  await expect(student).toHaveURL(/\/conversations\/1$/);
  await student
    .getByLabel('Message to Dr. Noura Al-Harbi')
    .fill('Shall I bring the slides as well?');
  await student.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(shown(student, 'Shall I bring the slides as well?')).toBeVisible();
  await expect(shown(student, /, Sent$/)).toBeVisible();
  expect(
    sql('SELECT body FROM messages WHERE conversation_id = 1 ORDER BY message_id DESC LIMIT 1'),
  ).toBe('Shall I bring the slides as well?');

  // The professor sees the unread message on the tab and under the bell.
  const professor = await open(browser, 'n.alharbi@university.example');
  await expect(professor.getByRole('tab', { name: 'Messages, 1 unread' })).toBeVisible();
  await professor.getByRole('button', { name: /^Notifications, \d+ new$/ }).click();
  await expect(shown(professor, 'New message from Saad Al-Mutairi')).toBeVisible();
  await shoot(professor, 'en-2-notifications');
  await professor.getByRole('button', { name: /New message from Saad Al-Mutairi/ }).click();
  await expect(professor).toHaveURL(/\/conversations\/1$/);
  await expect(shown(professor, 'Shall I bring the slides as well?')).toBeVisible();
  await professor.getByRole('button', { name: 'Come now', exact: true }).click(); // one tap
  await expect(shown(professor, /, Sent$/)).toBeVisible();
  await shoot(professor, 'en-3-thread-professor');
  expect(
    sql(
      "SELECT COUNT(*) FROM messages WHERE conversation_id = 1 AND sender_role = 'student' AND read_at IS NULL",
    ),
  ).toBe('0');

  // The student's open thread shows the reply and the read receipt within one poll.
  await student.clock.runFor(THREAD_POLL_MS + 1000);
  await expect(shown(student, 'Come now')).toBeVisible();
  await expect(shown(student, /, Read$/)).toBeVisible();
  await shoot(student, 'en-4-thread-student');
  expect(
    sql(
      'SELECT sender_role FROM messages WHERE conversation_id = 1 ORDER BY message_id DESC LIMIT 1',
    ),
  ).toBe('professor');
});

test('any student can write; closed hours stop students; settings change text size and hide message notifications', async ({
  browser,
}) => {
  // Yousef has no booking with Mr. Faisal and can still write (owner decision 2026-11-07).
  const student = await open(browser, 'y.alghamdi@university.example');
  await student.getByLabel('Search professors').first().fill('Faisal'); // Home shows results inline
  await student
    .getByRole('button', { name: /^Mr\. Faisal Al-Zahrani/ })
    .first()
    .click();
  await student.getByRole('button', { name: 'Message Mr. Faisal Al-Zahrani' }).click();
  await expect(student).toHaveURL(/\/conversations\/\d+$/);
  await student
    .getByLabel('Message to Mr. Faisal Al-Zahrani')
    .fill('Hello, a question about CE 101.');
  await student.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(shown(student, /, Sent$/)).toBeVisible();
  expect(
    sql(
      'SELECT COUNT(*) FROM messages m JOIN conversations c ON c.conversation_id = m.conversation_id ' +
        'WHERE c.student_id = 11 AND c.professor_id = 6',
    ),
  ).toBe('1');

  // Dr. Tariq closes messages on Monday 08:00-12:00; at 10:00 Hessa can read but not send.
  const hessa = await open(browser, 'h.almansour@university.example');
  await hessa.getByLabel('Search professors').first().fill('Tariq');
  await hessa
    .getByRole('button', { name: /^Dr\. Tariq Haddad/ })
    .first()
    .click();
  await expect(shown(hessa, 'Not taking messages until 12:00 PM')).toBeVisible();
  await hessa.getByRole('button', { name: 'Message Dr. Tariq Haddad' }).click();
  await expect(
    shown(
      hessa,
      "Dr. Tariq Haddad isn't taking messages until 12:00 PM. You can still read this conversation.",
    ),
  ).toBeVisible();
  await expect(hessa.getByLabel('Message to Dr. Tariq Haddad')).toHaveCount(0);
  await shoot(hessa, 'en-6-chat-closed');
  expect(sql('SELECT COUNT(*) FROM conversations WHERE student_id = 15 AND professor_id = 8')).toBe(
    '1',
  );

  // Text size: from Medium (the default) the Profile heading grows by 20% with "Big" and
  // shrinks by 10% with "Small".
  const settings = await open(browser, 'm.alanazi@university.example');
  await settings.getByRole('tab', { name: 'Profile' }).click();
  const heading = shown(settings, 'Text size');
  const size = () => heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const medium = await size();
  await settings.getByRole('button', { name: 'Big', exact: true }).click();
  expect((await size()) / medium).toBeCloseTo(1.2, 1);
  await settings.getByRole('button', { name: 'Small', exact: true }).click();
  expect((await size()) / medium).toBeCloseTo(0.9, 1);

  // Message notifications off: the bell list says some are hidden.
  await settings.getByRole('button', { name: 'Messages', exact: true }).click();
  await shoot(settings, 'en-5-settings');
  await settings.getByRole('tab', { name: 'Home' }).click();
  await settings.getByRole('button', { name: /^Notifications/ }).click();
  await expect(shown(settings, 'Some notifications are hidden by your settings.')).toBeVisible();
  await expect(shown(settings, /^New message from/)).toHaveCount(0);
});

test('Arabic screens: conversations, thread with quick replies, notifications', async ({
  browser,
}) => {
  const student = await open(browser, 'm.alanazi@university.example', 'ar');
  await expect(student.locator('html')).toHaveAttribute('dir', 'rtl');
  await student.getByRole('tab', { name: /^الرسائل/ }).click();
  const huda = student.getByRole('button', { name: /^د\. هدى القحطاني/ });
  await expect(huda).toBeVisible();
  await shoot(student, 'ar-1-conversations');
  await huda.click();
  await student.getByLabel('رسالة إلى د. هدى القحطاني').fill('هل يناسبك الساعة العاشرة؟');
  await student.getByRole('button', { name: 'أرسل', exact: true }).click();
  await expect(shown(student, /، أُرسلت$/)).toBeVisible();
  await shoot(student, 'ar-2-thread-student');

  const professor = await open(browser, 'h.alqahtani@university.example', 'ar');
  await professor.getByRole('tab', { name: /^الرسائل/ }).click();
  const maha = professor.getByRole('button', { name: /^مها العنزي/ });
  await expect(maha).toBeVisible();
  await shoot(professor, 'ar-3-conversations-professor');
  await maha.click();
  await expect(shown(professor, 'هل يناسبك الساعة العاشرة؟')).toBeVisible();
  await shoot(professor, 'ar-4-thread-professor');
  await professor.goBack();
  await professor.getByRole('tab', { name: 'حالتي' }).click();
  await professor.getByRole('button', { name: /^الإشعارات/ }).click();
  await expect(shown(professor, 'رسالة جديدة من مها العنزي')).toBeVisible();
  await shoot(professor, 'ar-5-notifications');

  await student.clock.runFor(POLL_MS + 1000);
  await expect(shown(student, /، قُرئت$/)).toBeVisible();
});

test('a professor adds a booking time outside office hours and a student sees it', async ({
  browser,
}) => {
  const professor = await open(browser, 'k.alotaibi@university.example');
  await professor.getByRole('tab', { name: 'Schedule' }).click();
  await professor.getByRole('tab', { name: 'Booking', exact: true }).click();
  await professor.getByRole('button', { name: 'Add booking time' }).click();
  // A new booking time starts on Sunday; this one is Tuesday only.
  await professor.getByRole('button', { name: 'Sunday', exact: true }).click();
  await professor.getByRole('button', { name: 'Tuesday', exact: true }).click();
  // 1:00 PM for the default hour: Khalid has no office hours or classes then.
  await professor.getByRole('button', { name: /^Start, / }).click();
  await professor.getByRole('radio', { name: '1:00 PM', exact: true }).click();
  await expect(shown(professor, 'Tuesday, 1:00 PM–2:00 PM')).toBeVisible();
  await shoot(professor, 'en-7-booking-time-sheet');
  await professor.getByRole('button', { name: 'Save booking time' }).click();
  await expect(shown(professor, 'Booking time saved')).toBeVisible();
  expect(
    sql(
      "SELECT COUNT(*) FROM booking_periods WHERE professor_id = 2 AND day_of_week = 2 AND start_time = '13:00:00' AND end_time = '14:00:00'",
    ),
  ).toBe('1');
  await shoot(professor, 'en-8-booking-times');

  const student = await open(browser, 'l.alshehri@university.example');
  await student.getByLabel('Search professors').first().fill('Khalid');
  await student
    .getByRole('button', { name: /^Prof\. Khalid Al-Otaibi/ })
    .first()
    .click();
  await expect(shown(student, 'Tuesday, 1:00 PM–2:00 PM')).toBeVisible();
  await shoot(student, 'en-9-profile-booking-times');

  // Clean up so later specs see the seed (flows.spec reseeds only at its end).
  sql(
    "DELETE FROM booking_periods WHERE professor_id = 2 AND day_of_week = 2 AND start_time = '13:00:00'",
  );
});
