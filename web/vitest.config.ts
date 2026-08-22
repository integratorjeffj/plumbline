import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Render tests for the console.
 *
 * These exist because `tsc --noEmit` cannot catch the bug they were written
 * for: a JSX restructure that left two of three tab panels rendering nothing.
 * That file was structurally valid TypeScript and silently wrong, and the only
 * thing that would have caught it is actually rendering the page and looking
 * at what came out.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.tsx'],
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
  },
});
