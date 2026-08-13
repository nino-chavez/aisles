/** Frozen exact identities for the reviewed Aisles + Bealls zone union. */

import { BEALLS_ZONE_SNAPSHOT } from './zone-coverage-snapshot';
import { ZONE_IDS, ZONES, parseZoneInstance, type Multiplicity, type Surface, type ZoneId } from './zones';

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

function isTrustedSurface(surface: string): surface is Surface {
	return surface === 'home' || surface === 'plp' || surface === 'pdp' || surface === 'cart' || surface === 'checkout' ||
		surface === 'search' || surface === 'account' || surface === 'locator' || surface === 'error-404' || surface === 'error-empty';
}

function trustedSurface(surface: string): Surface {
	if (!isTrustedSurface(surface)) throw new Error(`reviewed zone snapshot has unknown surface: ${surface}`);
	return surface;
}

function exactInstances(
	familyId: string,
	definition: { multiplicity: Multiplicity; maxIndex?: number },
): string[] {
	if (definition.multiplicity !== 'indexed') return [familyId];
	if (!definition.maxIndex || definition.maxIndex < 1) throw new Error(`indexed zone lacks a bounded max index: ${familyId}`);
	return Array.from({ length: definition.maxIndex }, (_, index) => `${familyId}.${index + 1}`);
}

/**
 * External labels never imply local schema compatibility. A Bealls family
 * remains trusted Hidden until it has an explicit reviewed adapter and exact
 * schema/materializer proof.
 */
const trustedZoneIdentities = [
	...ZONE_IDS.flatMap((familyId) => exactInstances(familyId, ZONES[familyId]).map((instanceId) => ({
		origin: 'aisles' as const,
		familyId,
		instanceId,
		surface: ZONES[familyId].surface,
		rendererContract: 'aisles-renderer' as const,
	}))),
	...BEALLS_ZONE_SNAPSHOT.zones.flatMap((zone) => exactInstances(zone.zoneId, zone).map((instanceId) => ({
		origin: 'bealls-aisles' as const,
		familyId: zone.zoneId,
		instanceId,
		surface: trustedSurface(zone.surface),
		rendererContract: 'trusted-hidden' as const,
	}))),
] satisfies TrustedZoneIdentityDefinition[];

export const TRUSTED_ZONE_IDENTITIES: readonly TrustedZoneIdentityDefinition[] = Object.freeze(
	trustedZoneIdentities.map((identity) => Object.freeze(identity)),
);

const issuedTrustedZoneIdentities = new WeakSet<object>(TRUSTED_ZONE_IDENTITIES);

/** Only the frozen registry objects are compiler inputs; lookalike client data is not. */
export function isIssuedTrustedZoneIdentity(value: unknown): value is TrustedZoneIdentityDefinition {
	return typeof value === 'object' && value !== null &&
		Object.getPrototypeOf(value) === Object.prototype &&
		issuedTrustedZoneIdentities.has(value);
}

export function findTrustedZoneIdentity(
	origin: unknown,
	familyId: unknown,
	instanceId: unknown,
): TrustedZoneIdentityDefinition | null {
	if ((origin !== 'aisles' && origin !== 'bealls-aisles') || typeof familyId !== 'string' || typeof instanceId !== 'string') return null;
	return TRUSTED_ZONE_IDENTITIES.find((candidate) => candidate.origin === origin && candidate.familyId === familyId && candidate.instanceId === instanceId) ?? null;
}

/** Explicit boundary before the local schema/fallback registry is used. */
export function isAislesRendererIdentity(identity: TrustedZoneIdentityDefinition): identity is TrustedAislesZoneIdentityDefinition {
	return isIssuedTrustedZoneIdentity(identity) && identity.origin === 'aisles' &&
		identity.rendererContract === 'aisles-renderer' &&
		parseZoneInstance(identity.instanceId)?.family === identity.familyId;
}
