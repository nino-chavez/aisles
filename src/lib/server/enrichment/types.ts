/**
 * Enriched product data produced by the LLM enrichment pipeline.
 * Stored in brand-scoped Postgres, consumed by layout generation.
 */

export interface PersonaFitScores {
	gatherer: number;  // 0.0 - 1.0
	hunter: number;
	researcher: number;
	gifter: number;
}

export const PROTEINS = ['beef', 'chicken', 'salmon', 'turkey', 'plant', 'mixed', 'none'] as const;
export const LIFE_STAGES = ['puppy', 'adult', 'senior', 'all'] as const;
export const PRODUCT_FORMATS = ['dry', 'wet', 'air-dried', 'freeze-dried', 'treat', 'supplement', 'grooming', 'hardgood'] as const;
export const DIETARY_OPTIONS = ['grain-free', 'limited-ingredient', 'prescription', 'none'] as const;
export const PET_SIZES = ['toy', 'small', 'medium', 'large', 'any'] as const;

export type Protein = typeof PROTEINS[number];
export type LifeStage = typeof LIFE_STAGES[number];
export type ProductFormat = typeof PRODUCT_FORMATS[number];
export type Dietary = typeof DIETARY_OPTIONS[number];
export type PetSize = typeof PET_SIZES[number];

/** Kibble's observed $9-$240 price range, not a generic retail scale. */
export function kibblePriceTier(price: number): 'budget' | 'mid' | 'premium' | 'luxury' {
	if (price < 20) return 'budget';
	if (price < 50) return 'mid';
	if (price < 100) return 'premium';
	return 'luxury';
}

export interface PetProfile {
	protein: Protein;
	lifeStage: LifeStage;
	format: ProductFormat;
	dietary: Dietary;
	petSize: PetSize;
	replenishmentDays: number | null;
	subscriptionFit: number;
}

export interface EnrichedProduct {
	bcEntityId: number;
	bcProductPath: string;

	// LLM-extracted Kibble pet profile
	petProfile: PetProfile;
	priceTier: 'budget' | 'mid' | 'premium' | 'luxury';

	// Persona-fit scores (how well this product matches each persona's needs)
	personaFit: PersonaFitScores;

	// Semantic tags for intent-based discovery
	semanticTags: string[];
	compatibleWith: string[];

	// Metadata
	enrichedAt: string;
	enrichmentModel: string;
}
