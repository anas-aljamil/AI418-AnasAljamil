// jest.mock factories are hoisted above imports, so they load modules with jest.requireActual.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// Reanimated 4's mock omits useReducedMotion; tests run with motion enabled.
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js'),
);
// The secure store is a native Keychain/Keystore module; tests use an in-memory map.
jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void values.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void values.delete(key)),
  };
});
