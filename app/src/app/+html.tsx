/**
 * The HTML page around the web build (Expo Router uses this file for the browser only; the
 * phone app ignores it). Besides Expo Router's defaults it makes the browser version
 * installable from the home screen (owner decision 2026-11-10: phones open the app in the
 * browser instead of Expo Go): "Add to Home Screen" on iPhone and Android gives it the
 * Mawjood icon and name, and opens it full screen without the browser bars.
 * The page language and direction are set at runtime from the chosen language (i18n).
 */
import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

import { palettes } from '@/theme/tokens';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Mawjood</title>

        {/* Home-screen app: manifest (Android, desktop) and Apple's own tags (iPhone). */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Mawjood" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Browser bars match the page background in each theme. */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={palettes.light.bg}
        />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content={palettes.dark.bg} />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
