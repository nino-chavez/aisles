/**
 * Merchant-tier demo toggle — server-side tier resolution and per-tier
 * BigCommerce channel config.
 *
 * A Kibble & Co. visitor picks Small / Medium / Enterprise merchant via the
 * `kibble_tier` cookie, and the storefront re-renders against that tier's
 * BigCommerce channel. Absent or invalid cookie behaves exactly like today:
 * the brand's default channel and token (see getGraphQLConfig in
 * ./bigcommerce.ts) — this module never changes that path unless a tier is
 * both selected and provisioned.
 *
 * Per-tier channel config comes from env vars wired by a parallel workstream
 * (KIBBLE_TIER_<TIER>_CHANNEL_ID / KIBBLE_TIER_<TIER>_STOREFRONT_TOKEN). When
 * a tier's pair is missing, resolution falls back to the default channel and
 * logs a warning once per tier per isolate.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '$env/dynamic/private';

export const MERCHANT_TIER_COOKIE = 'kibble_tier';

export const MERCHANT_TIERS = ['small', 'medium', 'enterprise'] as const;
export type MerchantTier = (typeof MERCHANT_TIERS)[number];

export function isMerchantTier(value: unknown): value is MerchantTier {
	return typeof value === 'string' && (MERCHANT_TIERS as readonly string[]).includes(value);
}

/** Parse a raw cookie value. Anything other than exactly one of the three tiers resolves to `null` (default channel). */
export function resolveTierFromCookieValue(value: string | undefined | null): MerchantTier | null {
	return isMerchantTier(value) ? value : null;
}

// ─── Request-scoped active tier ────────────────────────────────────
//
// getGraphQLConfig() (./bigcommerce.ts) has no request object in scope — it's
// called deep under many brand-agnostic query functions. Brand selection
// itself is a build-time env var (BRAND_ID), so there's no existing
// per-request context to mirror; the tier is genuinely per-visitor. Rather
// than thread a tier parameter through every exported bigcommerce.ts
// function and its callers, hooks.server.ts wraps each request in an
// AsyncLocalStorage scope (supported here — wrangler.toml already sets the
// `nodejs_compat` flag) so any server code reached during that request can
// read the active tier without a new mutable module-level global, which
// would be unsafe across concurrent requests in one Workers isolate.

const tierContext = new AsyncLocalStorage<MerchantTier | null>();

export function runWithMerchantTier<T>(tier: MerchantTier | null, fn: () => T): T {
	return tierContext.run(tier, fn);
}

export function getActiveMerchantTier(): MerchantTier | null {
	return tierContext.getStore() ?? null;
}

// ─── Per-tier channel config ───────────────────────────────────────

export interface MerchantTierChannelConfig {
	channelId: number;
	storefrontToken: string;
}

const warnedMissingTiers = new Set<MerchantTier>();

/**
 * Resolve a tier's channel config from env. Returns `null` when either half
 * of the pair is missing or the channel ID isn't a valid number — callers
 * fall back to the brand default. Logs a one-time warning per tier unless
 * `warnOnMissing: false` (used by read-only UI checks like
 * isMerchantTierProvisioned, which run on every render and shouldn't spam
 * the log).
 */
export function getMerchantTierChannelConfig(
	tier: MerchantTier,
	options: { warnOnMissing?: boolean } = {},
): MerchantTierChannelConfig | null {
	const prefix = `KIBBLE_TIER_${tier.toUpperCase()}`;
	const channelIdRaw = env[`${prefix}_CHANNEL_ID`];
	const storefrontToken = env[`${prefix}_STOREFRONT_TOKEN`];
	const channelId = channelIdRaw ? Number(channelIdRaw) : NaN;

	if (!channelIdRaw || !storefrontToken || !Number.isFinite(channelId)) {
		if (options.warnOnMissing !== false && !warnedMissingTiers.has(tier)) {
			warnedMissingTiers.add(tier);
			console.warn(
				`[merchant-tier] ${tier} tier is not provisioned (${prefix}_CHANNEL_ID / ${prefix}_STOREFRONT_TOKEN missing or invalid); falling back to the default channel.`,
			);
		}
		return null;
	}

	return { channelId, storefrontToken };
}

/** True when a tier's env pair is present and valid. Drives the toggle UI's "not yet provisioned" labeling. */
export function isMerchantTierProvisioned(tier: MerchantTier): boolean {
	return getMerchantTierChannelConfig(tier, { warnOnMissing: false }) !== null;
}

/** Test-only: clear the one-time warning dedupe between test cases. */
export function resetMerchantTierWarnings(): void {
	warnedMissingTiers.clear();
}
