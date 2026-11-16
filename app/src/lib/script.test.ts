import { scriptOf } from './names';

it.each([
  ['أنا في إجازة ذلك الأسبوع.', 'ar'],
  ['On leave that week.', 'en'],
  ['Room 214 مغلقة', 'ar'],
  ['', 'en'],
])('reads %j as %s', (text, script) => {
  expect(scriptOf(text)).toBe(script);
});
