import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against a deployed URL (prod or a Cloudflare Pages preview), not a
 * local dev server — the tier channels, BigCommerce cart/checkout, and
 * search all need real BC-backed state a local `.env` can't cheaply fake.
 * Point it at a preview build during review: E2E_BASE_URL=<preview-url> npx playwright test
 */
export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	timeout: 30_000,
	use: {
		baseURL: process.env.E2E_BASE_URL ?? 'https://aisles.bcsubs.app',
		trace: 'retain-on-failure',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
