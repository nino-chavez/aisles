import type { PageServerLoad } from './$types';
import { env as privateEnv } from '$env/dynamic/private';
import {
	customFieldsToRecord,
	getKibbleProductDetailByPath,
	resolveKibblePdpRelatedProducts,
	getProductByPath,
	getProductsByCategory,
	type BCProduct,
	type BCKibbleProductDetail,
} from '$lib/server/bigcommerce';
import { getBrand } from '$lib/brand/config';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';
import { KIBBLE_PDP_BUNDLE_PROJECTION_VERIFIED_SHA256 } from '$lib/brand/reference/kibble-manifest.server';
import {
	KIBBLE_PDP_BOUNDS,
	KIBBLE_PDP_RICH_DESCRIPTION_TAGS,
	KIBBLE_PDP_SUPPORTED_CURRENCIES,
	KIBBLE_REFERENCE_CONTRACT,
} from '$lib/brand/reference/kibble';
import { isKibblePdpPublished, materializeKibblePdpHrefs, type MerchantRenderMode } from '$lib/brand/reference/kibble-runtime';
import type { KibblePdpBundle, KibblePdpCopy, KibbleProductOption } from '$lib/components/kibble/types';
import {
	assertKibblePreserveRoutePolicy,
	getContractSurfaceDecision,
	getKibbleObservePdpRelatedModelPolicyDescriptor,
} from '$lib/brand/composition-policy';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import { buildContractedLayoutProvenance } from '$lib/server/layout-provenance';
import { logGeneration } from '$lib/server/generation-log';
import { executeKibblePdpRelatedZoneAdapter } from '$lib/brand/reference/kibble-zone-executor.server';
import { throwKibblePreserveError } from '$lib/brand/reference/kibble-error.server';
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';

export const load: PageServerLoad = async ({ params, url, request, cookies, parent }) => {
	const slug = params.slug;
	const { devMode, renderMode, observeMode } = await parent();

	if (renderMode === 'reference-unavailable') {
		await throwKibblePreserveError({
			brandId: getBrand().id,
			surface: 'error-empty',
			routePath: url.pathname,
			status: 503,
			message: 'This Kibble product is pending merchant approval.',
		});
	}
	if (renderMode === 'reference-preserve' || renderMode === 'reference-review') {
		return loadKibblePreservePdp({ slug, url, request, cookies, renderMode, observeMode });
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
	slug, url, request, cookies, renderMode, observeMode,
}: {
	slug: string;
	url: URL;
	request: Request;
	cookies: { get: (name: string) => string | undefined; set: (name: string, value: string, options: { path: string; maxAge?: number }) => void };
	renderMode: Extract<MerchantRenderMode, 'reference-preserve' | 'reference-review'>;
	observeMode: boolean;
}) {
	const preserveStartedAt = Date.now();
	const failClosed = async (cause: unknown, phase: string): Promise<never> => {
		const detail = cause instanceof Error ? cause.message : `Unknown Kibble PDP ${phase} error.`;
		console.error(`[kibble-preserve] product ${phase} failed closed:`, detail);
		return throwKibblePreserveError({
			brandId: getBrand().id,
			surface: 'error-empty',
			routePath: url.pathname,
			status: 503,
			message: 'This Kibble product is temporarily unavailable.',
		});
	};

	try {
		if (slug.length > KIBBLE_PDP_BOUNDS.strings.routeId || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
			await throwKibblePreserveError({
				brandId: getBrand().id,
				surface: 'error-404',
				routePath: url.pathname,
				status: 404,
				message: 'Product not found.',
			});
		}
		const decision = getContractSurfaceDecision(getBrand().id, 'pdp');
		if (decision.mode !== 'reference-preserve') throw new Error('Kibble PDP policy is unavailable.');
		assertKibblePreserveRoutePolicy(decision.policy, 'pdp');
		if (renderMode === 'reference-review' && (!dev || decision.policy.publicationMode !== 'approval_required')) {
			throw new Error('Kibble PDP review mode is not authorized in this build.');
		}
		if (renderMode === 'reference-preserve' && !isKibblePdpPublished()) {
			throw new Error('Kibble PDP publication is not approved.');
		}

		const { store, visitCount } = await createStoreFromRequest({ url, request, cookies, category: slug });
		const inference = infer(store.toInferenceContext());
		cookies.set('aisles_persona', inference.primary, { path: '/', maxAge: 60 * 60 * 24 * 30 });
		cookies.set('aisles_visits', String(visitCount), { path: '/', maxAge: 60 * 60 * 24 * 30 });
		const detail = await getKibbleProductDetailByPath(`/${slug}/`);
		if (!detail) {
			return await throwKibblePreserveError({
				brandId: getBrand().id,
				surface: 'error-404',
				routePath: url.pathname,
				status: 404,
				message: 'Product not found.',
			});
		}

		const product = materializeKibbleProduct(detail, slug);
		const manifest = materializeKibblePdpManifest(slug, product.name);
		const categoryHref = materializeKibbleCategoryHref(product.categoryPath);
		boundedArray(detail.relatedProducts?.edges, 'related products', KIBBLE_PDP_BOUNDS.arrays.relatedProducts);
		const relatedResolution = await resolveKibblePdpRelatedProducts(detail);
		const relatedProducts = relatedResolution.products
			.map((candidate) => materializeKibbleCatalogProduct(candidate, 'related product'));
		assertUnique(relatedProducts.map(({ entityId }) => entityId), 'related product entity ids');
		const relatedModelDecision = (
			observeMode &&
			privateEnv.KIBBLE_DEMO_AI_ENABLED === 'true' &&
			relatedProducts.length >= 3 && relatedProducts.length <= 4
		) ? getKibbleObservePdpRelatedModelPolicyDescriptor(url.pathname) : null;
		const options = materializeKibbleOptions(detail);
		const breadcrumbs = [
			{ label: boundedCopy(manifest.breadcrumbHomeLabel, 'breadcrumbs[].label', 'PDP home breadcrumb'), href: '/' },
			...(categoryHref && product.category ? [{ label: boundedCopy(product.category, 'breadcrumbs[].label', 'PDP category breadcrumb'), href: categoryHref }] : []),
			{ label: boundedCopy(product.name, 'breadcrumbs[].label', 'PDP product breadcrumb') },
		];
		boundedArray(breadcrumbs, 'breadcrumbs', KIBBLE_PDP_BOUNDS.arrays.breadcrumbs);
		const provenance = buildContractedLayoutProvenance({
			policy: decision.policy,
			surface: 'pdp',
			route: url.pathname,
			persona: inference.primary,
			rendererComponentId: 'kibble.product-detail',
			rendererVariantId: KIBBLE_REFERENCE_CONTRACT.recipes.pdp.variantId,
			decisionSource: 'fixed',
			promptVersion: 'no-model-preserve-v1',
			schemaVersion: `kibble-reference-${KIBBLE_REFERENCE_CONTRACT.version}`,
			contractInput: {
				recipe: KIBBLE_REFERENCE_CONTRACT.recipes.pdp,
				renderedManifest: manifest,
				bundleProjectionSha256: KIBBLE_PDP_BUNDLE_PROJECTION_VERIFIED_SHA256,
			},
			catalogInput: {
				product,
				options,
				relatedProducts,
				relatedCandidateSource: relatedResolution.candidateSource,
				relatedRelationKind: relatedResolution.relationKind,
			},
			shopperContext: { persona: inference.primary, probabilities: inference.probabilities },
			scenarioId: store.getCrossSessionContext().scenarioId,
		});
		await logGeneration({
			type: 'preserve_render', persona: inference.primary, categorySlug: slug, cacheHit: false,
			generationTimeMs: Date.now() - preserveStartedAt, productCount: relatedProducts.length + 1,
			sessionId: cookies.get('aisles_session') || undefined, provenance,
		});

		return {
			renderMode,
			kibblePdp: {
				product,
				breadcrumbs,
				options,
				relatedProducts,
				relatedProductHrefs: materializeKibblePdpHrefs(relatedProducts),
				bundle: manifest.bundle,
				purchaseUnavailableLabel: manifest.purchaseUnavailableLabel,
				purchaseUnavailableBody: manifest.purchaseUnavailableBody,
				relatedHeading: manifest.relatedHeading,
				relatedCandidateSource: relatedResolution.candidateSource,
				relatedRelationKind: relatedResolution.relationKind,
				copy: manifest.copy,
				zoneAdapter: await executeKibblePdpRelatedZoneAdapter(relatedProducts, manifest.relatedHeading, url.pathname),
				relatedModelDecision,
			},
			provenance,
		};
	} catch (cause) {
		if (typeof cause === 'object' && cause !== null && 'status' in cause) throw cause;
		return await failClosed(cause, 'catalog or policy');
	}
}

const PDP_COPY_LIMITS = new Map(
	KIBBLE_REFERENCE_CONTRACT.components
		.find(({ id }) => id === 'kibble.product-detail')!
		.variants.find(({ id }) => id === KIBBLE_REFERENCE_CONTRACT.recipes.pdp.variantId)!
		.copyFields.map(({ field, maxLength }) => [field, maxLength]),
);

function materializeKibblePdpManifest(slug: string, productName: string) {
	const source = KIBBLE_PRESERVE_MANIFEST.display.pdp;
	const copy = Object.fromEntries(
		Object.entries(source.copy).map(([key, value]) => [key, boundedCopy(value, 'copy.*', `PDP copy ${key}`)]),
	) as KibblePdpCopy;
	const bundleSource = source.bundles as Record<string, {
		readonly name: string;
		readonly contents: ReadonlyArray<{ readonly brand: string; readonly title: string; readonly role: string; readonly image: string }>;
	}>;
	const sourceBundle = Object.hasOwn(bundleSource, slug) ? bundleSource[slug] : null;
	let bundle: KibblePdpBundle | null = null;
	if (sourceBundle) {
		const name = boundedCopy(sourceBundle.name, 'bundle.name', 'bundle name');
		if (name !== productName) throw new Error('Kibble bundle manifest does not match the catalog product name.');
		const contents = boundedArray(sourceBundle.contents, 'bundle contents', KIBBLE_PDP_BOUNDS.arrays.bundleContents);
		if (contents.length === 0) throw new Error('Kibble bundle manifest cannot render an empty bundle.');
		bundle = {
			name,
			contents: contents.map((item, index) => ({
				brand: boundedCopy(item.brand, 'bundle.contents[].brand', `bundle content ${index + 1} brand`),
				title: boundedCopy(item.title, 'bundle.contents[].title', `bundle content ${index + 1} title`),
				role: boundedCopy(item.role, 'bundle.contents[].role', `bundle content ${index + 1} role`),
				image: validatedHttpsUrl(item.image, `bundle content ${index + 1} image`),
			})),
		};
	}

	return {
		breadcrumbHomeLabel: source.breadcrumbHomeLabel,
		purchaseUnavailableLabel: boundedCopy(source.purchaseUnavailableLabel, 'purchaseUnavailableLabel', 'purchase unavailable label'),
		purchaseUnavailableBody: boundedCopy(source.purchaseUnavailableBody, 'purchaseUnavailableBody', 'purchase unavailable body'),
		relatedHeading: boundedCopy(source.relatedHeading, 'relatedHeading', 'related products heading'),
		copy,
		bundle,
	};
}

function materializeKibbleProduct(p: BCKibbleProductDetail, expectedSlug: string) {
	const product = materializeKibbleCatalogProduct(p, 'product');
	if (product.id !== expectedSlug) throw new Error('Kibble PDP received mismatched catalog identity.');
	const imageEdges = boundedArray(p.images?.edges, 'product images', KIBBLE_PDP_BOUNDS.arrays.images);
	const images = imageEdges.map(({ node }, index) => ({
		url: validatedHttpsUrl(node?.url, `product image ${index + 1}`),
		alt: boundedCopy(node?.altText || product.name, 'product.images[].alt', `product image ${index + 1} alt text`),
	}));
	const isInStock = p.inventory === null || p.inventory === undefined
		? null
		: typeof p.inventory.isInStock === 'boolean'
			? p.inventory.isInStock
			: (() => { throw new Error('Kibble product has invalid inventory data.'); })();
	return {
		...product,
		sku: boundedOptionalCopy(p.sku, 'product.sku', 'product SKU'),
		isInStock,
		images,
	};
}

function materializeKibbleCatalogProduct(p: BCProduct, label: string) {
	assertPositiveInteger(p?.entityId, `${label} entity id`);
	const id = materializeProductId(p?.path, label);
	const name = boundedCopy(p?.name, 'product.name', `${label} name`);
	const { listPrice, salePrice, currencyCode } = materializeMoney(p, label);
	const categoryEdges = boundedArray(p.categories?.edges, `${label} categories`, KIBBLE_PDP_BOUNDS.arrays.categories);
	const categoryNode = categoryEdges[0]?.node;
	const category = categoryNode ? boundedCopy(categoryNode.name, 'product.category', `${label} category`) : '';
	const categoryPath = categoryNode ? materializeCategoryPath(categoryNode.path, label) : '';
	const specs = materializeSpecs(p, label);
	const description = projectReadOnlyKibbleDescription(
		materializeRichDescription(p?.description, `${label} description`),
	);
	const image = p.defaultImage ? validatedHttpsUrl(p.defaultImage.url, `${label} default image`) : '';
	const imageAlt = p.defaultImage
		? boundedCopy(p.defaultImage.altText || name, 'product.images[].alt', `${label} default image alt text`)
		: name;
	return {
		id,
		entityId: p.entityId,
		name,
		price: listPrice,
		...(salePrice === null ? {} : { salePrice }),
		currencyCode,
		image,
		imageAlt,
		description,
		descriptionPlain: stripHtml(description),
		specs,
		tags: Object.values(specs).slice(0, 3),
		category,
		categoryPath,
	};
}

function materializeKibbleOptions(p: BCKibbleProductDetail): KibbleProductOption[] {
	const optionEdges = boundedArray(p.productOptions?.edges, 'product options', KIBBLE_PDP_BOUNDS.arrays.options);
	const options = optionEdges.flatMap(({ node }, index): KibbleProductOption[] => {
		if (!node?.values) return [];
		const valueEdges = boundedArray(node.values.edges, `option ${index + 1} values`, KIBBLE_PDP_BOUNDS.arrays.optionValues);
		if (valueEdges.length === 0) return [];
		assertPositiveInteger(node.entityId, `option ${index + 1} entity id`);
		if (typeof node.isRequired !== 'boolean') throw new Error(`Kibble option ${index + 1} has invalid required state.`);
		const values = valueEdges.map(({ node: value }, valueIndex) => {
			assertPositiveInteger(value?.entityId, `option ${index + 1} value ${valueIndex + 1} entity id`);
			if (typeof value.isDefault !== 'boolean') throw new Error(`Kibble option ${index + 1} value ${valueIndex + 1} has invalid default state.`);
			return {
				entityId: value.entityId,
				label: boundedCopy(value.label, 'options[].values[].label', `option ${index + 1} value ${valueIndex + 1} label`),
				isDefault: value.isDefault,
			};
		});
		assertUnique(values.map(({ entityId }) => entityId), `option ${index + 1} value entity ids`);
		if (values.filter(({ isDefault }) => isDefault).length > 1) throw new Error(`Kibble option ${index + 1} has multiple default values.`);
		return [{
			entityId: node.entityId,
			displayName: boundedCopy(node.displayName, 'options[].displayName', `option ${index + 1} name`),
			isRequired: node.isRequired,
			displayStyle: null,
			values,
		}];
	});
	assertUnique(options.map(({ entityId }) => entityId), 'product option entity ids');
	return options;
}

function materializeMoney(p: BCProduct, label: string) {
	const listPrice = p.prices?.price?.value;
	const currencyCode = p.prices?.price?.currencyCode;
	const sale = p.prices?.salePrice ?? null;
	if (typeof listPrice !== 'number' || !Number.isFinite(listPrice) || listPrice < 0) {
		throw new Error(`Kibble ${label} has an invalid list price.`);
	}
	if (typeof currencyCode !== 'string' || !/^[A-Z]{3}$/.test(currencyCode) || !KIBBLE_PDP_SUPPORTED_CURRENCIES.includes(currencyCode as 'USD')) {
		throw new Error(`Kibble ${label} has an unsupported currency.`);
	}
	if (sale === null) return { listPrice, salePrice: null, currencyCode };
	if (sale.currencyCode !== currencyCode) throw new Error(`Kibble ${label} sale price currency does not match its list price.`);
	if (typeof sale.value !== 'number' || !Number.isFinite(sale.value) || sale.value < 0 || sale.value >= listPrice) {
		throw new Error(`Kibble ${label} has an invalid sale price.`);
	}
	return { listPrice, salePrice: sale.value, currencyCode };
}

function materializeSpecs(p: BCProduct, label: string): Record<string, string> {
	const fieldEdges = boundedArray(p.customFields?.edges, `${label} custom fields`, KIBBLE_PDP_BOUNDS.arrays.customFields);
	const entries = fieldEdges.map(({ node }, index) => [
		boundedCopy(node?.name, 'product.specs[].label', `${label} custom field ${index + 1} name`),
		boundedCopy(node?.value, 'product.specs[].value', `${label} custom field ${index + 1} value`),
	] as const);
	assertUnique(entries.map(([key]) => key), `${label} custom field names`);
	return Object.fromEntries(entries);
}

function materializeRichDescription(value: unknown, label: string): string {
	const description = boundedOptionalCopy(value, 'product.description', label);
	if (!description) return '';
	const allowed = new Set<string>(KIBBLE_PDP_RICH_DESCRIPTION_TAGS);
	const tagPattern = /<[^>]*>/g;
	let output = '';
	let cursor = 0;
	let anchorDepth = 0;
	for (const match of description.matchAll(tagPattern)) {
		const index = match.index ?? 0;
		const text = description.slice(cursor, index);
		if (text.includes('<')) throw new Error(`Kibble ${label} contains malformed HTML.`);
		output += text;
		const tag = match[0];
		const simple = tag.match(/^<\s*(\/?)\s*([a-z]+)\s*\/?\s*>$/i);
		if (simple && allowed.has(simple[2].toLowerCase()) && simple[2].toLowerCase() !== 'a') {
			output += tag;
		} else if (/^<\s*\/\s*a\s*>$/i.test(tag) && anchorDepth === 1) {
			output += '</a>';
			anchorDepth = 0;
		} else {
			const anchor = tag.match(/^<a\s+href=(["'])(https:\/\/[^"'<>\s]+)\1\s*>$/i);
			if (!anchor || anchorDepth !== 0) throw new Error(`Kibble ${label} contains unsupported HTML.`);
			const href = validatedHttpsUrl(anchor[2], `${label} link`);
			output += `<a href="${href}" rel="noopener noreferrer">`;
			anchorDepth = 1;
		}
		cursor = index + tag.length;
	}
	const trailing = description.slice(cursor);
	if (trailing.includes('<') || anchorDepth !== 0) throw new Error(`Kibble ${label} contains malformed HTML.`);
	return boundedOptionalCopy(output + trailing, 'product.description', label);
}

/**
 * The connected reference storefront may publish transactional Auto-Refill
 * prices inside catalog descriptions. Preserve can display catalog facts, but
 * it must not repeat an offer that this sibling cannot fulfill. If a catalog
 * description mixes product copy with one of those operational claims, omit
 * the block instead of presenting a contradictory partial sentence.
 */
function projectReadOnlyKibbleDescription(description: string): string {
	const plain = stripHtml(description);
	return /\b(?:auto[-\s]?refill|subscribe|subscription|member\s+price|one[-\s]?time\s+(?:price|purchase|\$)|save\s+\d+%)\b/i.test(plain)
		? ''
		: description;
}

function boundedCopy(value: unknown, field: string, label: string): string {
	const result = boundedString(value, copyLimit(field), label);
	if (!result) throw new Error(`Kibble ${label} is empty.`);
	return result;
}

function boundedOptionalCopy(value: unknown, field: string, label: string): string {
	return boundedString(value, copyLimit(field), label);
}

function boundedString(value: unknown, maxLength: number, label: string): string {
	if (typeof value !== 'string') throw new Error(`Kibble ${label} is not a string.`);
	const result = value.trim();
	if (result.length > maxLength) throw new Error(`Kibble ${label} exceeds ${maxLength} characters.`);
	return result;
}

function copyLimit(field: string): number {
	const limit = PDP_COPY_LIMITS.get(field);
	if (!limit) throw new Error(`Kibble PDP contract has no copy bound for ${field}.`);
	return limit;
}

function boundedArray<T>(value: readonly T[] | null | undefined, label: string, maxLength: number): T[] {
	if (!Array.isArray(value)) throw new Error(`Kibble ${label} are not an array.`);
	if (value.length > maxLength) throw new Error(`Kibble ${label} exceed the ${maxLength}-item contract bound.`);
	return [...value];
}

function validatedHttpsUrl(value: unknown, label: string): string {
	const url = boundedString(value, KIBBLE_PDP_BOUNDS.strings.assetUrl, label);
	let parsed: URL;
	try { parsed = new URL(url); } catch { throw new Error(`Kibble ${label} is not a valid URL.`); }
	if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname) {
		throw new Error(`Kibble ${label} must be an HTTPS URL without credentials.`);
	}
	return url;
}

function materializeProductId(value: unknown, label: string): string {
	const path = boundedString(value, KIBBLE_PDP_BOUNDS.strings.routeId + 2, `${label} path`);
	const match = path.match(/^\/([a-z0-9][a-z0-9-]*)\/$/);
	if (!match || match[1].length > KIBBLE_PDP_BOUNDS.strings.routeId) throw new Error(`Kibble ${label} has an invalid product path.`);
	return match[1];
}

function materializeCategoryPath(value: unknown, label: string): string {
	const path = boundedString(value, KIBBLE_PDP_BOUNDS.strings.categoryPath, `${label} category path`);
	if (!/^\/[a-z0-9][a-z0-9/-]*\/$/.test(path)) throw new Error(`Kibble ${label} has an invalid category path.`);
	return path;
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
	if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) throw new Error(`Kibble ${label} is invalid.`);
}

function assertUnique(values: Array<string | number>, label: string): void {
	if (new Set(values).size !== values.length) throw new Error(`Kibble ${label} are not unique.`);
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
