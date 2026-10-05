/**
 * Server state (TanStack Query): polling, offline behaviour and the on-device copy of the
 * last known data (DESIGN.md Section 9, "Slow or offline").
 *
 * - Connectivity comes from NetInfo on Android/iOS (the browser's own events on web).
 *   While offline, queries pause instead of failing, and the screens show what they last knew.
 * - Returning to the app refetches (AppState on native, window focus on web).
 * - Successful results are saved to AsyncStorage for 24 hours, so a cold start offline still
 *   shows the last statuses with their "updated" times. The copy is deleted on sign-out.
 */
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusManager, onlineManager, QueryClient, type Query } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

import { ApiError } from './client';

export const POLL_MS = 20_000; // CLAUDE.md Section 5: polling every 15-30 s
const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_KEY = 'mawjood.cache';

if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) =>
    // isConnected is null while unknown; treat that as online so the first fetch is not held back.
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );
  AppState.addEventListener('change', (status) => focusManager.setFocused(status === 'active'));
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: POLL_MS - 5_000,
      gcTime: DAY_MS, // must cover the saved copy's lifetime
      // Retry network hiccups and server errors, never answers like 401/403/404.
      retry: (failures, error) =>
        failures < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: CACHE_KEY });
export const persistOptions = {
  persister,
  maxAge: DAY_MS,
  buster: 'p3c',
  dehydrateOptions: {
    // Keep what the home screen shows; search results are not worth keeping.
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === 'success' && query.queryKey[1] !== 'search',
  },
};

/** Sign-out: forget every cached response, in memory and on the device. */
export async function clearCachedData() {
  queryClient.clear();
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing saved.
  }
}
