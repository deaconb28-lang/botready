import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/*/__tests__/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
      'apps/*/__tests__/**/*.test.ts',
    ],
    // Scans hit the loopback test server and a real browser; give them room.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@botready/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
    },
  },
});
