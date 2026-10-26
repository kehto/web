import { defineConfig, devices } from '@playwright/test';
import { HARNESS_PORT, HARNESS_URL } from './tests/e2e/helpers/harness-url.js';

const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/chromium');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: HARNESS_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: chromiumExecutablePath,
        },
      },
    },
  ],
  webServer: [
    {
      command: `pnpm --filter @test/harness exec vite preview --port ${HARNESS_PORT} --strictPort`,
      url: HARNESS_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: 'pnpm --filter @kehto/playground preview --port 4174',
      url: 'http://localhost:4174',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});
