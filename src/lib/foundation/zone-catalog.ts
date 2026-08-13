/**
 * Cross-repository zone inventory.
 *
 * This is a maintenance catalog, not a runtime dependency on bealls-aisles.
 * It records the complete currently-defined union and the explicit decision
 * for each external-only family. Runtime Aisles continues to accept only
 * `ZONES` from `./zones`.
 */

import { ZONES, type Multiplicity, type ZoneId } from './zones';

export type ZoneCatalogOrigin = 'aisles' | 'bealls-aisles' | 'both';
export type ZoneSchemaStatus = 'explicit' | 'external-reference';
export type ZoneFallbackStatus = 'registered' | 'hidden' | 'external-reference';
export type AutonomyEligibility = 'eligible' | 'fixed-only' | 'not-runtime-applicable';

export interface ZoneCatalogDefinition {
	origin: 'aisles' | 'bealls-aisles';
	surface: string;
	multiplicity: Multiplicity;
	maxIndex?: number;
	maxItems?: number;
	engineComposable: boolean;
	adminAuthorable: boolean;
}

export interface SurfaceCatalogEntry {
	surfaceId: string;
	origin: 'aisles' | 'bealls-aisles' | 'both';
	/** No aliases are applied at runtime. This exists only where route evidence proves the relation. */
	aislesEquivalent: string | null;
}

export interface ZoneCatalogEntry {
	zoneId: string;
	origin: ZoneCatalogOrigin;
	/** Who owns the surrounding mandatory page structure. Zones never own it. */
	requiredScaffoldOwner: 'route' | 'foundation-renderer';
	definitions: readonly ZoneCatalogDefinition[];
	schemaStatus: ZoneSchemaStatus;
	fallbackStatus: ZoneFallbackStatus;
	/** Eligibility is authority only. It does not imply model approval or publication. */
	autonomyEligibility: AutonomyEligibility;
	/** Route adoption is independent of policy eligibility and schema coverage. */
	runtimeAdoption: 'not-adopted';
	/** Explicitly records why a union member is not an Aisles runtime zone. */
	aislesRuntimeDecision: 'defined' | 'not-defined';
}

const beallsOnly = [
	['home.brand-spotlight', 'home', 'singleton'],
	['plp.banner', 'plp', 'singleton'],
	['plp.between-thirds', 'plp', 'singleton'],
	['plp.empty-state', 'plp', 'singleton'],
	['pdp.below-recs', 'pdp', 'singleton'],
	['cart.below-fold', 'cart', 'array', undefined, 2],
	['cart.empty-state', 'cart', 'singleton'],
	['search.zero-results-rescue', 'search', 'array', undefined, 3],
	['account.welcome', 'account', 'singleton'],
	['account.dashboard-pick', 'account', 'indexed', 4],
	['locator.editorial-intro', 'locator', 'singleton'],
] as const satisfies readonly (readonly [string, string, Multiplicity, number?, number?])[];

const beallsSharedOverrides: Partial<Record<ZoneId, Partial<ZoneCatalogDefinition>>> = {
	'home.featured-row': { maxIndex: 6 },
	'home.below-fold': { engineComposable: true },
	'plp.below-grid': { engineComposable: false },
	'error-404.rescue': { multiplicity: 'array', maxItems: 3 },
};

function definitionFromAisles(zoneId: ZoneId): ZoneCatalogDefinition {
	const zone = ZONES[zoneId];
	return { origin: 'aisles', ...zone };
}

function definitionFromBealls(zoneId: ZoneId): ZoneCatalogDefinition {
	const zone = ZONES[zoneId];
	return {
		origin: 'bealls-aisles',
		...zone,
		...(beallsSharedOverrides[zoneId] ?? {}),
	};
}

function scaffoldOwner(surface: string): ZoneCatalogEntry['requiredScaffoldOwner'] {
	return surface === 'pdp' || surface === 'cart' || surface === 'checkout'
		? 'route'
		: 'foundation-renderer';
}

function fallbackStatus(zoneId: ZoneId): ZoneFallbackStatus {
	// Kept deliberately explicit: a new Aisles zone cannot inherit a fallback
	// decision merely by being omitted from the registry.
	const registered = new Set<ZoneId>([
		'home.hero', 'home.below-fold', 'checkout.assurance-strip',
		'search.empty-state', 'error-404.rescue', 'error-empty.rescue',
	]);
	return registered.has(zoneId) ? 'registered' : 'hidden';
}

const aislesEntries = Object.fromEntries(
	(Object.keys(ZONES) as ZoneId[]).map((zoneId) => {
		const aisles = definitionFromAisles(zoneId);
		return [zoneId, {
			zoneId,
			origin: 'both' as const,
			requiredScaffoldOwner: scaffoldOwner(aisles.surface),
			definitions: [aisles, definitionFromBealls(zoneId)],
			schemaStatus: 'explicit' as const,
			fallbackStatus: fallbackStatus(zoneId),
			autonomyEligibility: aisles.engineComposable ? 'eligible' as const : 'fixed-only' as const,
			runtimeAdoption: 'not-adopted' as const,
			aislesRuntimeDecision: 'defined' as const,
		} satisfies ZoneCatalogEntry];
	}),
) as unknown as Record<ZoneId, ZoneCatalogEntry>;

const beallsOnlyEntries = Object.fromEntries(beallsOnly.map(([zoneId, surface, multiplicity, maxIndex, maxItems]) => [
	zoneId,
	{
		zoneId,
		origin: 'bealls-aisles' as const,
		requiredScaffoldOwner: scaffoldOwner(surface),
		definitions: [{
			origin: 'bealls-aisles' as const, surface, multiplicity,
			...(maxIndex === undefined ? {} : { maxIndex }),
			...(maxItems === undefined ? {} : { maxItems }),
			engineComposable: true, adminAuthorable: true,
		}],
		schemaStatus: 'external-reference' as const,
		fallbackStatus: 'external-reference' as const,
		autonomyEligibility: 'not-runtime-applicable' as const,
		runtimeAdoption: 'not-adopted' as const,
		aislesRuntimeDecision: 'not-defined' as const,
	} satisfies ZoneCatalogEntry,
])) as Record<string, ZoneCatalogEntry>;

/** Version bumps whenever a zone membership or explicit catalog decision changes. */
export const ZONE_CATALOG_VERSION = '2026-08-13.1';
export const ZONE_CATALOG: Readonly<Record<string, ZoneCatalogEntry>> = { ...aislesEntries, ...beallsOnlyEntries };
export const ZONE_CATALOG_IDS = Object.keys(ZONE_CATALOG).sort();

/** Source-surface inventory; category is intentionally not silently aliased to plp. */
export const SURFACE_CATALOG = [
	{ surfaceId: 'home', origin: 'both', aislesEquivalent: 'home' },
	{ surfaceId: 'plp', origin: 'both', aislesEquivalent: 'plp' },
	{ surfaceId: 'pdp', origin: 'both', aislesEquivalent: 'pdp' },
	{ surfaceId: 'cart', origin: 'both', aislesEquivalent: 'cart' },
	{ surfaceId: 'checkout', origin: 'both', aislesEquivalent: 'checkout' },
	{ surfaceId: 'search', origin: 'both', aislesEquivalent: 'search' },
	{ surfaceId: 'error-404', origin: 'both', aislesEquivalent: 'error-404' },
	{ surfaceId: 'error-empty', origin: 'both', aislesEquivalent: 'error-empty' },
	{ surfaceId: 'account', origin: 'bealls-aisles', aislesEquivalent: null },
	{ surfaceId: 'locator', origin: 'bealls-aisles', aislesEquivalent: null },
	{ surfaceId: 'style-guide', origin: 'bealls-aisles', aislesEquivalent: null },
	{ surfaceId: 'category', origin: 'bealls-aisles', aislesEquivalent: null },
] as const satisfies readonly SurfaceCatalogEntry[];
