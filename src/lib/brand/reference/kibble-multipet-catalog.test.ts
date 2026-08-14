import { describe, expect, it } from 'vitest';
import { KIBBLE_MERCHANDISING_PRODUCTS } from './kibble-merchandising-graph';
import {
	KIBBLE_MULTIPET_CATALOG,
	KibbleMultipetCatalogSchema,
	getKibbleMultipetProductsForSpecies,
	kibbleMultipetCatalogCoverage,
} from './kibble-multipet-catalog';

const FORBIDDEN_KEYS = new Set([
	'merchant-approved',
	'stockQuantity',
	'inventory',
	'weight',
	'dimensions',
	'image',
]);

function collectKeys(value: unknown, keys: string[] = []): string[] {
	if (Array.isArray(value)) {
		for (const item of value) collectKeys(item, keys);
		return keys;
	}
	if (value && typeof value === 'object') {
		for (const [key, child] of Object.entries(value)) {
			keys.push(key);
			collectKeys(child, keys);
		}
	}
	return keys;
}

function rolesFor(species: 'cat' | 'bird' | 'snake' | 'bearded-dragon') {
	return new Set(getKibbleMultipetProductsForSpecies(species).map(({ metadata }) => metadata.productRole));
}

describe('Kibble multi-pet research catalog', () => {
	it('parses the strict source manifest at module load', () => {
		expect(KibbleMultipetCatalogSchema.parse(KIBBLE_MULTIPET_CATALOG)).toBeTruthy();
		expect(KIBBLE_MULTIPET_CATALOG.schemaVersion).toBe('1.0');
		expect(KIBBLE_MULTIPET_CATALOG.catalogId).toBe('kibble-multipet-research-2026-08-14');
		expect(KIBBLE_MULTIPET_CATALOG.currency).toBe('USD');
		expect(KIBBLE_MULTIPET_CATALOG.retrievedAt).toBe('2026-08-14');
	});

	it('registers 33 unique research candidates on top of the fixed 49-product dog catalog', () => {
		const products = KIBBLE_MULTIPET_CATALOG.products;
		expect(products).toHaveLength(33);
		expect(KIBBLE_MERCHANDISING_PRODUCTS).toHaveLength(49);
		expect(KIBBLE_MERCHANDISING_PRODUCTS.length + products.length).toBe(82);
		expect(new Set(products.map(({ id }) => id)).size).toBe(33);
		expect(new Set(products.map(({ sku }) => sku)).size).toBe(33);
		expect(new Set(products.map(({ source }) => source.url)).size).toBe(33);
		expect(products.every(({ readiness }) => readiness === 'research-candidate')).toBe(true);
		expect(products.every(({ price, source }) => price === source.price)).toBe(true);
	});

	it('counts species applicability without duplicating the four shared reptile SKUs', () => {
		expect(kibbleMultipetCatalogCoverage).toEqual({
			candidates: 33,
			cat: 11,
			bird: 7,
			snake: 8,
			beardedDragon: 11,
			sharedSnakeAndBeardedDragon: 4,
		});
		const shared = KIBBLE_MULTIPET_CATALOG.products.filter(({ metadata }) => metadata.species.length === 2);
		expect(shared).toHaveLength(4);
		expect(shared.every(({ metadata }) =>
			metadata.species.includes('snake') && metadata.species.includes('bearded-dragon')
		)).toBe(true);
	});

	it('covers the intended category-specific product roles', () => {
		expect(rolesFor('cat')).toEqual(new Set(['staple-food', 'litter', 'treat', 'feeding', 'enrichment', 'travel']));
		expect(rolesFor('bird')).toEqual(new Set(['staple-food', 'topper', 'enrichment', 'habitat', 'travel']));
		expect(rolesFor('snake')).toEqual(new Set([
			'substrate', 'hide', 'heat-source', 'environment-control', 'environment-monitor', 'hydration',
		]));
		expect(rolesFor('bearded-dragon')).toEqual(new Set([
			'staple-food', 'uvb-lighting', 'lighting-fixture', 'heat-source', 'hide',
			'environment-control', 'environment-monitor', 'hydration',
		]));
	});

	it('requires profiles and stop conditions for every bird and reptile candidate', () => {
		for (const product of KIBBLE_MULTIPET_CATALOG.products) {
			const isBirdOrReptile = product.metadata.species.some((species) => species !== 'cat');
			if (isBirdOrReptile) {
				expect(product.metadata.selectionMode, product.id).toBe('profile-required');
				expect(product.metadata.stopConditions.length, product.id).toBeGreaterThan(0);
			}
		}
		expect(getKibbleMultipetProductsForSpecies('bird').every(({ metadata }) =>
			metadata.selectionMode === 'profile-required'
		)).toBe(true);
	});

	it('preserves the required safety inputs for food, habitat, and environment selection', () => {
		const byId = new Map(KIBBLE_MULTIPET_CATALOG.products.map((product) => [product.id, product]));
		for (const product of getKibbleMultipetProductsForSpecies('cat').filter(({ metadata }) => metadata.productRole === 'staple-food')) {
			expect(product.metadata.requiredProfileFields, product.id).toEqual(expect.arrayContaining([
				'lifeStage', 'dietaryRestrictions', 'foodAllergies',
			]));
		}
		expect(byId.get('cat-frisco-airline-carrier-black')?.metadata.requiredProfileFields).toEqual(expect.arrayContaining([
			'petLength', 'petHeight', 'petWeight', 'airline',
		]));
		expect(byId.get('cat-frisco-pinata-wand')?.metadata.stopConditions.join(' ')).toContain('age threshold');
		expect(byId.get('cat-frisco-pinata-wand')?.metadata.stopConditions.join(' ')).toContain('damaged');

		for (const product of getKibbleMultipetProductsForSpecies('bird').filter(({ metadata }) =>
			['staple-food', 'topper'].includes(metadata.productRole)
		)) {
			expect(product.metadata.requiredProfileFields, product.id).toEqual(expect.arrayContaining(['birdSpecies', 'lifeStage']));
		}
		expect(byId.get('bird-harrisons-adult-lifetime-fine-1lb')?.metadata.requiredProfileFields).toEqual(expect.arrayContaining([
			'breedingOrMolting', 'dietTransitionStatus',
		]));
		for (const id of ['bird-prevue-small-flight-cage-white', 'bird-prevue-travel-cage']) {
			expect(byId.get(id)?.metadata.requiredProfileFields).toEqual(expect.arrayContaining([
				'birdSpecies', 'birdSize', 'barSpacingNeed', 'occupancyCount',
			]));
		}

		for (const product of getKibbleMultipetProductsForSpecies('snake').filter(({ metadata }) => metadata.productRole === 'substrate')) {
			expect(product.metadata.requiredProfileFields, product.id).toEqual(expect.arrayContaining(['snakeSpecies', 'humidityTarget']));
		}
		for (const product of KIBBLE_MULTIPET_CATALOG.products.filter(({ metadata }) =>
			['heat-source', 'environment-control', 'uvb-lighting'].includes(metadata.productRole)
		)) {
			expect(product.metadata.requiredProfileFields, product.id).toEqual(expect.arrayContaining([
				'enclosureDimensions', 'currentTemperatureRange', 'targetTemperatureRange',
				'existingFixtureController', 'wattageCapacity',
			]));
		}
		expect(byId.get('beardie-zoomed-reptisun-10-t5-34in')?.metadata.requiredProfileFields).toEqual(expect.arrayContaining([
			'fixtureLength', 'baskingDistance',
		]));
		expect(byId.get('reptile-exoterra-water-dish-large')?.metadata.requiredProfileFields).toEqual(expect.arrayContaining([
			'animalSize', 'enclosureDimensions',
		]));
	});

	it('keeps adult and juvenile bearded-dragon foods mutually gated by life stage', () => {
		const byId = new Map(KIBBLE_MULTIPET_CATALOG.products.map((product) => [product.id, product]));
		expect(byId.get('beardie-flukers-buffet-adult-7-5oz')?.metadata.stopConditions.join(' ')).toContain('confirmed adult');
		expect(byId.get('beardie-flukers-buffet-juvenile-8-5oz')?.metadata.stopConditions.join(' ')).toContain('confirmed juvenile');
		for (const product of getKibbleMultipetProductsForSpecies('bearded-dragon').filter(({ metadata }) => metadata.productRole === 'staple-food')) {
			expect(product.metadata.requiredProfileFields, product.id).toEqual(expect.arrayContaining(['lifeStage', 'currentDiet']));
		}
	});

	it('gives every species replenishment coverage and at least one profile-gated choice', () => {
		for (const species of ['cat', 'bird', 'snake', 'bearded-dragon'] as const) {
			const products = getKibbleMultipetProductsForSpecies(species);
			expect(products.some(({ metadata }) => metadata.repeatScenario === 'consumable-repeat'), species).toBe(true);
			expect(products.some(({ metadata }) => metadata.selectionMode === 'profile-required'), species).toBe(true);
		}
	});

	it('omits live-commerce and merchant-approval fields from the research manifest', () => {
		const keys = collectKeys(KIBBLE_MULTIPET_CATALOG);
		for (const forbidden of FORBIDDEN_KEYS) {
			expect(keys, forbidden).not.toContain(forbidden);
		}
		expect(JSON.stringify(KIBBLE_MULTIPET_CATALOG)).not.toContain('merchant-approved');
	});
});
