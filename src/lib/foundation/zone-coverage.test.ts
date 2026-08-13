import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as ts from 'typescript';
import { parse } from 'svelte/compiler';
import { BRAND_IDS } from '$lib/brand/config';
import { getFallback } from './fallbacks';
import { TRUSTED_ZONE_IDENTITIES, ZONE_CATALOG, ZONE_CATALOG_IDS, SURFACE_ROUTE_MAPPINGS } from './zone-catalog';
import { AISLES_RENDERER_CONTRACT_SNAPSHOT, AISLES_ZONE_REGISTRY_SNAPSHOT, BEALLS_ZONE_SNAPSHOT } from './zone-coverage-snapshot';
import { ZoneSchemas } from './zone-schemas';
import { ZONE_IDS, ZONES } from './zones';

const foundationDirectory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(foundationDirectory, '../../..');
const routesRoot = resolve(sourceRoot, 'src/routes');

function filesBelow(directory: string): string[] {
	return readdirSync(directory).flatMap((entry) => {
		const path = resolve(directory, entry);
		return statSync(path).isDirectory() ? filesBelow(path) : [path];
	});
}

function resolverCallsInTypeScriptRoutes(): string[] {
	const calls: string[] = [];
	for (const path of filesBelow(routesRoot).filter((candidate) => candidate.endsWith('.ts'))) {
		const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		const visit = (node: ts.Node): void => {
			if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['resolveZone', 'resolveZoneAsync'].includes(node.expression.text)) {
				calls.push(`${path}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return calls;
}

function zoneEvidenceInSvelteRoutes(): { resolverCalls: string[]; rendererTags: string[] } {
	const evidence = { resolverCalls: [] as string[], rendererTags: [] as string[] };
	for (const path of filesBelow(routesRoot).filter((candidate) => candidate.endsWith('.svelte'))) {
		const ast = parse(readFileSync(path, 'utf8'), { filename: path, modern: true });
		const seen = new WeakSet<object>();
		const visit = (node: unknown): void => {
			if (!node || typeof node !== 'object' || seen.has(node)) return;
			seen.add(node);
			const record = node as Record<string, unknown>;
			if (record.type === 'CallExpression') {
				const callee = record.callee as { type?: string; name?: string } | undefined;
				if (callee?.type === 'Identifier' && ['resolveZone', 'resolveZoneAsync'].includes(callee.name ?? '')) evidence.resolverCalls.push(path);
			}
			if (record.type === 'Component' && record.name === 'ZoneRenderer') evidence.rendererTags.push(path);
			for (const value of Object.values(record)) {
				if (Array.isArray(value)) value.forEach(visit);
				else visit(value);
			}
		};
		visit(ast);
	}
	return evidence;
}

describe('portable zone catalog coverage', () => {
	it('uses the imported Aisles registry as the current source of truth', () => {
		expect(Object.entries(ZONES).map(([zoneId, metadata]) => ({ zoneId, ...metadata }))).toEqual(
			AISLES_ZONE_REGISTRY_SNAPSHOT,
		);
		const aislesCatalogIds = ZONE_IDS.filter((zoneId) => ZONE_CATALOG[zoneId].implementation.aisles);
		expect(aislesCatalogIds).toEqual(ZONE_IDS);
		for (const zoneId of ZONE_IDS) {
			const definition = ZONE_CATALOG[zoneId].definitions.find(({ repository }) => repository === 'aisles');
			expect(definition).toEqual({ repository: 'aisles', ...ZONES[zoneId] });
			expect(Object.prototype.hasOwnProperty.call(ZoneSchemas, zoneId)).toBe(true);
		}
	});

	it('consumes the checked-in Bealls snapshot without a sibling checkout', () => {
		const snapshotIds = BEALLS_ZONE_SNAPSHOT.zones.map(({ zoneId }) => zoneId);
		expect(ZONE_CATALOG_IDS.filter((zoneId) => BEALLS_ZONE_SNAPSHOT.zones.some((zone) => zone.zoneId === zoneId))).toEqual(snapshotIds);
		expect(new Set(snapshotIds).size).toBe(snapshotIds.length);
		expect(BEALLS_ZONE_SNAPSHOT.source.ref).toMatch(/^[a-f0-9]{40}$/);
		for (const file of BEALLS_ZONE_SNAPSHOT.source.files) {
			expect(file.path).not.toMatch(/^\//);
			expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
		}
	});

	it('keeps every external exact identity behind the trusted Hidden boundary', () => {
		const external = TRUSTED_ZONE_IDENTITIES.filter(({ origin }) => origin === 'bealls-aisles');
		expect(Object.isFrozen(TRUSTED_ZONE_IDENTITIES)).toBe(true);
		expect(TRUSTED_ZONE_IDENTITIES.every(Object.isFrozen)).toBe(true);
		expect(new Set(external.map(({ familyId }) => familyId)).size).toBe(28);
		expect(external).toHaveLength(36);
		expect(new Set(external.map(({ instanceId }) => instanceId)).size).toBe(36);
		expect(external.every(({ rendererContract }) => rendererContract === 'trusted-hidden')).toBe(true);
		expect(external.find(({ familyId }) => familyId === 'home.editorial-strip')).toMatchObject({
			rendererContract: 'trusted-hidden',
		});
	});

	it('pins the reviewed Aisles renderer and layout contracts behind materializable=yes', () => {
		for (const file of AISLES_RENDERER_CONTRACT_SNAPSHOT.files) {
			const digest = createHash('sha256').update(readFileSync(resolve(sourceRoot, file.path))).digest('hex');
			expect(digest, file.path).toBe(file.sha256);
		}
	});

	it('records current Aisles route facts from TypeScript AST evidence', () => {
		expect(resolverCallsInTypeScriptRoutes()).toEqual([]);
		expect(zoneEvidenceInSvelteRoutes()).toEqual({ resolverCalls: [], rendererTags: [] });
		expect(existsSync(resolve(foundationDirectory, 'ZoneRenderer.svelte'))).toBe(true);
		for (const zoneId of ZONE_IDS) {
			expect(ZONE_CATALOG[zoneId].implementation.aisles).toMatchObject({
				declared: true,
				schemaValidatable: true,
				rendererMaterializable: 'yes',
				routeResolved: false,
				routeRendered: false,
			});
		}
	});

	it('derives fallback status for every current brand and validates visible content', () => {
		for (const zoneId of ZONE_IDS) {
			const recorded = ZONE_CATALOG[zoneId].fallbackByAislesBrand;
			expect(Object.keys(recorded ?? {})).toEqual(BRAND_IDS);
			for (const brandId of BRAND_IDS) {
				const fallback = getFallback(zoneId, brandId);
				expect(recorded?.[brandId]).toBe(fallback === null ? 'hidden' : 'content');
				if (fallback !== null) expect(ZoneSchemas[zoneId].safeParse(fallback).success, `${brandId}:${zoneId}`).toBe(true);
			}
		}
	});

	it('retains per-brand Bealls fallback decisions from the pinned registry sources', () => {
		for (const zoneId of BEALLS_ZONE_SNAPSHOT.zones.map(({ zoneId }) => zoneId)) {
			const recorded = ZONE_CATALOG[zoneId].fallbackByBeallsBrand;
			expect(Object.keys(recorded ?? {}), zoneId).toEqual(['bealls', 'beallsflorida', 'homecentric']);
		}
		expect(ZONE_CATALOG['home.hero'].fallbackByBeallsBrand).toEqual({
			bealls: 'content', beallsflorida: 'content', homecentric: 'content',
		});
		expect(ZONE_CATALOG['pdp.below-recs'].fallbackByBeallsBrand).toEqual({
			bealls: 'content', beallsflorida: 'content', homecentric: 'hidden',
		});
		expect(ZONE_CATALOG['account.welcome'].fallbackByBeallsBrand).toEqual({
			bealls: 'hidden', beallsflorida: 'hidden', homecentric: 'hidden',
		});
	});

	it('separates route paths from normalized category and style-guide policy surfaces', () => {
		const beallsCategory = SURFACE_ROUTE_MAPPINGS.find((mapping) => mapping.repository === 'bealls-aisles' && mapping.routePath === '/category/[slug]');
		expect(beallsCategory).toMatchObject({
			zoneSurfaceId: 'plp',
			policySurfaceByBrand: { bealls: 'plp', beallsflorida: 'plp', homecentric: 'category' },
		});
		const beallsStyleGuide = SURFACE_ROUTE_MAPPINGS.find((mapping) => mapping.repository === 'bealls-aisles' && mapping.routePath === '/style-guide');
		expect(beallsStyleGuide).toMatchObject({ zoneSurfaceId: null });
		const aislesStyleGuide = SURFACE_ROUTE_MAPPINGS.find((mapping) => mapping.repository === 'aisles' && mapping.routePath === '/style-guide');
		expect(Object.values(aislesStyleGuide?.policySurfaceByBrand ?? {})).toEqual(BRAND_IDS.map(() => null));
	});

	it('retains explicit per-zone Bealls implementation facts from the pinned sources', () => {
		expect(ZONE_CATALOG['home.hero'].implementation.beallsAisles).toMatchObject({ routeResolved: true, routeRendered: true, rendererMaterializable: 'yes' });
		expect(ZONE_CATALOG['home.featured-row'].implementation.beallsAisles).toMatchObject({ routeResolved: false, routeRendered: false, rendererMaterializable: 'partial' });
		expect(ZONE_CATALOG['plp.empty-state'].implementation.beallsAisles).toMatchObject({ rendererMaterializable: 'no' });
	});
});
