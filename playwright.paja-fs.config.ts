import { devices } from '@playwright/test';
import config from './playwright.config.js';

export default {
  ...config,
  testMatch: '**/paja-fs-pickers.spec.ts',
  webServer: [],
  projects: [
    ...(config.projects ?? []),
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
};
