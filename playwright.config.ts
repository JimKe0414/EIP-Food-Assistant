import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3012',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'allow'
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 3012',
    url: 'http://127.0.0.1:3012/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { AI_TEXT_PROVIDER: 'stub', AI_VISION_PROVIDER: 'stub', AI_AUDIO_PROVIDER: 'stub' }
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
