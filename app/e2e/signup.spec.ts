/**
 * Sign-up on the web build against the real API and MySQL (CLAUDE.md Section 14, sign-up).
 * Same setup as the other specs: seeded database, API with DEMO_NOW=2026-10-05T07:00:00Z.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';

const SHOTS = path.resolve(__dirname, '../../docs/screenshots/signup');
const DEMO_NOW = new Date('2026-10-05T07:00:00Z');

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

async function fresh(browser: Browser, language: 'ar' | 'en' = 'en'): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  await page.clock.install({ time: DEMO_NOW });
  await page.addInitScript((lng) => localStorage.setItem('mawjood.language', lng), language);
  await page.goto('/sign-in');
  return page;
}

/** The sign-in screen stays mounted under sign-up on the web build: use the top (last) one. */
const field = (page: Page, label: string | RegExp) =>
  page.getByLabel(label, { exact: true }).last();

async function signIn(page: Page, email: string, password: string) {
  await field(page, 'University email').fill(email);
  await field(page, 'Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** Opens the department menu (a sheet listing departments under their college). */
async function openDepartmentMenu(page: Page) {
  await page.getByRole('button', { name: /^Department, / }).click();
  await expect(page.getByRole('dialog', { name: 'Department' })).toBeVisible();
}

async function shoot(page: Page, name: string) {
  await page.waitForTimeout(600); // let the sheet finish sliding up
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function fillAccount(page: Page, who: { ar: string; en: string; email: string }) {
  await page.getByLabel('Name in Arabic').fill(who.ar);
  await page.getByLabel('Name in English').fill(who.en);
  await field(page, 'University email').fill(who.email);
  await page.getByLabel('Password (at least 8 characters)').fill('a-long-password');
}

test('a student creates an account and lands on Home', async ({ browser }) => {
  const page = await fresh(browser);
  await page.getByRole('button', { name: 'New to Mawjood? Create an account' }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await fillAccount(page, {
    ar: 'رنا القحطاني',
    en: 'Rana Al-Qahtani',
    email: '4519001@upm.edu.sa',
  });
  await expect(page.getByText('University number: 4519001')).toBeVisible();
  await openDepartmentMenu(page);
  await shoot(page, 'en-1-department-menu');
  await page.getByRole('radio', { name: 'Cybersecurity and Forensic Computing' }).click();
  await page.getByRole('button', { name: 'Year 2' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(/, Rana$/)).toBeVisible();
  expect(
    sql(
      "SELECT CONCAT(u.role, '/', u.is_active, '/', s.university_no, '/', s.study_year) FROM users u " +
        "JOIN students s ON s.student_id = u.user_id WHERE u.email = '4519001@upm.edu.sa'",
    ),
  ).toBe('student/1/4519001/2');
});

test('a professor asks for an account; it works once the admin activates it', async ({
  browser,
}) => {
  const page = await fresh(browser);
  await page.getByRole('button', { name: 'New to Mawjood? Create an account' }).click();
  await page.getByRole('tab', { name: 'Professor' }).click();
  await fillAccount(page, {
    ar: 'منصور الفرج',
    en: 'Mansour Al-Faraj',
    email: 'm.alfaraj@upm.edu.sa',
  });
  await openDepartmentMenu(page);
  await page.getByRole('radio', { name: 'Software Engineering' }).click();
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('Request sent', { exact: true })).toBeVisible();
  expect(
    sql("SELECT CONCAT(role, '/', is_active) FROM users WHERE email = 'm.alfaraj@upm.edu.sa'"),
  ).toBe('professor/0');

  // Before activation, signing in explains why it does not work.
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await signIn(page, 'm.alfaraj@upm.edu.sa', 'a-long-password');
  await expect(page.getByText(/^This account is not active yet/)).toBeVisible();

  // The admin sees the request on the overview and activates it in one tap.
  const admin = await fresh(browser);
  await signIn(admin, 'admin@university.example', 'Mawjood-Demo-2026');
  // Next to the seed's switched-off student.
  await expect(admin.getByText('Waiting for activation (2)', { exact: true })).toBeVisible();
  await admin.getByRole('button', { name: 'Activate Mansour Al-Faraj', exact: true }).click();
  await expect(admin.getByText('Mansour Al-Faraj can sign in now', { exact: true })).toBeVisible();
  expect(sql("SELECT is_active FROM users WHERE email = 'm.alfaraj@upm.edu.sa'")).toBe('1');

  await signIn(page, 'm.alfaraj@upm.edu.sa', 'a-long-password');
  await expect(page).toHaveURL(/\/staff\/status$/);
});

test('Arabic sign-up form, and the domain rule', async ({ browser }) => {
  const page = await fresh(browser, 'ar');
  await page.getByRole('button', { name: 'جديد في موجود؟ أنشئ حسابًا' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await field(page, 'البريد الجامعي').fill('4519002@gmail.com');
  await page.setViewportSize({ width: 360, height: 1500 }); // the whole form in one picture
  await page.screenshot({ path: `${SHOTS}/ar-sign-up.png` });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByLabel('الاسم بالعربية').fill('رنا');
  await page.getByLabel('الاسم بالإنجليزية').fill('Rana');
  await page.getByLabel('كلمة المرور (8 أحرف على الأقل)').fill('a-long-password');
  await page.getByRole('button', { name: /^القسم، / }).click();
  await page.getByRole('radio', { name: 'الأمن السيبراني والحوسبة الجنائية' }).click();
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
  // Caught before sending, next to the email field.
  await expect(page.getByText('استخدم بريدك الجامعي المنتهي بـ @upm.edu.sa.')).toBeVisible();
  expect(sql("SELECT COUNT(*) FROM users WHERE email = '4519002@gmail.com'")).toBe('0');
});
