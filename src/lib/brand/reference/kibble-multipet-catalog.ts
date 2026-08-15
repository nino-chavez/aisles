import { z } from 'zod';
import catalogJson from './kibble-multipet-catalog.json';

const RequiredString = z.string().trim().min(1);
const PriceString = z.string().regex(/^\d+\.\d{2}$/);

export const KIBBLE_MULTIPET_SPECIES = ['cat', 'bird', 'snake', 'bearded-dragon'] as const;
export const KIBBLE_MULTIPET_PRODUCT_ROLES = [
	'staple-food',
	'litter',
	'treat',
	'feeding',
	'enrichment',
	'travel',
	'topper',
	'habitat',
	'substrate',
	'hide',
	'heat-source',
	'environment-control',
	'environment-monitor',
	'hydration',
	'uvb-lighting',
	'lighting-fixture',
] as const;
export const KIBBLE_MULTIPET_REPEAT_SCENARIOS = [
	'consumable-repeat',
	'replacement-reminder',
	'none',
] as const;

const KibbleMultipetSourceSchema = z.object({
	retailer: z.literal('Chewy'),
	url: z.string().url().regex(/^https:\/\/www\.chewy\.com\/.+\/dp\/\d+$/),
	retrievedAt: z.literal('2026-08-14'),
	price: PriceString,
	facts: z.array(RequiredString).min(1).max(3),
}).strict();

const KibbleMultipetMetadataSchema = z.object({
	species: z.array(z.enum(KIBBLE_MULTIPET_SPECIES)).min(1)
		.refine((species) => new Set(species).size === species.length, 'Species must be unique.'),
	productRole: z.enum(KIBBLE_MULTIPET_PRODUCT_ROLES),
	shopperJobs: z.array(RequiredString).min(1),
	needStates: z.array(RequiredString).min(1),
	selectionMode: z.enum(['direct-candidate', 'profile-required']),
	requiredProfileFields: z.array(RequiredString),
	comparisonDimensions: z.array(RequiredString).min(1),
	stopConditions: z.array(RequiredString),
	repeatScenario: z.enum(KIBBLE_MULTIPET_REPEAT_SCENARIOS),
}).strict();

const KibbleMultipetProductSchema = z.object({
	id: RequiredString.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
	name: RequiredString,
	brand: RequiredString,
	sku: RequiredString.regex(/^KIB-(?:CAT|BRD|SNK|REP|BDG)-\d{3}$/),
	price: PriceString,
	description: RequiredString,
	categories: z.array(RequiredString).min(2),
	tags: z.array(RequiredString).min(2),
	readiness: z.literal('research-candidate'),
	source: KibbleMultipetSourceSchema,
	metadata: KibbleMultipetMetadataSchema,
}).strict().superRefine((product, context) => {
	if (product.price !== product.source.price) {
		context.addIssue({
			code: 'custom',
			path: ['source', 'price'],
			message: 'The product and source price snapshots must match.',
		});
	}
});

function requireProfileFields(
	product: z.infer<typeof KibbleMultipetProductSchema>,
	fields: readonly string[],
	context: z.RefinementCtx,
) {
	for (const field of fields) {
		if (!product.metadata.requiredProfileFields.includes(field)) {
			context.addIssue({
				code: 'custom',
				path: ['metadata', 'requiredProfileFields'],
				message: `${product.id} must require ${field}.`,
			});
		}
	}
}

export const KibbleMultipetCatalogSchema = z.object({
	schemaVersion: z.literal('1.0'),
	catalogId: z.literal('kibble-multipet-research-2026-08-14'),
	currency: z.literal('USD'),
	retrievedAt: z.literal('2026-08-14'),
	products: z.array(KibbleMultipetProductSchema).length(33),
}).strict().superRefine((catalog, context) => {
	for (const key of ['id', 'sku'] as const) {
		const values = catalog.products.map((product) => product[key]);
		if (new Set(values).size !== values.length) {
			context.addIssue({ code: 'custom', path: ['products'], message: `Product ${key} values must be unique.` });
		}
	}

	const urls = catalog.products.map((product) => product.source.url);
	if (new Set(urls).size !== urls.length) {
		context.addIssue({ code: 'custom', path: ['products'], message: 'Product source URLs must be unique.' });
	}

	for (const [index, product] of catalog.products.entries()) {
		const { metadata } = product;
		const path = ['products', index, 'metadata'] as const;
		const requireProfile = (reason: string) => {
			if (metadata.selectionMode !== 'profile-required') {
				context.addIssue({ code: 'custom', path: [...path, 'selectionMode'], message: reason });
			}
			if (metadata.stopConditions.length === 0) {
				context.addIssue({ code: 'custom', path: [...path, 'stopConditions'], message: `${product.id} requires a stop condition.` });
			}
		};

		if (metadata.species.includes('bird')) {
			requireProfile('Every bird candidate requires a bird profile.');
		}
		if (metadata.species.includes('snake') || metadata.species.includes('bearded-dragon')) {
			requireProfile('Every reptile candidate requires an animal and enclosure profile.');
		}
		if (metadata.species.includes('cat') && metadata.productRole === 'staple-food') {
			requireProfile('Cat food requires a diet profile.');
			requireProfileFields(product, ['lifeStage', 'dietaryRestrictions', 'foodAllergies'], context);
		}
		if (metadata.productRole === 'travel' && metadata.species.includes('cat')) {
			requireProfileFields(product, ['petLength', 'petHeight', 'petWeight', 'airline'], context);
		}
		if (metadata.species.includes('bird') && ['staple-food', 'topper'].includes(metadata.productRole)) {
			requireProfileFields(product, ['birdSpecies', 'lifeStage'], context);
		}
		if (product.id === 'bird-harrisons-adult-lifetime-fine-1lb') {
			requireProfileFields(product, ['breedingOrMolting', 'dietTransitionStatus'], context);
		}
		if (metadata.species.includes('bird') && ['habitat', 'travel'].includes(metadata.productRole)) {
			requireProfileFields(product, ['birdSpecies', 'birdSize', 'barSpacingNeed', 'occupancyCount'], context);
		}
		if (metadata.species.includes('snake') && metadata.productRole === 'substrate') {
			requireProfileFields(product, ['snakeSpecies', 'humidityTarget'], context);
		}
		if (['heat-source', 'environment-control'].includes(metadata.productRole)) {
			requireProfileFields(product, [
				'enclosureDimensions',
				'currentTemperatureRange',
				'targetTemperatureRange',
				'existingFixtureController',
				'wattageCapacity',
			], context);
		}
		if (metadata.productRole === 'uvb-lighting') {
			requireProfileFields(product, [
				'enclosureDimensions',
				'currentTemperatureRange',
				'targetTemperatureRange',
				'existingFixtureController',
				'wattageCapacity',
				'fixtureLength',
				'baskingDistance',
			], context);
		}
		if (metadata.productRole === 'hydration') {
			requireProfileFields(product, ['animalSize', 'enclosureDimensions'], context);
		}
		if (metadata.species.includes('bearded-dragon') && metadata.productRole === 'staple-food') {
			requireProfileFields(product, ['lifeStage', 'currentDiet'], context);
		}
	}
});

export type KibbleMultipetCatalog = z.infer<typeof KibbleMultipetCatalogSchema>;
export type KibbleMultipetProduct = KibbleMultipetCatalog['products'][number];
export type KibbleMultipetSpecies = KibbleMultipetProduct['metadata']['species'][number];

/**
 * Research candidates only. Parsing at module load keeps malformed or unsafe
 * catalog edits from silently becoming generator input.
 */
export const KIBBLE_MULTIPET_CATALOG = KibbleMultipetCatalogSchema.parse(catalogJson);

export function getKibbleMultipetProductsForSpecies(species: KibbleMultipetSpecies) {
	return KIBBLE_MULTIPET_CATALOG.products.filter((product) => product.metadata.species.includes(species));
}

export const kibbleMultipetCatalogCoverage = Object.freeze({
	candidates: KIBBLE_MULTIPET_CATALOG.products.length,
	cat: getKibbleMultipetProductsForSpecies('cat').length,
	bird: getKibbleMultipetProductsForSpecies('bird').length,
	snake: getKibbleMultipetProductsForSpecies('snake').length,
	beardedDragon: getKibbleMultipetProductsForSpecies('bearded-dragon').length,
	sharedSnakeAndBeardedDragon: KIBBLE_MULTIPET_CATALOG.products.filter(({ metadata }) =>
		metadata.species.length === 2
		&& metadata.species.includes('snake')
		&& metadata.species.includes('bearded-dragon')
	).length,
});
