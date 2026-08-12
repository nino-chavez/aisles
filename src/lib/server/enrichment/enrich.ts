/**
 * LLM-powered product enrichment pipeline.
 *
 * Reads products from BigCommerce, calls Claude to extract attributes
 * and score persona-fit, writes results to Postgres.
 *
 * Run: npx tsx src/lib/server/enrichment/enrich.ts
 */

import 'dotenv/config';
import postgres from 'postgres';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, Output, embedMany } from 'ai';
import { z } from 'zod';
import { getBrand } from '../../brand/config';
import {
	DIETARY_OPTIONS,
	kibblePriceTier,
	LIFE_STAGES,
	PET_SIZES,
	PRODUCT_FORMATS,
	PROTEINS,
} from './types';

// ─── Config ────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL required');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY required');

const STORE_HASH = process.env.BIGCOMMERCE_STORE_HASH;
// Use channel-specific token if available, fall back to default
const STOREFRONT_TOKEN = process.env.STOREFRONT_TOKEN || process.env.BIGCOMMERCE_STOREFRONT_TOKEN;
if (!STORE_HASH || !STOREFRONT_TOKEN) throw new Error('BigCommerce credentials required (set STOREFRONT_TOKEN or BIGCOMMERCE_STOREFRONT_TOKEN)');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY required');

const sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 60 });
const brandId = getBrand().id;
const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });
const openrouter = createOpenRouter({ apiKey: OPENROUTER_API_KEY });

const ENRICHMENT_MODEL = 'claude-sonnet-5';
const ENRICHMENT_MODEL_FULL = 'anthropic/claude-sonnet-5';

// Per-1M token pricing (USD)
const PRICING = { input: 3.00, output: 15.00 };

interface EnrichmentStats {
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCost: number;
	count: number;
}

const stats: EnrichmentStats = { totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, count: 0 };

function estimateCost(inputTokens: number, outputTokens: number): number {
	return (inputTokens / 1_000_000) * PRICING.input + (outputTokens / 1_000_000) * PRICING.output;
}

async function logEnrichmentGeneration(entityId: number, inputTokens: number, outputTokens: number, generationMs: number) {
	const cost = estimateCost(inputTokens, outputTokens);
	stats.totalInputTokens += inputTokens;
	stats.totalOutputTokens += outputTokens;
	stats.totalCost += cost;
	stats.count++;

	await sql`
		INSERT INTO generation_logs (
			brand_id, type, persona, category_slug, cache_hit, generation_ms,
			input_tokens, output_tokens, model, estimated_cost
		) VALUES (
			${brandId}, 'enrichment', 'n/a', ${String(entityId)},
			false, ${generationMs},
			${inputTokens}, ${outputTokens},
			${ENRICHMENT_MODEL_FULL}, ${cost}
		)
	`;
}

// ─── Schema ────────────────────────────────────────────────────────

const EnrichmentSchema = z.object({
	protein: z.enum(PROTEINS).describe('Primary protein. Use mixed for multi-animal blends and none for non-food products.'),
	lifeStage: z.enum(LIFE_STAGES).describe('Life stage this item is marketed for. Use all when not stage-specific.'),
	format: z.enum(PRODUCT_FORMATS).describe('Product format. Air-dried is distinct from freeze-dried.'),
	dietary: z.enum(DIETARY_OPTIONS).describe('Primary dietary position. Use none when no listed dietary restriction applies.'),
	petSize: z.enum(PET_SIZES).describe('Pet size the item targets. Use any when size does not apply.'),
	replenishmentDays: z.number().int().min(1).max(365).nullable().describe('Typical days one unit lasts. Null for products without a repeat-purchase cadence, such as toys.'),
	subscriptionFit: z.number().min(0).max(1).describe('How appropriate the product is for Auto-Refill: recurring food/treat/supplement items score high; durable hardgoods score low.'),
	personaFit: z.object({
		gatherer: z.number().min(0).max(1).describe('How well this appeals to an exploratory, inspiration-driven shopper (visual appeal, storytelling potential, lifestyle fit)'),
		hunter: z.number().min(0).max(1).describe('How well this appeals to a goal-oriented, efficiency-driven shopper (clear specs, good value, practical)'),
		researcher: z.number().min(0).max(1).describe('How well this appeals to a methodical, evidence-driven shopper (detailed specs, comparable, well-documented)'),
		gifter: z.number().min(0).max(1).describe('How well this appeals to someone shopping for others (universal appeal, giftable price point, presentation value)'),
	}),
	semanticTags: z.array(z.string()).min(5).max(10).describe('5-10 pet-shopping intent tags, such as "sensitive stomach", "puppy training", "daily kibble", or "long-lasting chew".'),
	compatibleWith: z.array(z.string()).min(3).max(8).describe('3-8 profile keywords for products that fit the same pet: protein, life stage, diet, size, or routine. Examples: "chicken", "adult", "grain-free", "daily feeding".'),
});

// ─── BigCommerce GraphQL ───────────────────────────────────────────

const CHANNEL_ID = process.env.BIGCOMMERCE_CHANNEL_ID || '1';
const BC_HOST = CHANNEL_ID === '1'
	? `store-${STORE_HASH}.mybigcommerce.com`
	: `store-${STORE_HASH}-${CHANNEL_ID}.mybigcommerce.com`;
const BC_GRAPHQL_URL = `https://${BC_HOST}/graphql`;

const PRODUCT_QUERY = `
  query Products($first: Int!) {
    site {
      products(first: $first) {
        edges {
          node {
            entityId
            name
            path
            description
            prices { price { value currencyCode } salePrice { value } }
            defaultImage { url(width: 500) altText }
            customFields { edges { node { name value } } }
            categories { edges { node { name path } } }
          }
        }
      }
    }
  }
`;

interface BCProductNode {
	entityId: number;
	name: string;
	path: string;
	description: string;
	prices: { price: { value: number }; salePrice?: { value: number } | null };
	customFields: { edges: Array<{ node: { name: string; value: string } }> };
	categories: { edges: Array<{ node: { name: string } }> };
}

async function fetchProducts(): Promise<BCProductNode[]> {
	const res = await fetch(BC_GRAPHQL_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${STOREFRONT_TOKEN}`,
		},
		body: JSON.stringify({ query: PRODUCT_QUERY, variables: { first: 50 } }),
	});

	const json = await res.json();
	return json.data.site.products.edges.map((e: { node: BCProductNode }) => e.node);
}

// ─── Enrichment ────────────────────────────────────────────────────

async function enrichProduct(product: BCProductNode) {
	const specs = product.customFields.edges
		.map((e) => `${e.node.name}: ${e.node.value}`)
		.join('\n');

	const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').trim();
	const price = product.prices.salePrice?.value || product.prices.price.value;
	const category = product.categories.edges[0]?.node.name || 'Unknown';

	const requiredPriceTier = kibblePriceTier(price);
	const prompt = `Analyze this pet-supply product for Kibble and provide enrichment data.

PRODUCT: ${product.name}
PRICE: $${price}
CATEGORY: ${category}
DESCRIPTION: ${stripHtml(product.description)}
SPECS:
${specs || 'None provided'}

Its price tier is set by code to ${requiredPriceTier}; do not return a price-tier field.

Score persona-fit based on:
- Gatherer: discovery appeal, pet-routine storytelling, and approachable everyday use
- Hunter: clear value, pack size, availability, and fast reorder utility
- Researcher: ingredient detail, feeding guidance, dietary claims, and comparability
- Gifter: giftability for a pet owner, universal appeal, and presentation value

For protein, use mixed when multiple animal proteins are central to the product. For non-food items use none.
For format, air-dried and freeze-dried are different. Do not treat them as interchangeable.
For compatibleWith, describe shared pet profile and routine, not furniture style or dimensions.
Generate semantic tags that capture how someone might search for this product by pet need or routine rather than keyword.`;

	const start = Date.now();
	const { output, usage } = await generateText({
		model: anthropic(ENRICHMENT_MODEL),
		output: Output.object({ schema: EnrichmentSchema }),
		prompt,
	});

	if (!output) throw new Error('No enrichment output generated');

	const elapsed = Date.now() - start;
	if (usage) {
		await logEnrichmentGeneration(
			product.entityId,
			usage.inputTokens ?? 0,
			usage.outputTokens ?? 0,
			elapsed,
		);
	}

	return output;
}

// ─── Database ──────────────────────────────────────────────────────

async function upsertEnrichment(product: BCProductNode, enrichment: z.infer<typeof EnrichmentSchema>) {
	const e = enrichment;
	const price = product.prices.salePrice?.value || product.prices.price.value;
	const priceTier = kibblePriceTier(price);
	await sql`
		INSERT INTO enriched_products (
			brand_id, bc_entity_id, bc_product_path,
			protein, life_stage, format, dietary, pet_size, replenishment_days, subscription_fit, price_tier,
			fit_gatherer, fit_hunter, fit_researcher, fit_gifter,
			semantic_tags, compatible_with, enriched_at, enrichment_model, updated_at
		) VALUES (
			${brandId}, ${product.entityId}, ${product.path},
			${e.protein}, ${e.lifeStage}, ${e.format}, ${e.dietary}, ${e.petSize}, ${e.replenishmentDays}, ${e.subscriptionFit}, ${priceTier},
			${e.personaFit.gatherer}, ${e.personaFit.hunter}, ${e.personaFit.researcher}, ${e.personaFit.gifter},
			${e.semanticTags}, ${e.compatibleWith}, NOW(), ${ENRICHMENT_MODEL_FULL}, NOW()
		)
		ON CONFLICT (brand_id, bc_entity_id) DO UPDATE SET
			bc_product_path = EXCLUDED.bc_product_path,
			protein = EXCLUDED.protein,
			life_stage = EXCLUDED.life_stage,
			format = EXCLUDED.format,
			dietary = EXCLUDED.dietary,
			pet_size = EXCLUDED.pet_size,
			replenishment_days = EXCLUDED.replenishment_days,
			subscription_fit = EXCLUDED.subscription_fit,
			price_tier = EXCLUDED.price_tier,
			fit_gatherer = EXCLUDED.fit_gatherer,
			fit_hunter = EXCLUDED.fit_hunter,
			fit_researcher = EXCLUDED.fit_researcher,
			fit_gifter = EXCLUDED.fit_gifter,
			semantic_tags = EXCLUDED.semantic_tags,
			compatible_with = EXCLUDED.compatible_with,
			enriched_at = NOW(),
			enrichment_model = EXCLUDED.enrichment_model,
			updated_at = NOW()
	`;
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
	console.log('Fetching products from BigCommerce...');
	const products = await fetchProducts();
	console.log(`Found ${products.length} products`);

	let enriched = 0;
	let failed = 0;
	const enrichments = new Map<number, z.infer<typeof EnrichmentSchema>>();

	for (const product of products) {
		try {
			process.stdout.write(`  Enriching: ${product.name}... `);
			const enrichment = await enrichProduct(product);
			await upsertEnrichment(product, enrichment);
			enrichments.set(product.entityId, enrichment);
			console.log(`OK (${enrichment.format}, ${enrichment.lifeStage}, Auto-Refill:${enrichment.subscriptionFit.toFixed(2)})`);
			enriched++;
		} catch (err) {
			console.log(`FAILED: ${err instanceof Error ? err.message : err}`);
			failed++;
		}
	}

	console.log(`\nEnrichment: ${enriched} enriched, ${failed} failed out of ${products.length} total`);
	console.log(`Cost: $${stats.totalCost.toFixed(4)} (${stats.totalInputTokens.toLocaleString()} in / ${stats.totalOutputTokens.toLocaleString()} out tokens across ${stats.count} calls)`);
	if (failed > 0) {
		throw new Error(`Enrichment stopped: ${failed} of ${products.length} products failed. Embeddings were not generated.`);
	}

	// ─── Generate embeddings ───────────────────────────────────────
	console.log('\nGenerating embeddings...');

	// Build embedding text from the completed pet profile, not absent BC custom fields.
	const embeddingTexts = products.map((p) => {
		const enrichment = enrichments.get(p.entityId);
		const desc = p.description.replace(/<[^>]*>/g, '').trim();
		const profile = enrichment
			? `${enrichment.protein} ${enrichment.lifeStage} ${enrichment.format} ${enrichment.dietary} ${enrichment.petSize}. ${enrichment.semanticTags.join(', ')}. ${enrichment.compatibleWith.join(', ')}`
			: '';
		return `${p.name}. ${desc} ${profile}`.slice(0, 8000); // text-embedding-3-small max ~8k tokens
	});

	try {
		const { embeddings } = await embedMany({
			model: openrouter.textEmbeddingModel('openai/text-embedding-3-small'),
			values: embeddingTexts,
		});

		let embeddingCount = 0;
		for (let i = 0; i < products.length; i++) {
			const vec = embeddings[i];
			if (!vec) continue;

			const vecStr = `[${vec.join(',')}]`;
			await sql`
				UPDATE enriched_products
				SET embedding = ${vecStr}::extensions.vector
				WHERE brand_id = ${brandId} AND bc_entity_id = ${products[i].entityId}
			`;
			embeddingCount++;
		}

		console.log(`Embeddings: ${embeddingCount} generated (${embeddings[0]?.length || 0} dimensions)`);
	} catch (err) {
		throw new Error(`Embedding generation failed: ${err instanceof Error ? err.message : String(err)}`);
	}

	console.log('\nDone.');
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
