// Flat ESLint config. Pragmatic: type-aware-lite, style left to Prettier.
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.config.js',
      '**/*.config.ts',
      'widget/**', // widget has its own Vue-aware lint via vue-tsc/build
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-unused-vars': 'off',
      // TypeScript's own checker resolves identifiers and understands the Node 24
      // / DOM lib globals (AbortController, fetch, setTimeout, ...). `no-undef` is
      // redundant for TS and misfires on those globals — typescript-eslint
      // recommends disabling it for .ts files.
      'no-undef': 'off',
    },
  },
];
