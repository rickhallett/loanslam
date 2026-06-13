import { defineWorkspace } from 'vitest/config';

// Backend + contracts run in Node; the widget brings its own jsdom config.
export default defineWorkspace([
  {
    test: {
      name: 'contracts',
      root: './contracts',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'backend',
      root: './backend',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  './widget/vitest.config.ts',
]);
