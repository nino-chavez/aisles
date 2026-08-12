import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateText, Output } from 'ai';
import { model as anthropicModel, PRIMARY_MODEL } from '$lib/server/model';
import { z } from 'zod';
import { loadCategoryProducts, CATEGORY_MAP } from '$lib/server/catalog';
import { getBrand } from '$lib/brand/config';

const SuggestionSchema = z.object({
	suggestions: z.array(z.object({
		productId: z.string().describe('Product ID from the catalog'),
		reason: z.string().describe('Brief reason this product complements the picks (e.g., "matches the walnut finish", "fits 19-inch pits", "completes the audio setup")'),
		type: z.enum(['accessory', 'upsell', 'cross-sell', 'complement']).describe('Why this is suggested: accessory (goes with), upsell (better version), cross-sell (different category), complement (same category, pairs well)'),
	})).min(1).max(5).describe('1-5 product suggestions that complement the shopper\'s picks'),
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
		const allProducts: Array<{ id: string; name: string; price: number; category: string; specs: Record<string, string>; salePrice?: number; compatibleWith: string[] }> = [];
		for (const [slug] of Object.entries(CATEGORY_MAP)) {
			const result = await loadCategoryProducts(slug);
			if (result) {
				for (const p of result.products) {
					if (picks.some((pick: any) => pick.id === p.id)) continue;
					allProducts.push({
						id: p.id,
						name: p.name,
						price: p.price,
						salePrice: p.salePrice,
						category: result.categoryName,
						specs: p.specs,
						compatibleWith: (p as any).compatibleWith || [],
					});
				}
			}
		}

		// Pre-filter: boost products with compatible_with matches against picks
		const picksKeywords = picks.flatMap((p: any) => [
			p.name?.toLowerCase(),
			p.category?.toLowerCase(),
			...Object.values(p.specs || {}).map((v: any) => String(v).toLowerCase()),
		].filter(Boolean));

		const scored = allProducts.map((p) => {
			const compatMatches = p.compatibleWith.filter((kw) =>
				picksKeywords.some((pk: string) => pk.includes(kw.toLowerCase()) || kw.toLowerCase().includes(pk))
			).length;
			return { ...p, compatScore: compatMatches };
		});

		// Sort by compatibility score, then take top 25 for the AI
		scored.sort((a, b) => b.compatScore - a.compatScore);
		const candidates = scored.slice(0, 25);

		const picksSummary = picks.map((p: any) => {
			const topSpecs = Object.entries(p.specs || {}).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ');
			return `- ${p.name} | $${p.price} | ${p.category} | ${topSpecs}`;
		}).join('\n');

		const catalogSummary = candidates.map((p) => {
			const topSpecs = Object.entries(p.specs).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(', ');
			const compat = p.compatScore > 0 ? ` | COMPATIBLE (${p.compatScore} matches)` : '';
			return `- ID:"${p.id}" | ${p.name} | $${p.salePrice || p.price} | ${p.category} | ${topSpecs}${compat}`;
		}).join('\n');

		const prompt = `You are a merchandising AI for ${brand.prompt.storeName}, ${brand.prompt.storeDescription}.

A shopper has these products in their consideration set:
${picksSummary}

Available products in the catalog (not already picked):
${catalogSummary}

Suggest 3-5 products that complement the shopper's picks:
- ACCESSORIES: items that physically work with or enhance the picked products (e.g., a cover that fits a specific fire pit size, tips for specific earbuds)
- UPSELLS: better versions of what they're considering, if the price jump is reasonable
- CROSS-SELLS: products from other categories they might need (e.g., picked a desk → suggest a chair)
- COMPLEMENTS: same-category products that pair well (e.g., matching nightstand for a dresser)

IMPORTANT:
- Match physical compatibility when possible (dimensions, sizes, connectors)
- Match style/material/price tier to what the shopper already picked
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
			const product = candidates.find((p) => p.id === s.productId) || allProducts.find((p) => p.id === s.productId);
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
