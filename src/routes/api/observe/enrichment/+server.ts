import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadCategoryProducts } from '$lib/server/catalog';

const OBSERVE_KEY = 'aisles-observe';

/**
 * GET /api/observe/enrichment?category={slug}&persona={persona}&key=aisles-observe
 * Returns enriched products for a category, sorted by persona-fit.
 */
export const GET: RequestHandler = async ({ url }) => {
	if (url.searchParams.get('key') !== OBSERVE_KEY) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const category = url.searchParams.get('category');
	const persona = url.searchParams.get('persona') || 'gatherer';

	if (!category) {
		return json({ error: 'Missing category parameter' }, { status: 400 });
	}

	const result = await loadCategoryProducts(category, persona);
	if (!result) {
		return json({ products: [], categoryName: null });
	}

	const products = result.products.map((p) => ({
		id: p.id,
		entityId: p.entityId,
		name: p.name,
		price: p.price,
		salePrice: p.salePrice,
		personaFit: p.personaFit,
		semanticTags: p.semanticTags,
		compatibleWith: p.compatibleWith,
		priceTier: p.priceTier,
		petProfile: p.petProfile,
	}));

	return json({ products, categoryName: result.categoryName });
};
