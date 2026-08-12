/**
 * Versioned layout cache backed by Upstash Redis.
 *
 * The key describes the trusted merchant, contract/policy boundary, render
 * surface, complete generation input, and synthetic identity. Values retain
 * the exact provenance envelope written on a miss. Unversioned legacy values
 * are deliberately treated as misses.
 */

import { env } from '$env/dynamic/private';
import { LayoutSchema, type Layout } from '$lib/schema/layout';
import { LayoutProvenanceSchema, stableHash, type LayoutProvenance } from './layout-provenance';

const LAYOUT_TTL_S = 60 * 60;
const CACHE_PREFIX = 'aisles:layout:v2';

export interface CachedLayout {
	layout: Layout;
	provenance: LayoutProvenance;
}

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

export function layoutCacheKey(provenance: LayoutProvenance): string {
	const parsed = LayoutProvenanceSchema.parse(provenance);
	const reference = parsed.reference.status === 'contracted'
		? `${parsed.reference.id}@${parsed.reference.version}`
		: 'uncontracted_legacy';
	const capabilityHash = stableHash(parsed.autonomy.effectiveCapabilities);

	return [
		CACHE_PREFIX,
		'org', encode(parsed.organizationId),
		'brand', encode(parsed.brandId),
		'reference', encode(reference),
		'policy', encode(parsed.policyVersion),
		'surface', parsed.surface,
		'route', encode(parsed.route),
		'viewport', parsed.viewportClass,
		'preset', parsed.autonomy.preset ?? 'none',
		'capabilities', capabilityHash,
		'decision', parsed.autonomy.decisionMode,
		'publication', parsed.autonomy.publicationMode,
		'renderer', encode(`${parsed.renderer.componentId}@${parsed.renderer.variantId}`),
		'catalog', parsed.catalogVersion,
		'input', parsed.inputHash,
		'shopper', parsed.shopperContextHash,
		'picks', parsed.picksHash ?? 'none',
		'incentive', parsed.incentiveHash ?? 'none',
		'persona', encode(parsed.persona),
		'synthetic', parsed.synthetic.value ? encode(parsed.synthetic.scenarioId!) : 'real',
		'prompt', encode(parsed.promptVersion),
		'schema', encode(parsed.schemaVersion),
	].join(':');
}

/**
 * Preserve the older helper export for non-authoritative UI fingerprints.
 * Cache authority comes from the complete provenance envelope above.
 */
export function hashPicks(picksContext?: string): string | undefined {
	return picksContext ? stableHash(picksContext) : undefined;
}

export function parseCachedLayoutValue(value: unknown): CachedLayout | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const candidate = value as { layout?: unknown; provenance?: unknown };
	if (!Object.prototype.hasOwnProperty.call(candidate, 'layout')) return null;
	const layout = LayoutSchema.safeParse(candidate.layout);
	if (!layout.success) return null;
	const provenance = LayoutProvenanceSchema.safeParse(candidate.provenance);
	if (!provenance.success) return null;
	return { layout: layout.data, provenance: provenance.data };
}

export async function getCachedLayout(provenance: LayoutProvenance): Promise<CachedLayout | null> {
	const r = await getRedis();
	if (!r) return null;

	try {
		const requestKey = layoutCacheKey(provenance);
		const cached = parseCachedLayoutValue(await r.get<unknown>(requestKey));
		if (!cached || layoutCacheKey(cached.provenance) !== requestKey) return null;
		return cached;
	} catch {
		return null;
	}
}

export async function cacheLayout(
	provenance: LayoutProvenance,
	layout: Layout,
): Promise<void> {
	const r = await getRedis();
	if (!r) return;

	try {
		const value: CachedLayout = { layout, provenance: LayoutProvenanceSchema.parse(provenance) };
		const ttl = provenance.picksHash || provenance.incentiveHash
			? Math.floor(LAYOUT_TTL_S / 4)
			: LAYOUT_TTL_S;
		await r.set(layoutCacheKey(provenance), value, { ex: ttl });
	} catch {
		// Cache write failure is non-fatal.
	}
}

/**
 * Invalidate current and old layout caches. Targeted invalidation matches the
 * explicit route and shopper persona markers in v2 keys; no old cache value is
 * read as if it carried provenance.
 */
export async function invalidateLayoutCache(persona?: string, categorySlug?: string): Promise<number> {
	const r = await getRedis();
	if (!r) return 0;

	try {
		const keys: string[] = [];
		let cursor = 0;
		do {
			const [newCursor, found] = await r.scan(cursor, { match: 'aisles:layout:*', count: 100 });
			cursor = Number(newCursor);
			keys.push(...found);
		} while (cursor !== 0);

		const selected = persona && categorySlug
			? keys.filter((key) => (
				key.includes(`:route:${encode(routeForCategory(categorySlug))}:`)
				&& key.includes(`:persona:${encode(persona)}:`)
			))
			: keys;
		if (selected.length === 0) return 0;
		return await r.del(...selected);
	} catch {
		return 0;
	}
}

function encode(value: string): string {
	return encodeURIComponent(value);
}

function routeForCategory(categorySlug: string): string {
	return categorySlug === 'home' ? '/' : `/category/${categorySlug}`;
}
