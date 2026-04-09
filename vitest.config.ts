import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    projects: [
      {
        test: {
          name: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/unit/web/components/**'],
          coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: [
              'src/web/frontend/**',
              '**/*.d.ts',
            ],
            reporter: ['text', 'html', 'json-summary', 'lcov'],
            reportsDirectory: './coverage',
            reportOnFailure: true,
            thresholds: {
              lines: 90,
              functions: 87,
              branches: 80,
              statements: 90,
            },
          },
        },
      },
      {
        plugins: [svelte()],
        resolve: {
          conditions: ['browser'],
        },
        test: {
          name: 'components',
          globals: true,
          environment: 'jsdom',
          include: ['tests/unit/web/components/**/*.test.ts'],
          setupFiles: ['tests/setup/svelte.ts'],
        },
      },
    ],
  },
});
