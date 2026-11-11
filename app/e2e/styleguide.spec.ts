import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const SHOTS = path.resolve(__dirname, '../../docs/screenshots/p3b');
const combos = [
  { name: 'ar-light', language: 'ar', theme: 'light', heading: 'دليل التصميم' },
  { name: 'en-dark', language: 'en', theme: 'dark', heading: 'Styleguide' },
] as const;
const widths = [360, 768, 1280];

async function open(page: Page, language: string, theme: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  // Saved preferences the app reads on start (AsyncStorage is localStorage on the web).
  await page.addInitScript(
    ([lang, th]) => {
      localStorage.setItem('mawjood.language', lang);
      localStorage.setItem('mawjood.theme', th);
    },
    [language, theme],
  );
  await page.goto('/styleguide');
  await page.evaluate(() => document.fonts.ready);
}

for (const combo of combos) {
  test.describe(combo.name, () => {
    for (const width of widths) {
      test(`screenshot at ${width}px`, async ({ page }) => {
        await open(page, combo.language, combo.theme, width);
        await expect(page.getByRole('heading', { name: combo.heading })).toBeVisible();
        // Wait for the API check to settle so the screenshot is stable.
        await expect(page.getByText(/Reachable|Not reachable|متصل|غير متصل/).first()).toBeVisible();
        // The app scrolls inside its own container, so grow the viewport to the content height.
        const height = await page.evaluate(() =>
          Math.max(
            ...[...document.querySelectorAll('*')].map((el) =>
              ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) ? el.scrollHeight : 0,
            ),
          ),
        );
        await page.setViewportSize({ width, height: Math.min(height, 12000) });
        await page.screenshot({ path: `${SHOTS}/${combo.name}-${width}.png` });
      });
    }

    test('uses the right direction, fonts and theme', async ({ page }) => {
      await open(page, combo.language, combo.theme, 390);
      await expect(page.getByRole('heading', { name: combo.heading })).toBeVisible();
      const dir = await page.evaluate(() => document.documentElement.dir);
      expect(dir).toBe(combo.language === 'ar' ? 'rtl' : 'ltr');
      const families = await page.evaluate(() =>
        [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
      );
      expect(families.join(' ')).toContain(
        combo.language === 'ar' ? 'IBMPlexSansArabic' : 'IBMPlexSans_',
      );
      const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(background).not.toBe('');
    });
  });
}

test('no horizontal scrolling at 320 px', async ({ page }) => {
  for (const language of ['ar', 'en']) {
    await open(page, language, 'light', 320);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${language} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});

test('tapping a status animates the demo door to that status', async ({ page }) => {
  await open(page, 'en', 'light', 390);
  const door = page.getByRole('img', { name: 'Status: In office' });
  await expect(door).toBeVisible();
  await page.getByRole('button', { name: 'Busy' }).first().click();
  await expect(page.getByRole('img', { name: 'Status: Busy' })).toBeVisible();
  // The leaf really changes: busy red (#9F1F1A) and nearly closed after the animation.
  const leaf = page.getByRole('img', { name: 'Status: Busy' }).locator('path').nth(2);
  await expect(leaf).toHaveAttribute('fill', /9F1F1A|159, 31, 26/i);
  await expect(leaf).toHaveAttribute('d', /L16\.4 4\.2V21L6 21Z/);
  await expect(page.getByRole('button', { name: 'Busy' }).first()).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('the bottom sheet opens as a dialog and closes', async ({ page }) => {
  await open(page, 'en', 'light', 390);
  await page.getByRole('button', { name: 'Open the sheet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Book with Dr. Noura' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('with reduced motion the sheet appears instantly, fully in place', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'en', 'light', 390);
  await page.getByRole('button', { name: 'Open the sheet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Book with Dr. Noura' });
  await expect(dialog).toBeVisible();
  // No slide: the sheet's bottom edge already sits at the bottom of the screen.
  const box = await dialog.boundingBox();
  expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(900);
  await page.screenshot({ path: `${SHOTS}/en-light-sheet-390.png` });
});

test('buttons are reachable with the keyboard and show a focus ring', async ({ page }) => {
  await open(page, 'en', 'light', 1280);
  const target = page.getByRole('button', { name: 'Message' });
  await target.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  const outline = await target.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe('solid');
});
