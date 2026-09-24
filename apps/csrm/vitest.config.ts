import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**'],
    /*
     * The heaviest component tests drive long userEvent sequences (clearing all
     * twelve Risk Register filters, traversing the five-step import flow) and
     * take about three seconds alone. Running the whole suite in parallel pushes
     * them past the 5s default and they fail as timeouts rather than on any
     * assertion. The extra headroom keeps the suite deterministic; it does not
     * change what any test asserts.
     */
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
