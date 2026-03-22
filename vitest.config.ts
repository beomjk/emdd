import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/graph/types.generated.ts',
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
});
