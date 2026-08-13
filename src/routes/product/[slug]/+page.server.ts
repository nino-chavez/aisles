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
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { materializeKibbleProductHrefs } from '$lib/brand/reference/kibble-runtime';
import { assertKibblePreserveRoutePolicy, getContractSurfaceDecision } from '$lib/brand/composition-policy';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import { buildContractedLayoutProvenance } from '$lib/server/layout-provenance';
import { logGeneration } from '$lib/server/generation-log';
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';

export const load: PageServerLoad = async ({ params, url, request, cookies, parent }) => {
	const slug = params.slug;
	const { devMode, renderMode } = await parent();

	if (renderMode === 'reference-preserve') {
		return loadKibblePreservePdp({ slug, url, request, cookies });
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

async function loadKibblePreservePdp({
	slug, url, request, cookies,
}: {
	slug: string;
	url: URL;
	request: Request;
	cookies: { get: (name: string) => string | undefined; set: (name: string, value: string, options: { path: string; maxAge?: number }) => void };
}) {
	const preserveStartedAt = Date.now();
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
		const { store, visitCount } = await createStoreFromRequest({ url, request, cookies, category: slug });
		const inference = infer(store.toInferenceContext());
		cookies.set('aisles_persona', inference.primary, { path: '/', maxAge: 60 * 60 * 24 * 30 });
		cookies.set('aisles_visits', String(visitCount), { path: '/', maxAge: 60 * 60 * 24 * 30 });
		const detail = await getKibbleProductDetailByPath(`/${slug}/`);
		if (!detail) throw error(404, 'Product not found');

		const product = materializeKibbleProduct(detail, slug);
		const categoryHref = materializeKibbleCategoryHref(product.categoryPath);
		const relatedProducts = detail.relatedProducts.edges
			.map(({ node }) => materializeKibbleCatalogProduct(node, 'related product'))
			.filter((candidate) => candidate.entityId !== product.entityId)
			.slice(0, 4);
		const provenance = buildContractedLayoutProvenance({
			policy: decision.policy,
			surface: 'pdp',
			route: url.pathname,
			persona: inference.primary,
			rendererComponentId: 'kibble.product-detail',
			rendererVariantId: KIBBLE_REFERENCE_CONTRACT.recipes.pdp.id,
			decisionSource: 'fixed',
			promptVersion: 'no-model-preserve-v1',
			schemaVersion: `kibble-reference-${KIBBLE_REFERENCE_CONTRACT.version}`,
			contractInput: KIBBLE_REFERENCE_CONTRACT.recipes.pdp,
			catalogInput: { product, options: detail.productOptions.edges, relatedProducts },
			shopperContext: { persona: inference.primary, probabilities: inference.probabilities },
			scenarioId: store.getCrossSessionContext().scenarioId,
		});
		await logGeneration({
			type: 'preserve_render', persona: inference.primary, categorySlug: slug, cacheHit: false,
			generationTimeMs: Date.now() - preserveStartedAt, productCount: relatedProducts.length + 1,
			sessionId: cookies.get('aisles_session') || undefined, provenance,
		});

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
			provenance,
		};
	} catch (cause) {
		if (typeof cause === 'object' && cause !== null && 'status' in cause) throw cause;
		return failClosed(cause, 'catalog or policy');
	}
}

function materializeKibbleProduct(p: BCKibbleProductDetail, expectedSlug: string) {
	const product = materializeKibbleCatalogProduct(p, 'product');
	if (product.id !== expectedSlug || !product.name || !Number.isFinite(product.price) || product.price < 0) {
		throw new Error('Kibble PDP received incomplete or mismatched catalog identity.');
	}
	return {
		...product,
		sku: p.sku.trim(),
		currencyCode: product.currencyCode,
		isInStock: p.inventory?.isInStock ?? null,
		images: p.images.edges
			.map(({ node }) => ({ url: node.url, alt: node.altText || product.name }))
			.filter(({ url }) => /^https:\/\//.test(url)),
	};
}

function materializeKibbleCatalogProduct(p: BCProduct, label: string) {
	const listPrice = p.prices?.price?.value;
	const salePrice = p.prices?.salePrice?.value ?? null;
	const currencyCode = p.prices?.price?.currencyCode;
	if (!Number.isFinite(listPrice) || listPrice < 0) throw new Error(`Kibble ${label} has an invalid list price.`);
	if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0 || salePrice >= listPrice)) {
		throw new Error(`Kibble ${label} has an invalid sale price.`);
	}
	if (currencyCode !== 'USD') throw new Error(`Kibble ${label} has an unsupported currency.`);
	const product = transformProduct(p);
	return { ...product, price: listPrice, salePrice: salePrice ?? undefined, currencyCode };
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
