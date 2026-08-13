/** Versioned union inventory for Aisles and the pinned Bealls Aisles snapshot. */

import { BRAND_IDS } from '$lib/brand/config';
import { getFallback } from './fallbacks';
import { BEALLS_ZONE_SNAPSHOT, type ZoneImplementationFacts } from './zone-coverage-snapshot';
import { ZONE_IDS, ZONES, parseZoneInstance, type Multiplicity, type Surface, type ZoneId } from './zones';

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

/** A concrete, executable entry in the reviewed Aisles + Bealls union. */
export interface TrustedZoneIdentityDefinition {
	origin: 'aisles' | 'bealls-aisles';
	familyId: string;
	instanceId: string;
	surface: Surface;
	/** Only locally implemented Aisles shapes may reach the generic renderer. */
	rendererContract: 'aisles-renderer' | 'trusted-hidden';
}

export interface TrustedAislesZoneIdentityDefinition extends TrustedZoneIdentityDefinition {
	origin: 'aisles';
	familyId: ZoneId;
	rendererContract: 'aisles-renderer';
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

function isTrustedSurface(surface: string): surface is Surface {
	return surface === 'home' || surface === 'plp' || surface === 'pdp' || surface === 'cart' || surface === 'checkout' ||
		surface === 'search' || surface === 'account' || surface === 'locator' || surface === 'error-404' || surface === 'error-empty';
}

function trustedSurface(surface: string): Surface {
	if (!isTrustedSurface(surface)) throw new Error(`reviewed zone snapshot has unknown surface: ${surface}`);
	return surface;
}

function exactInstances(familyId: string, definition: ZoneCatalogDefinition): string[] {
	if (definition.multiplicity !== 'indexed') return [familyId];
	if (!definition.maxIndex || definition.maxIndex < 1) throw new Error(`indexed zone lacks a bounded max index: ${familyId}`);
	return Array.from({ length: definition.maxIndex }, (_, index) => `${familyId}.${index + 1}`);
}

function usesAislesRenderer(familyId: string, instanceId: string, definition: ZoneCatalogDefinition): boolean {
	const parsed = parseZoneInstance(instanceId);
	if (!parsed || parsed.family !== familyId) return false;
	const local = ZONES[parsed.family];
	const localMaxItems = 'maxItems' in local ? local.maxItems : undefined;
	return local.surface === definition.surface &&
		local.multiplicity === definition.multiplicity &&
		localMaxItems === definition.maxItems;
}

/**
 * Exact identities, not only family labels. The Bealls rows are based solely on
 * the pinned snapshot; entries without a compatible local renderer are an
 * explicit trusted Hidden boundary rather than a cast into the Aisles schema.
 */
export const TRUSTED_ZONE_IDENTITIES: readonly TrustedZoneIdentityDefinition[] = [
	...ZONE_IDS.flatMap((familyId) => exactInstances(familyId, aislesDefinition(familyId)).map((instanceId) => ({
		origin: 'aisles' as const,
		familyId,
		instanceId,
		surface: ZONES[familyId].surface,
		rendererContract: 'aisles-renderer' as const,
	}))),
	...BEALLS_ZONE_SNAPSHOT.zones.flatMap((zone) => {
		const definition = beallsDefinitions[zone.zoneId];
		return exactInstances(zone.zoneId, definition).map((instanceId) => ({
			origin: 'bealls-aisles' as const,
			familyId: zone.zoneId,
			instanceId,
			surface: trustedSurface(zone.surface),
			rendererContract: usesAislesRenderer(zone.zoneId, instanceId, definition)
				? 'aisles-renderer' as const
				: 'trusted-hidden' as const,
		}));
	}),
];

export function findTrustedZoneIdentity(
	origin: unknown,
	familyId: unknown,
	instanceId: unknown,
): TrustedZoneIdentityDefinition | null {
	if ((origin !== 'aisles' && origin !== 'bealls-aisles') || typeof familyId !== 'string' || typeof instanceId !== 'string') return null;
	return TRUSTED_ZONE_IDENTITIES.find((candidate) => candidate.origin === origin && candidate.familyId === familyId && candidate.instanceId === instanceId) ?? null;
}

/** Explicit type boundary before the local schema/fallback registry is used. */
export function isAislesRendererIdentity(identity: TrustedZoneIdentityDefinition): identity is TrustedZoneIdentityDefinition & {
	familyId: ZoneId;
	rendererContract: 'aisles-renderer';
} {
	return identity.rendererContract === 'aisles-renderer' && parseZoneInstance(identity.instanceId)?.family === identity.familyId;
}

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
export const ZONE_CATALOG: Readonly<Record<string, ZoneCatalogEntry>> = Object.fromEntries(unionIds.map((zoneId) => {
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
}));

export const ZONE_CATALOG_IDS = Object.keys(ZONE_CATALOG);

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
