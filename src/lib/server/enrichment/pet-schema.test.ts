import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	DIETARY_OPTIONS,
	kibblePriceTier,
	LIFE_STAGES,
	PET_SIZES,
	PRODUCT_FORMATS,
	PROTEINS,
} from './types';

const migration = readFileSync(
	resolve(import.meta.dirname, '../../../../supabase/migrations/20260812204335_kibble_pet_enrichment_fields.sql'),
	'utf8',
);
const enrichmentRunner = readFileSync(resolve(import.meta.dirname, 'enrich.ts'), 'utf8');

describe('Kibble pet enrichment contract', () => {
	it('keeps catalog-observed chicken and air-dried values distinct', () => {
		expect(PROTEINS).toContain('chicken');
		expect(PRODUCT_FORMATS).toContain('air-dried');
		expect(PRODUCT_FORMATS).toContain('freeze-dried');
		expect(PROTEINS).toContain('mixed');
	});

	it('uses the Kibble-relative $9-$240 price bands at every boundary', () => {
		expect(kibblePriceTier(9)).toBe('budget');
		expect(kibblePriceTier(19.99)).toBe('budget');
		expect(kibblePriceTier(20)).toBe('mid');
		expect(kibblePriceTier(49.99)).toBe('mid');
		expect(kibblePriceTier(50)).toBe('premium');
		expect(kibblePriceTier(99.99)).toBe('premium');
		expect(kibblePriceTier(100)).toBe('luxury');
		expect(kibblePriceTier(240)).toBe('luxury');
	});

	it('adds pet vocabulary while retaining legacy columns for the rollout', () => {
		for (const column of ['protein', 'life_stage', 'format', 'dietary', 'pet_size', 'replenishment_days', 'subscription_fit']) {
			expect(migration).toContain(`ADD COLUMN ${column}`);
		}
		expect(migration).toContain("'chicken'");
		expect(migration).toContain("'air-dried'");
		expect(migration).toContain('replenishment_days BETWEEN 1 AND 365');
		expect(migration).toContain('subscription_fit >= 0 AND subscription_fit <= 1');
		for (const column of ['material', 'style', 'use_case', 'dimensions']) {
			expect(migration).not.toContain(`DROP COLUMN ${column}`);
		}
		expect(migration).toContain('This is deliberately expand-only');
	});

	it('keeps every controlled pet axis available to the enrichment schema', () => {
		expect(LIFE_STAGES).toEqual(['puppy', 'adult', 'senior', 'all']);
		expect(DIETARY_OPTIONS).toEqual(['grain-free', 'limited-ingredient', 'prescription', 'none']);
		expect(PET_SIZES).toEqual(['toy', 'small', 'medium', 'large', 'any']);
	});

	it('audits token usage when structured enrichment output fails', () => {
		expect(enrichmentRunner).toContain('NoObjectGeneratedError.isInstance(error)');
		expect(enrichmentRunner).toContain("'enrichment_failed'");
		expect(enrichmentRunner).toContain('error.usage?.inputTokens');
		expect(enrichmentRunner).toContain('error.usage?.outputTokens');
	});

	it('records paid model calls independently from atomic product publication', () => {
		expect(enrichmentRunner).toContain('await logEnrichmentGeneration(\n\t\t\t\tsql,');
		expect(enrichmentRunner).not.toContain('await logEnrichmentGeneration(tx');
		expect(enrichmentRunner.indexOf('await logEnrichmentGeneration(')).toBeLessThan(
			enrichmentRunner.indexOf("console.log('\\nGenerating embeddings...')"),
		);
		expect(enrichmentRunner).toContain('await sql.begin(async (tx) =>');
	});
});
