import type { Page } from '@playwright/test';

/**
 * Wait for the screen to paint before a screenshot. Right after a tab change or a viewport
 * resize the page can be network-idle while the new screen has not been drawn yet, which
 * saved blank pictures on slower machines.
 */
export async function painted(page: Page) {
  await page.waitForTimeout(400);
}
