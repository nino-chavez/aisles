import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));

vi.mock('$env/dynamic/private', () => ({
	env: new Proxy({}, { get: (_target, key: string) => state.env[key] }),
}));

import {
	MERCHANT_TIER_COOKIE,
	MERCHANT_TIERS,
	getActiveMerchantTier,
	getMerchantTierChannelConfig,
	isMerchantTier,
	isMerchantTierProvisioned,
	resetMerchantTierWarnings,
	resolveTierFromCookieValue,
	runWithMerchantTier,
} from './merchant-tier';

describe('merchant tier resolution', () => {
	beforeEach(() => {
		state.env = {};
		resetMerchantTierWarnings();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('names the cookie and the three tiers', () => {
		expect(MERCHANT_TIER_COOKIE).toBe('kibble_tier');
		expect(MERCHANT_TIERS).toEqual(['small', 'medium', 'enterprise']);
	});

	it('validates tier values', () => {
		expect(isMerchantTier('small')).toBe(true);
		expect(isMerchantTier('medium')).toBe(true);
		expect(isMerchantTier('enterprise')).toBe(true);
		expect(isMerchantTier('giant')).toBe(false);
		expect(isMerchantTier(undefined)).toBe(false);
		expect(isMerchantTier(null)).toBe(false);
		expect(isMerchantTier(42)).toBe(false);
	});

	it('resolves an absent or invalid cookie to null (default channel)', () => {
		expect(resolveTierFromCookieValue(undefined)).toBeNull();
		expect(resolveTierFromCookieValue(null)).toBeNull();
		expect(resolveTierFromCookieValue('')).toBeNull();
		expect(resolveTierFromCookieValue('giant')).toBeNull();
		expect(resolveTierFromCookieValue('small')).toBe('small');
	});

	it('has no active tier outside a request scope', () => {
		expect(getActiveMerchantTier()).toBeNull();
	});

	it('scopes the active tier to the AsyncLocalStorage run', () => {
		runWithMerchantTier('enterprise', () => {
			expect(getActiveMerchantTier()).toBe('enterprise');
		});
		expect(getActiveMerchantTier()).toBeNull();
	});

	it('preserves the active tier across an await inside the scope', async () => {
		await runWithMerchantTier('medium', async () => {
			await Promise.resolve();
			expect(getActiveMerchantTier()).toBe('medium');
		});
	});

	it('does not leak the active tier between concurrent scopes', async () => {
		const observed: Array<string | null> = [];
		await Promise.all([
			runWithMerchantTier('small', async () => {
				await new Promise((resolve) => setTimeout(resolve, 5));
				observed.push(getActiveMerchantTier());
			}),
			runWithMerchantTier('enterprise', async () => {
				observed.push(getActiveMerchantTier());
			}),
		]);
		expect(observed.sort()).toEqual(['enterprise', 'small']);
	});

	it('returns null config and warns once when a tier env pair is missing', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(getMerchantTierChannelConfig('small')).toBeNull();
		expect(getMerchantTierChannelConfig('small')).toBeNull();
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('small');
	});

	it('does not warn when warnOnMissing is false', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(getMerchantTierChannelConfig('medium', { warnOnMissing: false })).toBeNull();
		expect(warn).not.toHaveBeenCalled();
	});

	it('resolves a provisioned tier from env', () => {
		state.env.KIBBLE_TIER_ENTERPRISE_CHANNEL_ID = '9988';
		state.env.KIBBLE_TIER_ENTERPRISE_STOREFRONT_TOKEN = 'enterprise-token';
		expect(getMerchantTierChannelConfig('enterprise')).toEqual({
			channelId: 9988,
			storefrontToken: 'enterprise-token',
		});
	});

	it('treats a non-numeric channel id as unprovisioned', () => {
		state.env.KIBBLE_TIER_SMALL_CHANNEL_ID = 'not-a-number';
		state.env.KIBBLE_TIER_SMALL_STOREFRONT_TOKEN = 'small-token';
		expect(getMerchantTierChannelConfig('small', { warnOnMissing: false })).toBeNull();
	});

	it('reports provisioning status without throwing', () => {
		expect(isMerchantTierProvisioned('small')).toBe(false);
		state.env.KIBBLE_TIER_SMALL_CHANNEL_ID = '111';
		state.env.KIBBLE_TIER_SMALL_STOREFRONT_TOKEN = 'small-token';
		expect(isMerchantTierProvisioned('small')).toBe(true);
	});
});
