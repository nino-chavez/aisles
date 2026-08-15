/**
 * Zone catalog — the foundation's named insertion points.
 *
 * A zone is a stable, typed insertion point on a surface (page). Today
 * Aisles composes an entire page as a single AI-authored `sections` array
 * (see `$lib/schema/layout.ts`); zones are a narrower, more resilient
 * complement — a fixed set of named slots that always resolve to
 * *something*, even when the AI composer has no signal for that slot.
 *
 * Resolution cascade:  engine output -> admin-authored content -> static
 * fallback. Every zone below either has a fallback in `./fallbacks/` or is
 * deliberately Hidden (renders no DOM) until one is warranted — see the
 * per-zone comments and the corresponding fallback file for the reasoning.
 *
 * Zone schemas live in `./zone-schemas.ts`. The cascade resolver lives in
 * `./resolve-zone.ts`. Ported from bealls-aisles' foundation layer and
 * adapted to Aisles' generic multi-brand component vocabulary — see the
 * per-zone comments below for what changed and why.
 */

import { freezeAuthorityGraph } from './authority-immutability';

export type Surface =
	| 'home'
	| 'plp'
	| 'pdp'
	| 'cart'
	| 'checkout'
	| 'search'
	| 'account'
	| 'locator'
	| 'error-404'
	| 'error-empty';

/**
 * - `singleton` — one zone instance; ID is the family name (e.g., `home.hero`).
 * - `indexed` — fixed-cardinality family; instances are `{family}.{1..maxIndex}`.
 * - `array` — variable-length list; the instance ID is the family name and the
 *   resolver returns an array of content (engine/admin can supply 0..maxItems).
 */
export type Multiplicity = 'singleton' | 'indexed' | 'array';

export interface ZoneMetadata {
	surface: Surface;
	multiplicity: Multiplicity;
	/** For `indexed` zones: max valid index (1-based, inclusive). */
	maxIndex?: number;
	/** For `array` zones: max number of items the resolver returns. */
	maxItems?: number;
	/** Can the AI engine target this zone via its surface schema? */
	engineComposable: boolean;
	/** Can merchants author content here via an admin app? Aisles has no
	 *  admin app yet — this stays forward-looking metadata, always false
	 *  effectively at runtime since no caller ever supplies adminContent. */
	adminAuthorable: boolean;
}

export const ZONES = freezeAuthorityGraph({
	// Home — wide latitude, AI composes most zones
	'home.hero': { surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	// maxIndex 3, not bealls' 6 — Aisles' home page composes 1-8 sections
	// total (LayoutSchema), so a 6-wide featured row would crowd the page.
	'home.featured-row': { surface: 'home', multiplicity: 'indexed', maxIndex: 3, engineComposable: true, adminAuthorable: true },
	// Photo-led zone (image-gallery / category-tile-grid). No fallback:
	// BrandConfig carries no image field for either shape — see
	// fallbacks/home.ts for the field this depends on.
	'home.editorial-strip': { surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'home.below-fold': { surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },

	// PLP (category) — medium latitude
	'plp.editorial-header': { surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	// The canonical catalog grid owns its structure. This local identity may
	// only rank the server-reloaded first eight catalog IDs; it never creates a
	// second merchandising row or changes the remaining page.
	'plp.product-ranking': { surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: false },
	// Optional copy-led block used by the bounded Kibble presentation demo.
	// Hidden is the merchant baseline; a live model may only select one
	// registered copy variant and its visibility for this exact instance.
	'plp.marketing-block': { surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	// Themed merchandising row (e.g. "New Arrivals", "Under $200"). Engine
	// composes when it detects a worthwhile cluster; no static default.
	'plp.cluster-row': { surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'plp.below-grid': { surface: 'plp', multiplicity: 'singleton', engineComposable: false, adminAuthorable: true },

	// PDP (product) — narrow latitude, scaffold-fixed; only insertion zones
	// declared here. Gallery, title, price, add-to-cart, and description are
	// rendered directly by the product route, not zone-targeted.
	'pdp.below-description': { surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'pdp.related': { surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'pdp.cross-sell': { surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'pdp.recently-viewed': { surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: false },

	// Cart — fixed scaffold (line items, summary, CTA render directly from
	// cart state); only the upsell zone is zone-targeted.
	'cart.above-checkout-cta': { surface: 'cart', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	// Copy-only recovery for a disconnected or empty cart. It never supplies
	// line items, prices, totals, checkout state, or an upsell candidate.
	'cart.empty-state': { surface: 'cart', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },

	// Checkout — narrowest latitude
	'checkout.assurance-strip': { surface: 'checkout', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'checkout.last-chance-upsell': { surface: 'checkout', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },

	// Search — empty/zero-result rescue. A single copy-only zone; product-
	// or image-backed rescue rows were dropped, see fallbacks/search.ts.
	'search.empty-state': { surface: 'search', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },

	// Error / empty rescues — copy-only, shared shape across surfaces that
	// land on a dead end (404, or any surface with zero results to show).
	'error-404.rescue': { surface: 'error-404', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	'error-empty.rescue': { surface: 'error-empty', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
} as const satisfies Record<string, ZoneMetadata>);

/** Family-level zone ID (e.g., `home.featured-row`, not `home.featured-row.1`). */
export type ZoneId = keyof typeof ZONES;

export const ZONE_IDS: readonly ZoneId[] = Object.freeze(Object.keys(ZONES) as ZoneId[]);

// ─── Instance ID helpers ───────────────────────────────────────────

/**
 * A zone instance ID is the string the engine and admin actually emit.
 * For singleton + array zones, the instance ID is the family ID.
 * For indexed zones, the instance ID is `{family}.{index}` (1-based).
 */
export type ZoneInstanceId = string;

const INDEXED_INSTANCE_RE = /^(.+)\.(\d+)$/;

/**
 * Parse a zone instance ID into its family + optional index. Returns null if
 * the ID does not match a known family.
 */
export function parseZoneInstance(id: ZoneInstanceId): {
	family: ZoneId;
	index?: number;
} | null {
	if (hasOwnZone(id)) {
		// Direct match — singleton or array zone (or someone passed the family of an indexed zone)
		return { family: id as ZoneId };
	}
	const match = INDEXED_INSTANCE_RE.exec(id);
	if (match) {
		const [, candidate, indexStr] = match;
		if (hasOwnZone(candidate)) {
			const meta = ZONES[candidate as ZoneId] as ZoneMetadata;
			if (meta.multiplicity === 'indexed' && meta.maxIndex) {
				const index = Number(indexStr);
				if (index >= 1 && index <= meta.maxIndex) {
					return { family: candidate as ZoneId, index };
				}
			}
		}
	}
	return null;
}

function hasOwnZone(id: string): id is ZoneId {
	return Object.prototype.hasOwnProperty.call(ZONES, id);
}

/** Enumerate all valid instance IDs in the catalog (for tests + future admin UI). */
export function enumerateZoneInstances(): ZoneInstanceId[] {
	const out: ZoneInstanceId[] = [];
	for (const id of ZONE_IDS) {
		const meta = ZONES[id] as ZoneMetadata;
		if (meta.multiplicity === 'indexed' && meta.maxIndex) {
			for (let i = 1; i <= meta.maxIndex; i++) out.push(`${id}.${i}`);
		} else {
			out.push(id);
		}
	}
	return out;
}

/** Filter the catalog to a single surface (for surface-typed schema generation). */
export function zonesForSurface(surface: Surface): ZoneId[] {
	return ZONE_IDS.filter((id) => ZONES[id].surface === surface);
}
