import type { PageServerLoad } from './$types';
import {
	customFieldsToRecord,
	getKibbleProductDetailByPath,
	getProductByPath,
	getProductsByCategory,
	type BCProduct,
	type BCKibbleProductDetail,
} from '$lib/server/bigcommerce';
import { getBrand } from '$lib/brand/config';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';
import { materializeKibbleProductHrefs } from '$lib/brand/reference/kibble-runtime';
import { assertKibblePreserveRoutePolicy, getContractSurfaceDecision } from '$lib/brand/composition-policy';
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';

export const load: PageServerLoad = async ({ params, url, parent }) => {
	const slug = params.slug;
	const { devMode, renderMode } = await parent();

	if (renderMode === 'reference-preserve') {
		return loadKibblePreservePdp(slug);
	}

	const persona = url.searchParams.get('intent') || 'gatherer';
	const bcProduct = await getProductByPath(`/${slug}/`);
	if (!bcProduct) throw error(404, `Product "${slug}" not found`);

	const product = transformLegacyProduct(bcProduct);
	let relatedProducts: ReturnType<typeof transformLegacyProduct>[] = [];
	const firstCategory = bcProduct.categories.edges[0]?.node;
	if (firstCategory) {
		try {
			const { products: categoryProducts } = await getProductsByCategory(firstCategory.entityId);
			relatedProducts = categoryProducts.filter((p) => p.entityId !== bcProduct.entityId).slice(0, 4).map(transformLegacyProduct);
		} catch {
			// Related products are optional for legacy routes.
		}
	}

	return { product, relatedProducts, persona, devMode, renderMode };
};

async function loadKibblePreservePdp(slug: string) {
	const failClosed = (cause: unknown, phase: string): never => {
		const detail = cause instanceof Error ? cause.message : `Unknown Kibble PDP ${phase} error.`;
		console.error(`[kibble-preserve] product ${phase} failed closed:`, detail);
		throw error(503, dev ? `Kibble Preserve cannot render: ${detail}` : 'This Kibble product is temporarily unavailable.');
	};

	try {
		const decision = getContractSurfaceDecision(getBrand().id, 'pdp');
		if (decision.mode !== 'reference-preserve') throw new Error('Kibble PDP policy is unavailable.');
		assertKibblePreserveRoutePolicy(decision.policy, 'pdp');

		if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw error(404, 'Product not found');
		const detail = await getKibbleProductDetailByPath(`/${slug}/`);
		if (!detail) throw error(404, 'Product not found');

		const product = materializeKibbleProduct(detail, slug);
		const categoryHref = materializeKibbleCategoryHref(product.categoryPath);
		const relatedProducts = detail.relatedProducts.edges
			.map(({ node }) => transformProduct(node))
			.filter((candidate) => candidate.entityId !== product.entityId)
			.slice(0, 4);

		return {
			renderMode: 'reference-preserve' as const,
			kibblePdp: {
				product,
				breadcrumbs: [
					{ label: 'Home', href: '/' },
					...(categoryHref && product.category ? [{ label: product.category, href: categoryHref }] : []),
					{ label: product.name },
				],
				options: detail.productOptions.edges.flatMap(({ node }) => node.values?.edges.length ? [{
					entityId: node.entityId, displayName: node.displayName, isRequired: node.isRequired,
					displayStyle: node.displayStyle ?? null, values: node.values.edges.map(({ node: value }) => value),
				}] : []),
				relatedProducts,
				relatedProductHrefs: materializeKibbleProductHrefs(relatedProducts),
				...KIBBLE_PRESERVE_MANIFEST.display.pdp,
			},
			provenance: {
				reference: { status: 'contracted', id: decision.policy.provenance.referenceId, version: decision.policy.provenance.referenceVersion },
				surface: 'pdp', route: `/product/${slug}`,
				autonomy: { preset: decision.policy.provenance.preset, decisionMode: decision.policy.decisionMode, publicationMode: decision.policy.publicationMode },
				renderer: { componentId: 'kibble.product-detail', variantId: 'kibble-pdp-reference-v1' },
				decisionSource: 'fixed',
			},
		};
	} catch (cause) {
		if (typeof cause === 'object' && cause !== null && 'status' in cause) throw cause;
		return failClosed(cause, 'catalog or policy');
	}
}

function materializeKibbleProduct(p: BCKibbleProductDetail, expectedSlug: string) {
	const product = transformProduct(p);
	if (product.id !== expectedSlug || !product.name || !Number.isFinite(product.price) || product.price < 0) {
		throw new Error('Kibble PDP received incomplete or mismatched catalog identity.');
	}
	return {
		...product,
		sku: p.sku.trim(),
		currencyCode: p.prices.price.currencyCode,
		isInStock: p.inventory?.isInStock ?? null,
		images: p.images.edges
			.map(({ node }) => ({ url: node.url, alt: node.altText || product.name }))
			.filter(({ url }) => /^https:\/\//.test(url)),
	};
}

function transformProduct(p: BCProduct) {
	const specs = customFieldsToRecord(p);
	return {
		id: p.path.replace(/^\/|\/$/g, '') || String(p.entityId), entityId: p.entityId, name: p.name,
		price: p.prices.price.value, salePrice: p.prices.salePrice?.value || undefined,
		image: p.defaultImage?.url || '', imageAlt: p.defaultImage?.altText || p.name,
		description: stripHtml(p.description), descriptionPlain: stripHtml(p.description), specs,
		tags: Object.values(specs).slice(0, 3), category: p.categories.edges[0]?.node.name || '', categoryPath: p.categories.edges[0]?.node.path || '',
	};
}

/** The non-Kibble route keeps its pre-existing rich catalog description. */
function transformLegacyProduct(p: BCProduct) {
	const product = transformProduct(p);
	return { ...product, description: p.description };
}

function stripHtml(html: string): string { return html.replace(/<[^>]*>/g, '').trim(); }
function materializeKibbleCategoryHref(path: string): string | null {
	const slug = path.replace(/^\/|\/$/g, '').replace(/^kibble-/i, '');
	return Object.hasOwn(getBrand().categories, slug) ? `/category/${slug}` : null;
}
