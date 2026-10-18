import { defineConfig } from '@playwright/test';

process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

// Service ownership and private environment belong to the disposable journey runner.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'iam-journey.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  preserveOutput: 'never',
  timeout: 600_000,
  reporter: [['./e2e/iam-journey-reporter.ts']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'iam-journey' }],
});
