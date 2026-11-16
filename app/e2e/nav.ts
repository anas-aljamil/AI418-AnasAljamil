import { expect, type Page } from '@playwright/test';

/**
 * A navigation tab (a link in the bottom bar or the desktop rail). Screens have their own
 * switches with the tab role too (Schedule: Timetable / Booking / Messages), so a role query
 * alone can match two elements.
 */
export const navTab = (page: Page, name: string) =>
  page.locator('a[role="tab"]').filter({ hasText: new RegExp(`^${name}`) });

/**
 * Opens a navigation tab and waits until it is the current one. Screens of other tabs stay in
 * the page, hidden, and a switch takes about 150 ms: a click sent straight after the tab click
 * can still find the button of the screen that is leaving, and Playwright then waits on that
 * hidden button until the test times out.
 */
export async function openTab(page: Page, name: string) {
  const tab = navTab(page, name);
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}
