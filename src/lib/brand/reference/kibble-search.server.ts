import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { getBrand } from '$lib/brand/config';
import type { KibbleProduct, KibbleSearchResponseProvenance } from '$lib/components/kibble/types';
import { z } from 'zod';
import { parseKibblePlpCursor } from './kibble-plp';
import { KIBBLE_REFERENCE_CONTRACT } from './kibble';

export const KIBBLE_SEARCH_PAGE_SIZE = 24;
const PARITY_FIXTURE_HEADER = 'x-kibble-parity-fixture-sha256';
const PARITY_REQUEST_HEADER = 'x-kibble-parity-request-sha256';
const PARITY_CATALOG_HEADER = 'x-kibble-parity-catalog-sha256';
const PARITY_ATTESTATION_HEADER = 'x-kibble-parity-attestation';

const CursorSchema = z.string().min(1).max(512).regex(/^[A-Za-z0-9+/_=-]+$/).nullable();
const PageInfoSchema = z.object({
	hasNextPage: z.boolean(), hasPreviousPage: z.boolean(),
	startCursor: CursorSchema, endCursor: CursorSchema,
}).strict();
const ProductSchema = z.object({
	entityId: z.number().int().positive(),
	name: z.string().trim().min(1).max(200),
	sku: z.string().max(200),
	path: z.string().trim().min(1).max(500),
	description: z.string().max(100_000),
	prices: z.object({
		price: z.object({ value: z.number().nonnegative(), currencyCode: z.literal('USD') }).strict(),
		salePrice: z.object({ value: z.number().nonnegative(), currencyCode: z.literal('USD') }).strict().nullable(),
	}).strict(),
	defaultImage: z.object({ url: z.string().url(), altText: z.string().max(500) }).strict().nullable(),
	customFields: z.object({ edges: z.array(z.object({ node: z.object({ name: z.string(), value: z.string() }).strict() }).strict()).max(10) }).strict(),
	categories: z.object({ edges: z.array(z.object({ node: z.object({ entityId: z.number().int(), name: z.string(), path: z.string() }).strict() }).strict()).max(5) }).strict(),
}).strict();
const SearchResponseSchema = z.object({
	data: z.object({
		site: z.object({
			search: z.object({
				searchProducts: z.object({
					products: z.object({
						edges: z.array(z.object({ node: ProductSchema }).strict()).max(KIBBLE_SEARCH_PAGE_SIZE),
						pageInfo: PageInfoSchema,
					}).strict(),
				}).strict(),
			}).strict(),
		}).strict(),
	}).strict(),
	errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
}).strict();

const PRODUCT_FRAGMENT = `
	entityId name sku path description
	prices { price { value currencyCode } salePrice { value currencyCode } }
	defaultImage { url(width: 800, height: 800) altText }
	customFields(first: 10) { edges { node { name value } } }
	categories(first: 5) { edges { node { entityId name path } } }
`;

/**
 * Pinned canonical SearchProducts query, adapted as a bounded read-only
 * server call. Verified 2026-08-13: BigCommerce documents textual search at:
 * https://docs.bigcommerce.com/developer/docs/storefront/headless/products/faceted-textual-search
 * and the GraphQL POST/Bearer request shape at:
 * https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/overview
 */
export const KIBBLE_SEARCH_PRODUCTS_QUERY = `
	query SearchProducts($searchTerm: String!, $first: Int!, $after: String) {
		site {
			search {
				searchProducts(filters: { searchTerm: $searchTerm }) {
					products(first: $first, after: $after) {
						edges { node { ${PRODUCT_FRAGMENT} } }
						pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
					}
				}
			}
		}
	}
`;

export class KibbleSearchInputError extends Error {
	constructor(message: string) { super(message); this.name = 'KibbleSearchInputError'; }
}

export function parseKibbleSearchQuery(value: string | null): string {
	const query = value?.trim() ?? '';
	if (query.length > 160) throw new KibbleSearchInputError('Search query exceeds 160 characters.');
	if (/\p{C}/u.test(query)) throw new KibbleSearchInputError('Search query contains unsupported control characters.');
	return query;
}

export function parseKibbleSearchCursor(value: string | null): string | null {
	try { return parseKibblePlpCursor(value); }
	catch { throw new KibbleSearchInputError('Invalid search cursor.'); }
}

export function buildKibbleSearchHref(query: string, after: string): string {
	const boundedQuery = parseKibbleSearchQuery(query);
	const boundedCursor = parseKibbleSearchCursor(after);
	if (!boundedQuery || !boundedCursor) throw new KibbleSearchInputError('Search pagination requires a query and cursor.');
	const params = new URLSearchParams({ q: boundedQuery, after: boundedCursor });
	return `?${params.toString()}`;
}

export async function searchKibbleCatalog(input: {
	query: string;
	after?: string | null;
	fetchImpl?: typeof fetch;
}): Promise<{
	products: KibbleProduct[];
	pageInfo: z.infer<typeof PageInfoSchema>;
	provenance: Omit<KibbleSearchResponseProvenance, 'policyVersion' | 'routePath'>;
}> {
	const query = parseKibbleSearchQuery(input.query);
	const after = parseKibbleSearchCursor(input.after ?? null);
	const brand = getBrand();
	const storeHash = env.BIGCOMMERCE_STORE_HASH;
	const token = env[`${brand.id.toUpperCase()}_STOREFRONT_TOKEN`] || env.BIGCOMMERCE_STOREFRONT_TOKEN;
	const emptyPageInfo = { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null };
	if (!query) {
		return {
			products: [],
			pageInfo: emptyPageInfo,
			provenance: buildResponseProvenance({
				query, after, source: 'not-requested', products: [], pageInfo: emptyPageInfo,
			}),
		};
	}
	if (!storeHash || !token) throw new Error('Kibble read-only catalog search is not configured.');
	const host = brand.bc.channelId === 1
		? `store-${storeHash}.mybigcommerce.com`
		: `store-${storeHash}-${brand.bc.channelId}.mybigcommerce.com`;
	const response = await (input.fetchImpl ?? fetch)(`https://${host}/graphql`, {
		method: 'POST',
		headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify({ query: KIBBLE_SEARCH_PRODUCTS_QUERY, variables: { searchTerm: query, first: KIBBLE_SEARCH_PAGE_SIZE, after } }),
	});
	if (!response.ok) throw new Error(`Kibble catalog search returned HTTP ${response.status}.`);
	const parsed = SearchResponseSchema.safeParse(await response.json());
	if (!parsed.success || parsed.data.errors?.length) throw new Error('Kibble catalog search returned an invalid response.');
	const result = parsed.data.data.site.search.searchProducts.products;
	const products = result.edges.map(({ node }) => toKibbleProduct(node));
	const catalogSha256 = digest({ products: result.edges.map(({ node }) => node), pageInfo: result.pageInfo });
	const parityFixture = validatesParityFixtureAttestation({ response, query, after, catalogSha256 });
	return {
		products,
		pageInfo: result.pageInfo,
		provenance: buildResponseProvenance({
			query,
			after,
			catalogSha256,
			source: parityFixture ? 'parity-fixture' : 'live-storefront',
			products,
			pageInfo: result.pageInfo,
		}),
	};
}

function buildResponseProvenance(input: {
	query: string;
	after: string | null;
	catalogSha256?: string;
	source: KibbleSearchResponseProvenance['source'];
	products: KibbleProduct[];
	pageInfo: z.infer<typeof PageInfoSchema>;
}): Omit<KibbleSearchResponseProvenance, 'policyVersion' | 'routePath'> {
	const fixedDataIdentity = input.source === 'parity-fixture' ? KIBBLE_REFERENCE_CONTRACT.source.fixtureSha256 : undefined;
	const catalogSha256 = input.catalogSha256 ?? digest({ products: input.products, pageInfo: input.pageInfo });
	return {
		referenceId: KIBBLE_REFERENCE_CONTRACT.id,
		referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
		source: input.source,
		query: input.query,
		cursor: input.after,
		pageSize: KIBBLE_SEARCH_PAGE_SIZE,
		catalogSha256,
		resultSha256: digest({ products: input.products, pageInfo: input.pageInfo }),
		...(fixedDataIdentity ? { fixedDataIdentity } : {}),
	};
}

function validatesParityFixtureAttestation(input: {
	response: Response;
	query: string;
	after: string | null;
	catalogSha256: string;
}): boolean {
	const key = env.KIBBLE_PARITY_ATTESTATION_KEY;
	if (!key || !/^[a-f0-9]{64}$/.test(key)) return false;
	const fixtureSha256 = input.response.headers.get(PARITY_FIXTURE_HEADER);
	const requestSha256 = input.response.headers.get(PARITY_REQUEST_HEADER);
	const catalogSha256 = input.response.headers.get(PARITY_CATALOG_HEADER);
	const attestation = input.response.headers.get(PARITY_ATTESTATION_HEADER);
	if (fixtureSha256 !== KIBBLE_REFERENCE_CONTRACT.source.fixtureSha256 || catalogSha256 !== input.catalogSha256 || !requestSha256 || !attestation) return false;
	const expectedRequestSha256 = digest({
		operation: 'SearchProducts',
		variables: { searchTerm: input.query, first: KIBBLE_SEARCH_PAGE_SIZE, after: input.after },
	});
	if (requestSha256 !== expectedRequestSha256) return false;
	const expected = createHmac('sha256', key)
		.update(parityAttestationPayload(fixtureSha256, requestSha256, catalogSha256))
		.digest('hex');
	if (!/^[a-f0-9]{64}$/.test(attestation)) return false;
	return timingSafeEqual(Buffer.from(attestation, 'hex'), Buffer.from(expected, 'hex'));
}

function parityAttestationPayload(fixtureSha256: string, requestSha256: string, catalogSha256: string): string {
	return `kibble-search-parity-v1\nfixture=${fixtureSha256}\nrequest=${requestSha256}\ncatalog=${catalogSha256}`;
}

function digest(value: unknown): string {
	return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value as Record<string, unknown>)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, child]) => [key, canonical(child)]));
	}
	return value;
}

function toKibbleProduct(product: z.infer<typeof ProductSchema>): KibbleProduct {
	const specs = Object.fromEntries(product.customFields.edges.map(({ node }) => [node.name, node.value]));
	return {
		id: product.path.replace(/^\/|\/$/g, '') || String(product.entityId),
		entityId: product.entityId,
		name: product.name,
		price: product.prices.price.value,
		// Search deliberately does not project sale/subscription claims.
		image: product.defaultImage?.url ?? '',
		imageAlt: product.defaultImage?.altText || product.name,
		description: product.description.replace(/<[^>]*>/g, '').trim(),
		specs,
		tags: Object.values(specs).slice(0, 3),
		category: product.categories.edges[0]?.node.name ?? '',
	};
}
