import type { PageServerLoad } from './$types';
import { getProductByPath, getProductsByCategory, customFieldsToRecord, type BCProduct } from '$lib/server/bigcommerce';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, url, parent }) => {
	const slug = params.slug;
	const { devMode } = await parent();
	const persona = url.searchParams.get('intent') || 'gatherer';

	// Fetch the product by its URL path
	const bcProduct = await getProductByPath(`/${slug}/`);

	if (!bcProduct) {
		throw error(404, `Product "${slug}" not found`);
	}

	const product = transformProduct(bcProduct);

	// Fetch related products from the same category
	let relatedProducts: ReturnType<typeof transformProduct>[] = [];
	const firstCategory = bcProduct.categories.edges[0]?.node;
	if (firstCategory) {
		try {
			const { products: categoryProducts } = await getProductsByCategory(firstCategory.entityId);
			relatedProducts = categoryProducts
				.filter((p) => p.entityId !== bcProduct.entityId)
				.slice(0, 4)
				.map(transformProduct);
		} catch {
			// Related products are optional — fail silently
		}
	}

	return {
		product,
		relatedProducts,
		persona,
		devMode,
	};
};

function transformProduct(p: BCProduct) {
	const specs = customFieldsToRecord(p);
	return {
		id: p.path.replace(/^\/|\/$/g, '') || String(p.entityId),
		entityId: p.entityId,
		name: p.name,
		price: p.prices.price.value,
		salePrice: p.prices.salePrice?.value || undefined,
		image: p.defaultImage?.url || '',
		imageAlt: p.defaultImage?.altText || p.name,
		description: p.description, // Keep HTML for PDP — render rich content
		descriptionPlain: p.description.replace(/<[^>]*>/g, '').trim(),
		specs,
		tags: Object.values(specs).slice(0, 3),
		category: p.categories.edges[0]?.node.name || '',
		categoryPath: p.categories.edges[0]?.node.path || '',
	};
}
