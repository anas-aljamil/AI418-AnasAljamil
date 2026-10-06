/**
 * P4 on the web build against the real API and MySQL (docs/plan.md, P4). Same setup as
 * p3c.spec.ts: freshly seeded database, API with DEMO_NOW=2026-10-05T07:00:00Z, browser clock
 * at the same moment. Each user gets their own browser context (their own session cookie).
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';

const SHOTS = path.resolve(__dirname, '../../docs/screenshots/p4');
const DEMO_NOW = new Date('2026-10-05T07:00:00Z');
const PASSWORD = 'Mawjood-Demo-2026';
const POLL_MS = 20_000;

/** One value from MySQL, through the project's own client wrapper (scripts/mysql_cli.py). */
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

/**
 * Opens a professor's profile the way a student does: one tap on Home. (The static web export
 * served by `expo serve` has no deep links to dynamic routes such as /professors/1.)
 */
async function openProfessor(page: Page, name: RegExp) {
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole('button', { name }).first().click();
  await expect(page).toHaveURL(/\/professors\/\d+$/);
}

/** Full-length screenshot (the app scrolls inside its own container). */
async function shoot(page: Page, name: string) {
  const height = await page.evaluate(() =>
    Math.max(
      800,
      ...[...document.querySelectorAll('*')].map((el) =>
        ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) ? el.scrollHeight + 160 : 0,
      ),
    ),
  );
  await page.setViewportSize({ width: 360, height: Math.min(height, 3000) });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  await page.setViewportSize({ width: 360, height: 800 });
}

/** Opens the booking sheet and picks the first free start on the first day that has one. */
async function chooseFirstFreeTime(page: Page, sheetName: RegExp) {
  const sheet = page.getByRole('dialog', { name: sheetName });
  await expect(sheet).toBeVisible();
  const days = sheet.getByRole('button', { name: /^\S+ \d+$/ });
  for (let i = 0; i < (await days.count()); i++) {
    await days.nth(i).click();
    // Starts are minute chips under the hour chips. Taken and past ones are named
    // "9:00 AM, unavailable"; free ones are just the time (Arabic: "9:00 ص" / "1:00 م").
    const free = sheet.getByRole('button', { name: /^\d{1,2}:\d\d ([AP]M|ص|م)$/ });
    if (
      await free
        .first()
        .waitFor({ timeout: 3000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await free.first().click();
      return sheet;
    }
  }
  throw new Error('no free time in the booking window');
}

test('a student books, the professor approves, the student sees Approved', async ({ browser }) => {
  const student = await open(browser, 'l.alshehri@university.example');
  await openProfessor(student, /^Dr\. Noura Al-Harbi/);
  await shoot(student, 'en-1-profile');
  await student.getByRole('button', { name: 'Book', exact: true }).click(); // step 1
  const sheet = await chooseFirstFreeTime(student, /^Book with/); // steps 2-3: day, time
  await sheet.getByRole('button', { name: 'Advising' }).click(); // optional
  await shoot(student, 'en-2-booking-sheet');
  // The length starts at the professor's usual 15 minutes (any 5-minute step is allowed).
  await expect(sheet.getByText(/^15 min, until \d{1,2}:\d\d [AP]M$/)).toBeVisible();
  await sheet.getByRole('button', { name: /^Book \d{1,2}:\d\d [AP]M, 15 min$/ }).click(); // step 4
  await expect(student.getByText(/^Booked with Dr\. Noura Al-Harbi, /)).toBeVisible();
  await shoot(student, 'en-3-booked');
  await student.getByRole('button', { name: 'Done' }).click();
  await student.goto('/appointments');
  await expect(student.getByText('Waiting for approval').first()).toBeVisible();

  const professor = await open(browser, 'n.alharbi@university.example');
  await professor.getByRole('tab', { name: 'Requests' }).click();
  await shoot(professor, 'en-5-requests');
  await professor.getByRole('button', { name: /^Approve: Lama Al-Shehri, / }).click();
  await expect(professor.getByText(/^Approved: Lama Al-Shehri, /)).toBeVisible();

  // The student's list catches up at the next poll, without reloading.
  await student.clock.runFor(POLL_MS + 1000);
  await expect(student.getByText('Approved', { exact: true }).first()).toBeVisible();
  await shoot(student, 'en-4-appointments');
  expect(
    sql(
      'SELECT status FROM appointments WHERE student_id = 10 AND professor_id = 1 ORDER BY appointment_id DESC LIMIT 1',
    ),
  ).toBe('approved');
  expect(
    sql(
      'SELECT TIMESTAMPDIFF(MINUTE, starts_at, ends_at) FROM appointments WHERE student_id = 10 AND professor_id = 1 ORDER BY appointment_id DESC LIMIT 1',
    ),
  ).toBe('15');
});

test("a professor's one-tap status reaches the student within one poll", async ({ browser }) => {
  const student = await open(browser, 's.almutairi@university.example');
  await openProfessor(student, /^Prof\. Khalid Al-Otaibi/);
  // Home stays mounted under the profile, so look only at what is on screen.
  const onScreen = (text: string) =>
    student.getByText(text, { exact: true }).filter({ visible: true });
  await expect(onScreen('In office (not confirmed)')).toBeVisible();

  const professor = await open(browser, 'k.alotaibi@university.example');
  await expect(professor).toHaveURL(/\/staff\/status$/);
  await professor.getByRole('radio', { name: 'Busy' }).click(); // one tap
  await expect(professor.getByRole('radio', { name: 'Busy' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(professor.getByText(/^Set by you, updated just now/)).toBeVisible();
  await shoot(professor, 'en-6-status');

  await student.clock.runFor(POLL_MS + 1000);
  await expect(onScreen('Busy')).toBeVisible();
  expect(
    sql(
      'SELECT status FROM status_overrides WHERE professor_id = 2 ORDER BY override_id DESC LIMIT 1',
    ),
  ).toBe('busy');
});

test('the admin creates, edits and deletes a row of each type, checked in MySQL', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const admin = await open(browser, 'admin@university.example');
  await expect(admin).toHaveURL(/\/admin\/departments$/);

  const fill = async (label: string, value: string) =>
    admin.getByLabel(label, { exact: true }).fill(value);
  // The department menu opens over the form; choose under the college heading.
  const chooseDepartment = async (name: string) => {
    await admin.getByRole('button', { name: /^Department, / }).click();
    await admin.getByRole('radio', { name, exact: true }).click();
  };
  const save = async () => {
    await admin.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(admin.getByText('Saved', { exact: true })).toBeVisible();
  };
  const remove = async (rowText: string) => {
    await admin.getByText(rowText, { exact: true }).click();
    await admin.getByRole('button', { name: 'Delete', exact: true }).click();
    await admin
      .getByRole('dialog', { name: /^Delete / })
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(admin.getByText('Deleted', { exact: true })).toBeVisible();
  };

  // Departments
  await admin.getByRole('button', { name: 'Add' }).click();
  await admin.getByRole('button', { name: 'College of Engineering', exact: true }).click();
  await fill('Code (capital English letters)', 'GEO');
  await fill('Name in Arabic', 'الجغرافيا');
  await fill('Name in English', 'Geography');
  await save();
  expect(sql("SELECT name_en FROM departments WHERE code = 'GEO'")).toBe('Geography');
  await admin.getByText('Geography', { exact: true }).click();
  await fill('Name in English', 'Geography and GIS');
  await save();
  expect(sql("SELECT name_en FROM departments WHERE code = 'GEO'")).toBe('Geography and GIS');
  await shoot(admin, 'en-7-admin-departments');
  await remove('Geography and GIS');
  expect(sql("SELECT COUNT(*) FROM departments WHERE code = 'GEO'")).toBe('0');

  // Offices
  await admin.getByRole('tab', { name: 'Offices' }).click();
  await admin.getByRole('button', { name: 'Add' }).click();
  await fill('Building code', 'D');
  await fill('Floor', '1');
  await fill('Room number', '101');
  await save();
  expect(
    sql("SELECT COUNT(*) FROM offices WHERE building_code = 'D' AND room_number = '101'"),
  ).toBe('1');
  await admin.getByText('Building D, floor 1, room 101', { exact: true }).click();
  await fill('Room number', '102');
  await save();
  expect(sql("SELECT room_number FROM offices WHERE building_code = 'D'")).toBe('102');
  await remove('Building D, floor 1, room 102');
  expect(sql("SELECT COUNT(*) FROM offices WHERE building_code = 'D'")).toBe('0');

  // Professors
  await admin.getByRole('tab', { name: 'Professors' }).click();
  await admin.getByRole('button', { name: 'Add' }).click();
  await fill('University email', 'test.professor@university.example');
  await fill('Password (at least 8 characters)', 'Test-pass-2026');
  await fill('Name in Arabic', 'أستاذ تجريبي');
  await fill('Name in English', 'Test Professor');
  await chooseDepartment('Software Engineering');
  await save();
  expect(sql("SELECT role FROM users WHERE email = 'test.professor@university.example'")).toBe(
    'professor',
  );
  await admin.getByText('Test Professor', { exact: true }).click();
  await fill('Name in English', 'Test Professor Two');
  await admin.getByRole('button', { name: '30 min' }).click();
  await save();
  expect(
    sql(
      "SELECT CONCAT(u.full_name_en, '/', p.slot_minutes) FROM users u JOIN professors p ON p.professor_id = u.user_id WHERE u.email = 'test.professor@university.example'",
    ),
  ).toBe('Test Professor Two/30');
  await shoot(admin, 'en-8-admin-professors');
  await remove('Test Professor Two');
  expect(sql("SELECT COUNT(*) FROM users WHERE email = 'test.professor@university.example'")).toBe(
    '0',
  );

  // Students
  await admin.getByRole('tab', { name: 'Students' }).click();
  await admin.getByRole('button', { name: 'Add' }).click();
  await fill('University email', 'test.student@university.example');
  await fill('Password (at least 8 characters)', 'Test-pass-2026');
  await fill('Name in Arabic', 'طالب تجريبي');
  await fill('Name in English', 'Test Student');
  await fill('University number', 'S9999');
  await chooseDepartment('Artificial Intelligence');
  await save();
  expect(
    sql(
      "SELECT university_no FROM students s JOIN users u ON u.user_id = s.student_id WHERE u.email = 'test.student@university.example'",
    ),
  ).toBe('S9999');
  await admin.getByText('Test Student', { exact: true }).click();
  await admin.getByRole('button', { name: '3', exact: true }).click();
  await admin.getByRole('button', { name: 'Not active', exact: true }).click();
  await save();
  expect(
    sql(
      "SELECT CONCAT(s.study_year, '/', u.is_active) FROM students s JOIN users u ON u.user_id = s.student_id WHERE u.email = 'test.student@university.example'",
    ),
  ).toBe('3/0');
  await remove('Test Student');
  expect(sql("SELECT COUNT(*) FROM users WHERE email = 'test.student@university.example'")).toBe(
    '0',
  );
});

test('Arabic screens: profile, booking, appointments, search and professor status', async ({
  browser,
}) => {
  const student = await open(browser, 's.almutairi@university.example', 'ar');
  await openProfessor(student, /^أ\.د\. خالد العتيبي/);
  await expect(student.getByRole('heading', { name: 'أ.د. خالد العتيبي' })).toBeVisible();
  await shoot(student, 'ar-1-profile');
  await student.getByRole('button', { name: 'احجز', exact: true }).click();
  await chooseFirstFreeTime(student, /^احجز مع/);
  await shoot(student, 'ar-2-booking-sheet');
  await student.goto('/appointments');
  await expect(student.getByText('تمت الموافقة').first()).toBeVisible();
  await shoot(student, 'ar-4-appointments');
  await student.goto('/search');
  await student.getByRole('button', { name: 'في المكتب', exact: true }).click();
  await expect(student.getByRole('button', { name: /^د\. هدى القحطاني/ })).toBeVisible();
  await shoot(student, 'ar-9-search');

  const professor = await open(browser, 'h.alqahtani@university.example', 'ar');
  await expect(professor.getByRole('radio', { name: 'في المكتب' })).toBeVisible();
  await shoot(professor, 'ar-6-status');
  await professor.goto('/staff/schedule');
  await expect(professor.getByRole('heading', { name: 'الجدول' })).toBeVisible();
  await shoot(professor, 'ar-10-schedule');
});
