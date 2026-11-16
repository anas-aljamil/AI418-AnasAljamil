import { demoAccounts } from './demo';

it('offers demo accounts only when the build asks for them', () => {
  expect(demoAccounts(undefined)).toBeNull();
  expect(demoAccounts('0')).toBeNull();
  expect(demoAccounts('true')).toBeNull();
  const demo = demoAccounts('1');
  expect(demo?.student).toBe('s.almutairi@university.example');
  expect(demo?.professor).toBe('n.alharbi@university.example');
  // Fictional seed accounts only; never the administrator.
  expect(JSON.stringify(demo)).not.toContain('admin');
});
