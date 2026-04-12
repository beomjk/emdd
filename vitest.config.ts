import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    // Coverage MUST be at root level — when using `projects`, vitest ignores
    // per-project coverage config and uses only the root coverage settings.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,svelte}'],
      exclude: [
        '**/*.d.ts',
        'src/web/frontend/types/**',
      ],
      reporter: ['text', 'html', 'json', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      thresholds: {
        lines: 90,
        functions: 87,
        branches: 80,
        statements: 90,
      },
    },
    projects: [
      {
        test: {
          name: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/unit/web/components/**'],
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
