/** Cross-repository maintenance gate. Runtime code never reads the sibling checkout. */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getFallback } from './fallbacks';
import { ZONE_CATALOG, ZONE_CATALOG_IDS, SURFACE_CATALOG } from './zone-catalog';
import { ZoneSchemas } from './zone-schemas';
import { ZONE_IDS, ZONES } from './zones';

const thisDirectory = dirname(fileURLToPath(import.meta.url));
const beallsZonesPath = resolve(thisDirectory, '../../../../../../bealls-aisles/src/lib/foundation/zones.ts');
const aislesRoutesPath = resolve(thisDirectory, '../..', 'routes');

function sourceFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((entry) => {
		const path = resolve(directory, entry);
		return statSync(path).isDirectory() ? sourceFiles(path) : [path];
	});
}

function sourceZoneDefinitions(path: string): Array<{ zoneId: string; surface: string; multiplicity: string; maxIndex?: number; maxItems?: number; engineComposable: boolean; adminAuthorable: boolean }> {
	const source = readFileSync(path, 'utf8');
	return [...source.matchAll(/^\s*'([^']+)':\s*\{\s*surface:\s*'([^']+)',\s*multiplicity:\s*'([^']+)'(?:,\s*maxIndex:\s*(\d+))?(?:,\s*maxItems:\s*(\d+))?,\s*engineComposable:\s*(true|false),\s*adminAuthorable:\s*(true|false)\s*\}/gm)]
		.map((match) => ({
			zoneId: match[1], surface: match[2], multiplicity: match[3],
			...(match[4] === undefined ? {} : { maxIndex: Number(match[4]) }),
			...(match[5] === undefined ? {} : { maxItems: Number(match[5]) }),
			engineComposable: match[6] === 'true', adminAuthorable: match[7] === 'true',
		}))
		.sort((a, b) => a.zoneId.localeCompare(b.zoneId));
}

describe('zone catalog coverage', () => {
	it('matches Aisles source exactly and records every Aisles zone as declared/schema-covered', () => {
		expect([...ZONE_IDS].sort()).toEqual(ZONE_CATALOG_IDS.filter((id) => ZONE_CATALOG[id].aislesRuntimeDecision === 'defined'));
		for (const zoneId of ZONE_IDS) {
			const entry = ZONE_CATALOG[zoneId];
			expect(entry.schemaStatus, zoneId).toBe('explicit');
			expect(entry.fallbackStatus, zoneId).not.toBe('external-reference');
			expect(entry.runtimeAdoption, zoneId).toBe('not-adopted');
			expect(entry.definitions.find((definition) => definition.origin === 'aisles')).toMatchObject({
				surface: ZONES[zoneId].surface,
				multiplicity: ZONES[zoneId].multiplicity,
				engineComposable: ZONES[zoneId].engineComposable,
				adminAuthorable: ZONES[zoneId].adminAuthorable,
			});
		}
	});

	it('does not mislabel schema coverage as shopper-route adoption', () => {
		const routeSource = sourceFiles(aislesRoutesPath)
			.filter((path) => /\.(?:ts|svelte)$/.test(path))
			.map((path) => readFileSync(path, 'utf8')).join('\n');
		expect(routeSource).not.toMatch(/\bresolveZone\s*\(|\bZoneRenderer\b/);
	});

	it('fails when Bealls adds or removes a zone without an explicit union-catalog decision', () => {
		const sourceDefinitions = sourceZoneDefinitions(beallsZonesPath);
		const sourceIds = sourceDefinitions.map(({ zoneId }) => zoneId);
		const catalogIds = ZONE_CATALOG_IDS;
		expect(sourceIds).toEqual(catalogIds);
		expect(sourceIds).toHaveLength(28);
		expect(ZONE_IDS).toHaveLength(17);
		for (const source of sourceDefinitions) {
			const definition = ZONE_CATALOG[source.zoneId].definitions.find((candidate) => candidate.origin === 'bealls-aisles');
			expect(definition, source.zoneId).toMatchObject({
				surface: source.surface, multiplicity: source.multiplicity,
				engineComposable: source.engineComposable, adminAuthorable: source.adminAuthorable,
				...(source.maxIndex === undefined ? {} : { maxIndex: source.maxIndex }),
				...(source.maxItems === undefined ? {} : { maxItems: source.maxItems }),
			});
		}
	});

	it('keeps every fallback decision explicit and schema-valid when visible', () => {
		for (const zoneId of ZONE_IDS) {
			const content = getFallback(zoneId, 'haven');
			if (content !== null) expect(ZoneSchemas[zoneId].safeParse(content).success, zoneId).toBe(true);
		}
	});

	it('retains source surface identity and does not alias Home Centric category to plp', () => {
		expect(SURFACE_CATALOG.find((entry) => entry.surfaceId === 'category')).toMatchObject({ aislesEquivalent: null });
		expect(SURFACE_CATALOG.find((entry) => entry.surfaceId === 'style-guide')).toMatchObject({ aislesEquivalent: null });
	});
});
