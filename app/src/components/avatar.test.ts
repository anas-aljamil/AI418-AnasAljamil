/** Initials for the round mark at the start of a person's row (components/Avatar.tsx). */
import { initialsOf } from './Avatar';

it.each([
  ['Noura Al-Harbi', 'NH'],
  ['Omar Bin Salem', 'OS'],
  ['نورة الحربي', 'نح'],
  ['  Saad   Al-Mutairi ', 'SM'],
  ['Salma', 'S'],
  ['', ''],
])('makes initials of "%s"', (name, initials) => {
  expect(initialsOf(name)).toBe(initials);
});
