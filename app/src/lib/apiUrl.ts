/**
 * Where the backend lives (docs/run-on-phone.md, Section 4):
 * 1. EXPO_PUBLIC_API_URL, if set (tunnels, hotspots, unusual networks);
 * 2. in Expo Go, the computer that serves the app (its LAN address from hostUri), port 8000;
 * 3. in a browser opened from the API itself (the public link, or port 8000), the page's own
 *    address: one origin, so no CORS and a same-site refresh cookie;
 * 4. in a browser on the Expo web server (port 8081), the host that served the page, port 8000.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const API_PORT = 8000;
const WEB_SERVER_PORT = '8081'; // expo start --web, expo serve and npm run phones
const API_PREFIX = '/api/v1';

interface Inputs {
  envUrl?: string;
  hostUri?: string | null;
  webHostname?: string | null;
  /** window.location.origin and .port, in a browser */
  webOrigin?: string | null;
  webPort?: string | null;
}

export function resolveApiUrl({
  envUrl,
  hostUri,
  webHostname,
  webOrigin,
  webPort,
}: Inputs): string {
  if (envUrl && envUrl.trim()) {
    const base = envUrl.trim().replace(/\/+$/, '');
    return base.endsWith(API_PREFIX) ? base : `${base}${API_PREFIX}`;
  }
  if (webOrigin && webPort !== WEB_SERVER_PORT) return `${webOrigin}${API_PREFIX}`;
  // hostUri looks like "192.168.1.20:8081" (or "[::1]:8081"); keep the host, swap the port.
  const host = hostUri?.replace(/:\d+$/, '') || webHostname || 'localhost';
  return `http://${host}:${API_PORT}${API_PREFIX}`;
}

export function apiUrl(): string {
  const page = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location : null;
  return resolveApiUrl({
    envUrl: process.env.EXPO_PUBLIC_API_URL,
    hostUri: Platform.OS === 'web' ? null : Constants.expoConfig?.hostUri,
    webHostname: page?.hostname,
    webOrigin: page?.origin,
    webPort: page?.port,
  });
}
