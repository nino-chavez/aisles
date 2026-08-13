/**
 * Runner-only enrichment provider for the local Kibble showcase.
 *
 * Synthetic demo enrichment — not merchant data. This module is reachable
 * only through scripts/kibble-showcase-vite.config.ts, which aliases the
 * production query module for the local showcase Vite process.
 */

import type { ProductEnrichment } from '../../src/lib/server/enrichment/query';
import type { PersonaFitScores, PetProfile } from '../../src/lib/server/enrichment/types';

export const KIBBLE_SHOWCASE_DATA_SOURCE = 'Synthetic demo enrichment — not merchant data';
export const KIBBLE_SHOWCASE_PINNED_FIXTURE_SHA256 = '833824a875f1fbe83a5d1d9164f521aa38e64e3902d22623a6af1b8cad84fe49';

/**
 * Explicit scores for every product in the pinned Kibble seed fixture.
 * They are deliberately synthetic and provide a different stable order for
 * each persona; they are not derived from a model or merchant data.
 */
export const SYNTHETIC_PERSONA_FIT_BY_ENTITY_ID: Readonly<Record<number, PersonaFitScores>> = {
	3023: { gatherer: 0.98, hunter: 0.50, researcher: 0.98, gifter: 0.95 },
	3024: { gatherer: 0.97, hunter: 0.51, researcher: 0.85, gifter: 0.78 },
	3025: { gatherer: 0.96, hunter: 0.52, researcher: 0.72, gifter: 0.61 },
	3026: { gatherer: 0.95, hunter: 0.53, researcher: 0.59, gifter: 0.93 },
	3027: { gatherer: 0.94, hunter: 0.54, researcher: 0.95, gifter: 0.76 },
	3028: { gatherer: 0.93, hunter: 0.55, researcher: 0.82, gifter: 0.59 },
	3029: { gatherer: 0.92, hunter: 0.56, researcher: 0.69, gifter: 0.91 },
	3030: { gatherer: 0.91, hunter: 0.57, researcher: 0.56, gifter: 0.74 },
	3031: { gatherer: 0.90, hunter: 0.58, researcher: 0.92, gifter: 0.57 },
	3032: { gatherer: 0.89, hunter: 0.59, researcher: 0.79, gifter: 0.89 },
	3033: { gatherer: 0.88, hunter: 0.60, researcher: 0.66, gifter: 0.72 },
	3034: { gatherer: 0.87, hunter: 0.61, researcher: 0.53, gifter: 0.55 },
	3035: { gatherer: 0.86, hunter: 0.62, researcher: 0.89, gifter: 0.87 },
	3036: { gatherer: 0.85, hunter: 0.63, researcher: 0.76, gifter: 0.70 },
	3037: { gatherer: 0.84, hunter: 0.64, researcher: 0.63, gifter: 0.53 },
	3038: { gatherer: 0.83, hunter: 0.65, researcher: 0.50, gifter: 0.85 },
	3039: { gatherer: 0.82, hunter: 0.66, researcher: 0.86, gifter: 0.68 },
	3040: { gatherer: 0.81, hunter: 0.67, researcher: 0.73, gifter: 0.51 },
	3041: { gatherer: 0.80, hunter: 0.68, researcher: 0.60, gifter: 0.83 },
	3042: { gatherer: 0.79, hunter: 0.69, researcher: 0.96, gifter: 0.66 },
	3043: { gatherer: 0.78, hunter: 0.70, researcher: 0.83, gifter: 0.98 },
	3044: { gatherer: 0.77, hunter: 0.71, researcher: 0.70, gifter: 0.81 },
	3045: { gatherer: 0.76, hunter: 0.72, researcher: 0.57, gifter: 0.64 },
	3046: { gatherer: 0.75, hunter: 0.73, researcher: 0.93, gifter: 0.96 },
	3047: { gatherer: 0.74, hunter: 0.74, researcher: 0.80, gifter: 0.79 },
	3048: { gatherer: 0.73, hunter: 0.75, researcher: 0.67, gifter: 0.62 },
	3049: { gatherer: 0.72, hunter: 0.76, researcher: 0.54, gifter: 0.94 },
	3050: { gatherer: 0.71, hunter: 0.77, researcher: 0.90, gifter: 0.77 },
	3051: { gatherer: 0.70, hunter: 0.78, researcher: 0.77, gifter: 0.60 },
	3052: { gatherer: 0.69, hunter: 0.79, researcher: 0.64, gifter: 0.92 },
	3053: { gatherer: 0.68, hunter: 0.80, researcher: 0.51, gifter: 0.75 },
	3054: { gatherer: 0.67, hunter: 0.81, researcher: 0.87, gifter: 0.58 },
	3055: { gatherer: 0.66, hunter: 0.82, researcher: 0.74, gifter: 0.90 },
	3056: { gatherer: 0.65, hunter: 0.83, researcher: 0.61, gifter: 0.73 },
	3057: { gatherer: 0.64, hunter: 0.84, researcher: 0.97, gifter: 0.56 },
	3058: { gatherer: 0.63, hunter: 0.85, researcher: 0.84, gifter: 0.88 },
	3059: { gatherer: 0.62, hunter: 0.86, researcher: 0.71, gifter: 0.71 },
	3060: { gatherer: 0.61, hunter: 0.87, researcher: 0.58, gifter: 0.54 },
	3061: { gatherer: 0.60, hunter: 0.88, researcher: 0.94, gifter: 0.86 },
	3062: { gatherer: 0.59, hunter: 0.89, researcher: 0.81, gifter: 0.69 },
	3063: { gatherer: 0.58, hunter: 0.90, researcher: 0.68, gifter: 0.52 },
	3065: { gatherer: 0.57, hunter: 0.91, researcher: 0.55, gifter: 0.84 },
	3066: { gatherer: 0.56, hunter: 0.92, researcher: 0.91, gifter: 0.67 },
	3064: { gatherer: 0.55, hunter: 0.93, researcher: 0.78, gifter: 0.50 },
	3067: { gatherer: 0.54, hunter: 0.94, researcher: 0.65, gifter: 0.82 },
	3068: { gatherer: 0.53, hunter: 0.95, researcher: 0.52, gifter: 0.65 },
	3069: { gatherer: 0.52, hunter: 0.96, researcher: 0.88, gifter: 0.97 },
	3070: { gatherer: 0.51, hunter: 0.97, researcher: 0.75, gifter: 0.80 },
	3071: { gatherer: 0.50, hunter: 0.98, researcher: 0.62, gifter: 0.63 },
};

export const SYNTHETIC_KIBBLE_ENTITY_IDS = Object.freeze(
	Object.keys(SYNTHETIC_PERSONA_FIT_BY_ENTITY_ID).map(Number),
);

function petProfileFor(entityId: number): PetProfile {
	const productFamily = entityId <= 3032 ? 'food' : entityId <= 3041 ? 'supplement' : entityId <= 3045 ? 'treat' : entityId <= 3048 ? 'grooming' : 'hardgood';
	return {
		protein: entityId % 3 === 0 ? 'chicken' : entityId % 3 === 1 ? 'salmon' : 'beef',
		lifeStage: entityId % 5 === 0 ? 'puppy' : entityId % 7 === 0 ? 'senior' : 'adult',
		format: productFamily === 'food' ? 'dry' : productFamily === 'supplement' ? 'supplement' : productFamily === 'treat' ? 'treat' : productFamily === 'grooming' ? 'grooming' : 'hardgood',
		dietary: entityId % 4 === 0 ? 'grain-free' : 'none',
		petSize: entityId % 4 === 0 ? 'small' : entityId % 4 === 1 ? 'medium' : entityId % 4 === 2 ? 'large' : 'any',
		replenishmentDays: productFamily === 'food' || productFamily === 'supplement' || productFamily === 'treat' ? 30 : null,
		subscriptionFit: productFamily === 'food' ? 0.9 : productFamily === 'supplement' ? 0.75 : 0.4,
	};
}

function enrichmentFor(entityId: number, personaFit: PersonaFitScores): ProductEnrichment {
	return {
		bcEntityId: entityId,
		personaFit,
		semanticTags: ['synthetic-showcase'],
		compatibleWith: [],
		priceTier: entityId >= 3064 ? 'premium' : 'mid',
		petProfile: petProfileFor(entityId),
	};
}

/** Matches the production query interface without a database call. */
export async function getEnrichmentByEntityIds(entityIds: number[]): Promise<Map<number, ProductEnrichment>> {
	const result = new Map<number, ProductEnrichment>();
	for (const entityId of entityIds) {
		const personaFit = SYNTHETIC_PERSONA_FIT_BY_ENTITY_ID[entityId];
		if (personaFit) result.set(entityId, enrichmentFor(entityId, personaFit));
	}
	return result;
}
