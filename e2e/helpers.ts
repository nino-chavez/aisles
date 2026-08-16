import type { BrowserContext } from '@playwright/test';

export type Tier = 'small' | 'medium' | 'enterprise';
export const TIERS: Tier[] = ['small', 'medium', 'enterprise'];

/** Sets the kibble_tier cookie directly — faster and less flaky than driving the toggle form every test. */
export async function setTier(context: BrowserContext, baseURL: string, tier: Tier) {
	const { hostname } = new URL(baseURL);
	await context.addCookies([{ name: 'kibble_tier', value: tier, domain: hostname, path: '/' }]);
}
