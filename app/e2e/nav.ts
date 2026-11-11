import type { Page } from '@playwright/test';

/**
 * A navigation tab (a link in the bottom bar or the desktop rail). Screens have their own
 * switches with the tab role too (Schedule: Timetable / Booking / Messages), so a role query
 * alone can match two elements.
 */
export const navTab = (page: Page, name: string) =>
  page.locator('a[role="tab"]').filter({ hasText: new RegExp(`^${name}`) });
