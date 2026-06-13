import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    name: 'widget',
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
});
