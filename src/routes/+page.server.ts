import type { PageServerLoad } from './$types';
import { getProducts, customFieldsToRecord, type BCProduct } from '$lib/server/bigcommerce';
import { getBrand } from '$lib/brand/config';

export const load: PageServerLoad = async ({ cookies }) => {
	// Fetch featured products from BC
	const allProducts = await getProducts(30);

	// Check for returning visitor persona
	const storedPersona = cookies.get('aisles_persona') || null;
	const storedCategory = cookies.get('aisles_last_category') || null;

	// Transform products
	const products = allProducts.map(transformProduct);

	// Pick featured products (first 4 from different price ranges)
	const sorted = [...products].sort((a, b) => b.price - a.price);
	const featured = sorted.length >= 4
		? [sorted[0], sorted[Math.floor(sorted.length / 3)], sorted[Math.floor(sorted.length * 2 / 3)], sorted[sorted.length - 1]]
		: sorted.slice(0, 4);

	// Map categories for display — driven by brand config
	const brand = getBrand();
	const categoryList = Object.entries(brand.categories).map(([slug, config]) => ({
		name: config.displayName,
		path: `/${slug}/`,
		slug,
	}));

	return {
		featured,
		categories: categoryList,
		storedPersona,
		storedCategory,
		brandName: brand.name,
		brandTagline: brand.tagline,
		brandDomain: brand.domain,
		homepage: brand.homepage,
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
		description: p.description.replace(/<[^>]*>/g, '').trim(),
		specs,
	};
}
