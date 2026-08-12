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

export interface EnrichedProduct {
	bcEntityId: number;
	bcProductPath: string;

	// LLM-extracted attributes
	material: string | null;
	style: string | null;
	useCase: string | null;
	dimensions: string | null;
	priceTier: 'budget' | 'mid' | 'premium' | 'luxury';

	// Persona-fit scores (how well this product matches each persona's needs)
	personaFit: PersonaFitScores;

	// Semantic tags for intent-based discovery
	semanticTags: string[];

	// Metadata
	enrichedAt: string;
	enrichmentModel: string;
}
