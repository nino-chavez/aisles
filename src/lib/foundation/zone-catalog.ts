/** Versioned union inventory for Aisles and the pinned Bealls Aisles snapshot. */

import { BRAND_IDS } from '$lib/brand/config';
import { freezeAuthorityGraph } from './authority-immutability';
import { getFallback } from './fallbacks';
import { BEALLS_ZONE_SNAPSHOT, type ZoneImplementationFacts } from './zone-coverage-snapshot';
import { ZONES, type Multiplicity, type ZoneId } from './zones';

export {
	TRUSTED_ZONE_IDENTITIES,
	findTrustedZoneIdentity,
	isAislesRendererIdentity,
	isIssuedTrustedZoneIdentity,
	type TrustedAislesZoneIdentityDefinition,
	type TrustedZoneIdentityDefinition,
} from './trusted-zone-identity';

export type ZoneCatalogOrigin = 'aisles' | 'bealls-aisles' | 'both';
export type ZoneSchemaStatus = 'renderer-contract' | 'external-source-snapshot';
export type ZoneFallbackStatus = 'content' | 'hidden';
export type AutonomyEligibility = 'policy-eligible' | 'fixed-only' | 'not-applicable';

export interface ZoneCatalogDefinition {
	repository: 'aisles' | 'bealls-aisles';
	surface: string;
	multiplicity: Multiplicity;
	maxIndex?: number;
	maxItems?: number;
	engineComposable: boolean;
	adminAuthorable: boolean;
}

export interface RepositoryZoneFacts extends ZoneImplementationFacts {
	evidence: 'current-module' | 'pinned-source-snapshot';
	sourceRef: string;
}

export interface ZoneCatalogEntry {
	zoneId: string;
	origin: ZoneCatalogOrigin;
	requiredScaffoldOwner: 'route' | 'foundation-renderer';
	definitions: readonly ZoneCatalogDefinition[];
	implementation: {
		aisles?: RepositoryZoneFacts;
		beallsAisles?: RepositoryZoneFacts;
	};
	schemaStatus: ZoneSchemaStatus;
	/** Per-brand behavior derived by executing the Aisles fallback registry. */
	fallbackByAislesBrand: Readonly<Record<string, ZoneFallbackStatus>> | null;
	/** Per-brand behavior pinned to the Bealls fallback registry source snapshot. */
	fallbackByBeallsBrand: Readonly<Record<string, ZoneFallbackStatus>> | null;
	autonomyEligibility: AutonomyEligibility;
	/** The generic seam exists, but no Aisles zone is approved as a live model runtime. */
	liveModelApproved: false;
}

export interface SurfaceRouteMapping {
	repository: 'aisles' | 'bealls-aisles';
	routePath: string;
	zoneSurfaceId: string | null;
	policySurfaceByBrand: Readonly<Record<string, string | null>>;
	note: string;
}

function aislesDefinition(zoneId: ZoneId): ZoneCatalogDefinition {
	return { repository: 'aisles', ...ZONES[zoneId] };
}

const beallsDefinitions = Object.fromEntries(BEALLS_ZONE_SNAPSHOT.zones.map((zone) => [
	zone.zoneId,
	{
		repository: 'bealls-aisles' as const,
		surface: zone.surface,
		multiplicity: zone.multiplicity,
		...(zone.maxIndex === undefined ? {} : { maxIndex: zone.maxIndex }),
		...(zone.maxItems === undefined ? {} : { maxItems: zone.maxItems }),
		engineComposable: zone.engineComposable,
		adminAuthorable: zone.adminAuthorable,
	} satisfies ZoneCatalogDefinition,
])) as Readonly<Record<string, ZoneCatalogDefinition>>;

const beallsFacts = Object.fromEntries(BEALLS_ZONE_SNAPSHOT.zones.map((zone) => [
	zone.zoneId,
	{
		...zone.implementation,
		evidence: 'pinned-source-snapshot' as const,
		sourceRef: BEALLS_ZONE_SNAPSHOT.source.ref,
	} satisfies RepositoryZoneFacts,
])) as Readonly<Record<string, RepositoryZoneFacts>>;

function scaffoldOwner(surface: string): ZoneCatalogEntry['requiredScaffoldOwner'] {
	return surface === 'pdp' || surface === 'cart' || surface === 'checkout' ? 'route' : 'foundation-renderer';
}

function fallbackByBrand(zoneId: ZoneId): Readonly<Record<string, ZoneFallbackStatus>> {
	return Object.fromEntries(BRAND_IDS.map((brandId) => [
		brandId,
		getFallback(zoneId, brandId) === null ? 'hidden' : 'content',
	]));
}

const unionIds = [...new Set([...BEALLS_ZONE_SNAPSHOT.zones.map(({ zoneId }) => zoneId), ...Object.keys(ZONES)])];

export const ZONE_CATALOG_VERSION = '2026-08-13.3';
export const ZONE_CATALOG: Readonly<Record<string, ZoneCatalogEntry>> = freezeAuthorityGraph(Object.fromEntries(unionIds.map((zoneId) => {
	const isAisles = Object.prototype.hasOwnProperty.call(ZONES, zoneId);
	const aislesZoneId = zoneId as ZoneId;
	const bealls = beallsDefinitions[zoneId];
	const definitions = [
		...(isAisles ? [aislesDefinition(aislesZoneId)] : []),
		...(bealls ? [bealls] : []),
	];
	const surface = definitions[0]?.surface ?? 'unknown';
	return [zoneId, {
		zoneId,
		origin: isAisles && bealls ? 'both' : isAisles ? 'aisles' : 'bealls-aisles',
		requiredScaffoldOwner: scaffoldOwner(surface),
		definitions,
		implementation: {
			...(isAisles ? {
				aisles: {
					declared: true,
					schemaValidatable: true,
					rendererMaterializable: 'yes',
					routeResolved: false,
					routeRendered: false,
					evidence: 'current-module',
					sourceRef: ZONE_CATALOG_VERSION,
				} satisfies RepositoryZoneFacts,
			} : {}),
			...(bealls ? { beallsAisles: beallsFacts[zoneId] } : {}),
		},
		schemaStatus: isAisles ? 'renderer-contract' : 'external-source-snapshot',
		fallbackByAislesBrand: isAisles ? fallbackByBrand(aislesZoneId) : null,
		fallbackByBeallsBrand: bealls
			? BEALLS_ZONE_SNAPSHOT.zones.find((zone) => zone.zoneId === zoneId)?.fallbackByBrand ?? null
			: null,
		autonomyEligibility: !isAisles
			? 'not-applicable'
			: ZONES[aislesZoneId].engineComposable ? 'policy-eligible' : 'fixed-only',
		liveModelApproved: false,
	} satisfies ZoneCatalogEntry];
})));

export const ZONE_CATALOG_IDS: readonly string[] = Object.freeze(Object.keys(ZONE_CATALOG));

const aislesPolicySurfaceByBrand = Object.fromEntries(BRAND_IDS.map((brandId) => [brandId, 'plp']));
export const SURFACE_ROUTE_MAPPINGS: readonly SurfaceRouteMapping[] = [
	{
		repository: 'aisles',
		routePath: '/category/[slug]',
		zoneSurfaceId: 'plp',
		policySurfaceByBrand: aislesPolicySurfaceByBrand,
		note: 'The route path says category; the normalized Aisles policy and zone surface is plp.',
	},
	{
		repository: 'aisles',
		routePath: '/style-guide',
		zoneSurfaceId: null,
		policySurfaceByBrand: Object.fromEntries(BRAND_IDS.map((brandId) => [brandId, null])),
		note: 'A development/reference route with no composition-policy or zone surface.',
	},
	...BEALLS_ZONE_SNAPSHOT.routeSurfaces.map((mapping) => ({
		repository: 'bealls-aisles' as const,
		...mapping,
	})),
];
