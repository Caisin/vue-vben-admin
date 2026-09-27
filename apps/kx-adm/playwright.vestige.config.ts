import { readFileSync } from 'node:fs';
import process from 'node:process';

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.VESTIGE_WEB_URL ?? 'http://127.0.0.1:5713';
function requireLoopback(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      !url.username &&
      !url.password
    )
      return;
  } catch {
    /* Do not echo malformed connection values. */
  }
  throw new Error(
    'Vestige browser acceptance requires an isolated loopback service.',
  );
}
requireLoopback(baseURL);
if (process.env.VESTIGE_WEB_FIXTURE_FILE) {
  const fixture = JSON.parse(
    readFileSync(process.env.VESTIGE_WEB_FIXTURE_FILE, 'utf8'),
  );
  requireLoopback(fixture.server_url);
}

export default defineConfig({
  testDir: './__tests__/e2e',
  testMatch: [
    'vestige.spec.ts',
    'vestige-training.spec.ts',
    'vestige-models.spec.ts',
  ],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: 'list',
  outputDir: 'node_modules/.e2e/vestige',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    headless: true,
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
