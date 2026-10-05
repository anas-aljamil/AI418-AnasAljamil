// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', 'e2e/screenshots/*'] },
  {
    // Design tokens live in src/theme (DESIGN.md Section 4): no raw colours in components.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message: 'Use a colour token from src/theme instead of a raw hex value.',
        },
      ],
      // Metro does not tree-shake: the package root pulls every icon (~210 KB gzipped) into the bundle.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'lucide-react-native',
              message: "Import each icon on its own: 'lucide-react-native/icons/<icon-name>'.",
            },
          ],
        },
      ],
    },
  },
]);
