import { Redirect } from 'expo-router';

// Until the language, sign-in and home screens exist (P3c), the app opens on the styleguide.
export default function Index() {
  return <Redirect href="/styleguide" />;
}
