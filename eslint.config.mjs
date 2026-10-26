// Flat config shared by every workspace. Architectural boundaries (plan §5) are
// enforced here so a violating import fails `pnpm lint`, not just code review.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const NETWORK_MODULES = ['axios', 'node:http', 'node:https', 'http', 'https', 'undici', 'cross-fetch', 'node-fetch'];
const STORAGE_MODULES = ['expo-sqlite', 'node:sqlite', 'better-sqlite3', '@huroofi/offline-storage'];
const UI_MODULES = ['react', 'react-native', 'expo', 'zustand'];

const restrict = (modules, message) =>
  modules.map((name) => ({ name, message }));

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.turbo/**', 'apps/mobile/android/**', 'apps/mobile/ios/**', 'apps/mobile/.expo/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Pure domain packages: no UI, no storage, no network.
    files: [
      'packages/content-schema/src/**',
      'packages/curriculum/src/**',
      'packages/game-core/src/**',
      'packages/activity-sdk/src/**',
      'packages/activities-*/src/**',
      'packages/learning-engine/src/**',
      'packages/ai-gateway/src/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...restrict(NETWORK_MODULES, 'Domain packages must not perform network I/O (plan §5, §12).'),
            ...restrict(STORAGE_MODULES, 'Domain packages must use repository interfaces, never SQLite (plan §5).'),
            ...restrict(UI_MODULES, 'Domain packages must stay UI-free and pure TypeScript.'),
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'No network calls in domain packages.' },
        { name: 'XMLHttpRequest', message: 'No network calls in domain packages.' },
        { name: 'WebSocket', message: 'No network calls in domain packages.' },
      ],
    },
  },
  {
    // Storage may use SQLite, but never the network or UI.
    files: ['packages/offline-storage/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...restrict(NETWORK_MODULES, 'Storage must not perform network I/O.'),
            ...restrict(UI_MODULES, 'Storage must stay UI-free.'),
          ],
        },
      ],
      'no-restricted-globals': ['error', 'fetch', 'XMLHttpRequest', 'WebSocket'],
    },
  },
);
