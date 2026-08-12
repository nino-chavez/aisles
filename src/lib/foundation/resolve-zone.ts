/**
 * Zone resolver — the three-source precedence cascade.
 *
 *     engine output → admin-authored content → static fallback
 *
 * Each step can short-circuit. Engine output wins (freshest, composed for
 * this exact request). Admin content is merchant intent — no admin app
 * exists in Aisles yet, so `adminContent` is always undefined at runtime
 * today; the cascade step stays wired so a future admin app is a content
 * source, not a resolver change. Static fallback is the safety net — every
 * zone has one, even if "Hidden" (renders no DOM).
 *
 * The resolver is a pure function, called once per zone instance per
 * request. The return shape carries source attribution so a future
 * decisions-inspector view can render the cascade per zone.
 *
 * Ported from bealls-aisles' foundation layer; logic and precedence order
 * unchanged.
 */

import { ZoneSchemas } from './zone-schemas';
import { ZONES, parseZoneInstance, type ZoneId, type ZoneInstanceId, type ZoneMetadata } from './zones';
import { getFallback } from './fallbacks';

export type ZoneSource = 'engine' | 'admin' | 'fallback';

export interface ZoneResolution {
	zoneId: ZoneInstanceId;
	family: ZoneId;
	index?: number;
	source: ZoneSource;
	/** `null` indicates the Hidden semantic — render no DOM. */
	content: unknown | null;
}

export interface ResolveZoneOpts {
	/**
	 * Full instance ID (e.g., `home.hero`, `home.featured-row.1`,
	 * `pdp.related`). For singleton + array zones this is the family ID;
	 * for indexed zones it is `{family}.{index}` (1-based).
	 */
	zoneId: ZoneInstanceId;
	brandId: string;
	/** Engine composition output keyed by instance ID. Optional. */
	engineOutput?: { zones?: Record<ZoneInstanceId, unknown> };
	/**
	 * Admin-authored content keyed by instance ID. Always undefined until
	 * an admin app exists — the resolver falls through to the static
	 * fallback whenever this is omitted.
	 */
	adminContent?: { zones?: Record<ZoneInstanceId, unknown> };
}

/**
 * Resolve a single zone instance through the three-source cascade.
 *
 * Validates engine and admin content against the zone's Zod schema before
 * accepting it. Invalid content from a source is treated as if the source
 * had no content for that zone — the cascade continues.
 *
 * Throws only when `zoneId` does not match any zone in the catalog. Every
 * other path returns a `ZoneResolution`.
 */
export function resolveZone(opts: ResolveZoneOpts): ZoneResolution {
	const parsed = parseZoneInstance(opts.zoneId);
	if (!parsed) {
		throw new Error(`resolveZone: unknown zone instance "${opts.zoneId}"`);
	}
	const { family, index } = parsed;
	const meta = ZONES[family] as ZoneMetadata;
	const schema = ZoneSchemas[family];

	// 1. Engine
	const engineRaw = opts.engineOutput?.zones?.[opts.zoneId];
	if (engineRaw !== undefined && meta.engineComposable) {
		const validated = validateForZone(family, engineRaw, schema, meta);
		if (validated.ok) {
			return { zoneId: opts.zoneId, family, index, source: 'engine', content: validated.content };
		}
	}

	// 2. Admin
	const adminRaw = opts.adminContent?.zones?.[opts.zoneId];
	if (adminRaw !== undefined && meta.adminAuthorable) {
		const validated = validateForZone(family, adminRaw, schema, meta);
		if (validated.ok) {
			return { zoneId: opts.zoneId, family, index, source: 'admin', content: validated.content };
		}
	}

	// 3. Static fallback
	const content = getFallback(family, opts.brandId);
	return { zoneId: opts.zoneId, family, index, source: 'fallback', content };
}

/**
 * Validate raw zone content against the family's schema, accounting for
 * array multiplicity (each array element is validated independently).
 */
function validateForZone(
	_family: ZoneId,
	raw: unknown,
	schema: (typeof ZoneSchemas)[ZoneId],
	meta: ZoneMetadata,
): { ok: true; content: unknown } | { ok: false } {
	if (meta.multiplicity === 'array') {
		if (!Array.isArray(raw)) return { ok: false };
		if (meta.maxItems !== undefined && raw.length > meta.maxItems) return { ok: false };
		const validated: unknown[] = [];
		for (const item of raw) {
			const r = schema.safeParse(item);
			if (!r.success) return { ok: false };
			validated.push(r.data);
		}
		return { ok: true, content: validated };
	}
	const r = schema.safeParse(raw);
	if (!r.success) return { ok: false };
	return { ok: true, content: r.data };
}
