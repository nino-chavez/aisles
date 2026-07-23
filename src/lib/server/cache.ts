/**
 * Layout cache backed by Upstash Redis.
 *
 * Caches generated layouts by persona + category slug.
 * First visitor generates (8-13s), subsequent visitors get sub-100ms.
 *
 * Falls back gracefully — cache miss just means a fresh generation.
 */

import { env } from '$env/dynamic/private';
import type { Layout } from '$lib/schema/layout';

const LAYOUT_TTL_S = 60 * 60; // 1 hour

let redis: import('@upstash/redis').Redis | null = null;
let initialized = false;

async function getRedis(): Promise<import('@upstash/redis').Redis | null> {
	if (initialized) return redis;
	initialized = true;

	const url = env.KV_REST_API_URL;
	const token = env.KV_REST_API_TOKEN;
	if (!url || !token) return null;

	try {
		const { Redis } = await import('@upstash/redis');
		redis = new Redis({ url, token });
		return redis;
	} catch {
		return null;
	}
}

function layoutKey(persona: string, categorySlug: string, picksHash?: string): string {
	const base = `aisles:layout:${persona}:${categorySlug}`;
	return picksHash ? `${base}:picks:${picksHash}` : base;
}

/**
 * Simple hash of picks IDs for cache key differentiation.
 * Empty/undefined picks returns undefined (use standard cache).
 */
export function hashPicks(picksContext?: string): string | undefined {
	if (!picksContext) return undefined;
	// Simple hash: sum of char codes mod a large prime
	let hash = 0;
	for (let i = 0; i < picksContext.length; i++) {
		hash = ((hash << 5) - hash + picksContext.charCodeAt(i)) | 0;
	}
	return Math.abs(hash).toString(36);
}

/**
 * Get a cached layout for a persona + category + picks combination.
 * Returns null on cache miss or any error.
 */
export async function getCachedLayout(persona: string, categorySlug: string, picksHash?: string): Promise<Layout | null> {
	const r = await getRedis();
	if (!r) return null;

	try {
		return await r.get<Layout>(layoutKey(persona, categorySlug, picksHash));
	} catch {
		return null;
	}
}

/**
 * Store a generated layout in the cache.
 */
export async function cacheLayout(persona: string, categorySlug: string, layout: Layout, picksHash?: string): Promise<void> {
	const r = await getRedis();
	if (!r) return;

	try {
		// Picks-specific layouts get shorter TTL (picks change more often)
		const ttl = picksHash ? Math.floor(LAYOUT_TTL_S / 4) : LAYOUT_TTL_S;
		await r.set(layoutKey(persona, categorySlug, picksHash), layout, { ex: ttl });
	} catch {
		// Cache write failure is non-fatal
	}
}

/**
 * Invalidate cached layouts. Called after enrichment runs or manual flush.
 * If no args, invalidates all layout caches.
 */
export async function invalidateLayoutCache(persona?: string, categorySlug?: string): Promise<number> {
	const r = await getRedis();
	if (!r) return 0;

	try {
		if (persona && categorySlug) {
			return await r.del(layoutKey(persona, categorySlug));
		}

		// Scan and delete all layout keys
		const keys: string[] = [];
		let cursor = 0;
		do {
			const [newCursor, found] = await r.scan(cursor, { match: 'aisles:layout:*', count: 100 });
			cursor = Number(newCursor);
			keys.push(...found);
		} while (cursor !== 0);

		if (keys.length === 0) return 0;
		return await r.del(...keys);
	} catch {
		return 0;
	}
}
