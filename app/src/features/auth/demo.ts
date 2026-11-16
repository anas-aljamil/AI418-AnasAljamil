/**
 * Demo accounts for showing Mawjood to someone without an account (a projector demo, the
 * graders). Off unless the build sets EXPO_PUBLIC_DEMO=1 (app/.env): then sign-in offers
 * "Demo student" and "Demo professor", which sign in as two seed accounts.
 *
 * These are the fictional seed accounts and the seed password that docs/ already publish
 * (CLAUDE.md Section 14); there is no admin demo. Do not set the flag on a deployment whose
 * seed passwords were replaced: the buttons would only fail there.
 */
export interface DemoAccounts {
  student: string;
  professor: string;
  password: string;
}

export function demoAccounts(flag: string | undefined): DemoAccounts | null {
  if (flag !== '1') return null;
  return {
    student: 's.almutairi@university.example',
    professor: 'n.alharbi@university.example',
    password: 'Mawjood-Demo-2026',
  };
}
