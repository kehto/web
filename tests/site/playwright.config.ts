import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'kernl.spec.ts',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4177/web/',
    ...devices['Desktop Chrome'],
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
        (process.platform === 'darwin'
          ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
          : undefined),
    },
  },
  webServer: {
    command: 'PORT=4177 node scripts/serve-pages.mjs',
    cwd: '../..',
    url: 'http://127.0.0.1:4177/web/',
    reuseExistingServer: !process.env.CI,
  },
});
