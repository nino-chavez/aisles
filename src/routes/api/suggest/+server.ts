import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText, Output } from 'ai';
import { model as anthropicModel } from '$lib/server/model';
import { z } from 'zod';
import { loadCategoryProducts, CATEGORY_MAP } from '$lib/server/catalog';
import { getBrand } from '$lib/brand/config';
import { scorePetCompatibility } from '$lib/server/pet-compatibility';
import type { PetProfile } from '$lib/server/enrichment/types';

const SuggestionSchema = z.object({
	suggestions: z.array(z.object({
		productId: z.string().describe('Product ID from the catalog'),
		reason: z.string().describe('Brief reason this product complements the picks (e.g., "same chicken recipe", "fits an adult dog routine", "supports daily refills")'),
		type: z.enum(['accessory', 'upsell', 'cross-sell', 'complement']).describe('Why this is suggested: accessory (goes with), upsell (better version), cross-sell (different category), complement (same category, pairs well)'),
	})).refine((a) => a.length >= 1 && a.length <= 5, { message: 'Between 1 and 5 suggestions' }).describe('1-5 product suggestions that complement the shopper\'s picks'),
});

/**
 * POST /api/suggest
 *
 * Given a list of picked products, returns AI-inferred suggestions
 * for accessories, upsells, and cross-sells.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { picks } = await request.json();

		if (!Array.isArray(picks) || picks.length === 0) {
			return json({ suggestions: [] });
		}

		const brand = getBrand();

		// Load products from all categories
		const allProducts: Array<{ id: string; name: string; price: number; category: string; specs: Record<string, string>; salePrice?: number; compatibleWith: string[]; petProfile: PetProfile | null; priceTier: string | null }> = [];
		for (const [slug] of Object.entries(CATEGORY_MAP)) {
			const result = await loadCategoryProducts(slug);
			if (result) {
				for (const p of result.products) {
					allProducts.push({
						id: p.id,
						name: p.name,
						price: p.price,
						salePrice: p.salePrice,
						category: result.categoryName,
						specs: p.specs,
						compatibleWith: p.compatibleWith,
						petProfile: p.petProfile,
						priceTier: p.priceTier,
					});
				}
			}
		}

		const catalogProducts = [...new Map(allProducts.map((product) => [product.id, product])).values()];
		const pickIds = new Set(picks.map((pick: { id?: string }) => pick.id).filter(Boolean));
		const pickedProfiles = catalogProducts
			.filter((product) => pickIds.has(product.id))
			.map((product) => product.petProfile);

		// Resolve picked profiles before filtering them out, then rank remaining
		// candidates by shared pet profile and their compatible-with keywords.
		const scored = catalogProducts
			.filter((product) => !pickIds.has(product.id))
			.map((product) => ({
				...product,
				compatScore: scorePetCompatibility(product, pickedProfiles),
			}));

		// Sort by compatibility score, then take top 25 for the AI
		scored.sort((a, b) => b.compatScore - a.compatScore || a.id.localeCompare(b.id));
		const candidates = scored.slice(0, 25);

		const picksSummary = picks.map((p: any) => {
			const catalogProduct = catalogProducts.find((product) => product.id === p.id);
			const topSpecs = Object.entries(p.specs || {}).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ');
			const profile = catalogProduct?.petProfile
				? ` | ${catalogProduct.petProfile.protein}, ${catalogProduct.petProfile.lifeStage}, ${catalogProduct.petProfile.format}, ${catalogProduct.petProfile.dietary}, ${catalogProduct.petProfile.petSize}; Auto-Refill ${Math.round(catalogProduct.petProfile.subscriptionFit * 100)}%${catalogProduct.petProfile.replenishmentDays ? `, ${catalogProduct.petProfile.replenishmentDays}-day cadence` : ''}`
				: '';
			const priceTier = catalogProduct?.priceTier ? ` | ${catalogProduct.priceTier} price tier` : '';
			return `- ${p.name} | $${p.price} | ${p.category} | ${topSpecs}${profile}${priceTier}`;
		}).join('\n');

		const catalogSummary = candidates.map((p) => {
			const topSpecs = Object.entries(p.specs).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(', ');
			const compat = p.compatScore > 0 ? ` | COMPATIBLE (${p.compatScore} matches)` : '';
			const profile = p.petProfile
				? ` | ${p.petProfile.protein}, ${p.petProfile.lifeStage}, ${p.petProfile.format}, ${p.petProfile.dietary}, ${p.petProfile.petSize}; Auto-Refill ${Math.round(p.petProfile.subscriptionFit * 100)}%${p.petProfile.replenishmentDays ? `, ${p.petProfile.replenishmentDays}-day cadence` : ''}`
				: '';
			const priceTier = p.priceTier ? ` | ${p.priceTier} price tier` : '';
			return `- ID:"${p.id}" | ${p.name} | $${p.salePrice || p.price} | ${p.category} | ${topSpecs}${profile}${priceTier}${compat}`;
		}).join('\n');

		const prompt = `You are a merchandising AI for ${brand.prompt.storeName}, ${brand.prompt.storeDescription}.

A shopper has these products in their consideration set:
${picksSummary}

Available products in the catalog (not already picked):
${catalogSummary}

Suggest 3-5 products that complement the shopper's picks:
- ACCESSORIES: items that help with the same pet's routine (e.g., feeding, storage, grooming, or travel)
- UPSELLS: better versions of what they're considering, if the price jump is reasonable
- CROSS-SELLS: products from other categories the same pet might need
- COMPLEMENTS: same-category products that suit the same pet profile or replenishment routine

IMPORTANT:
- Match pet compatibility where possible (protein, life stage, dietary needs, pet size, and replenishment cadence)
- Match price tier to what the shopper already picked
- Explain WHY each suggestion complements their picks in 5-10 words
- Only suggest products from the available catalog list above
- Use the exact product IDs from the catalog`;

		const result = await generateText({
			model: anthropicModel(),
			output: Output.object({ schema: SuggestionSchema }),
			prompt,
		});

		// Resolve suggestions to include name/price for the UI
		const suggestions = (result.output?.suggestions || []).map((s) => {
			const product = candidates.find((p) => p.id === s.productId) || catalogProducts.find((p) => p.id === s.productId);
			return {
				id: s.productId,
				name: product?.name || s.productId,
				price: product?.salePrice || product?.price || 0,
				reason: s.reason,
				type: s.type,
			};
		}).filter((s) => s.price > 0); // Filter out unresolved products

		return json({ suggestions });
	} catch (err) {
		console.error('Suggestion generation failed:', err);
		return json({ suggestions: [] });
	}
};
