/**
 * BigCommerce Storefront GraphQL Client
 *
 * Follows the Catalyst pattern: plain fetch, typed queries, Bearer token auth.
 * Server-side only — never import this from client components.
 */

import { env } from '$env/dynamic/private';
import { getBrand } from '$lib/brand/config';
import type { BigCommerceCategoryProductSort } from '$lib/brand/reference/kibble-plp';

function getGraphQLConfig(requirePrivateToken = false) {
	const brand = getBrand();
	// Brand-specific storefront tokens: VOLT_STOREFRONT_TOKEN, EMBER_STOREFRONT_TOKEN, etc.
	const tokenKey = `${brand.id.toUpperCase()}_STOREFRONT_TOKEN`;
	const storeHash = env.BIGCOMMERCE_STORE_HASH;
	const storefrontToken = env[tokenKey] || env.BIGCOMMERCE_STOREFRONT_TOKEN;
	// Kibble prefers the current server-to-server private token for every
	// provider call once configured. Other brands retain their existing token
	// boundary until their merchant configuration is migrated independently.
	const usePrivateToken = requirePrivateToken || (brand.id === 'kibble' && Boolean(env.BIGCOMMERCE_PRIVATE_TOKEN));
	const token = usePrivateToken ? env.BIGCOMMERCE_PRIVATE_TOKEN : storefrontToken;

	if (!storeHash) throw new Error('BIGCOMMERCE_STORE_HASH not configured');
	if (!token) {
		throw new Error(
			usePrivateToken
				? 'BigCommerce private token not configured'
				: `Storefront token not configured (tried ${tokenKey} and BIGCOMMERCE_STOREFRONT_TOKEN)`,
		);
	}

	// Non-default channels need channel ID in the URL hostname
	const channelId = brand.bc.channelId;
	const host = channelId === 1
		? `store-${storeHash}.mybigcommerce.com`
		: `store-${storeHash}-${channelId}.mybigcommerce.com`;

	return {
		url: `https://${host}/graphql`,
		token,
	};
}

interface GraphQLResponse<T> {
	data?: T;
	errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

export class BigCommerceGraphQLError extends Error {
	readonly status: number | null;
	readonly providerCode: string | null;
	readonly outcomeUnknown: boolean;

	constructor(
		message: string,
		options: {
			status?: number;
			providerCode?: string;
			outcomeUnknown?: boolean;
		} = {},
	) {
		super(message);
		this.name = 'BigCommerceGraphQLError';
		this.status = options.status ?? null;
		this.providerCode = options.providerCode ?? null;
		this.outcomeUnknown = options.outcomeUnknown ?? false;
	}
}

export class BigCommerceCustomerSessionError extends Error {}

interface GraphQLAuthContext {
	requirePrivateToken?: boolean;
	customerAccessToken?: string;
}

async function query<T>(gql: string, variables?: Record<string, unknown>, auth: GraphQLAuthContext = {}): Promise<T> {
	const { url, token } = getGraphQLConfig(auth.requirePrivateToken);
	const isMutation = /\bmutation\b/.test(gql);
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${token}`,
	};
	if (auth.customerAccessToken) {
		headers['X-Bc-Customer-Access-Token'] = auth.customerAccessToken;
	}
	let res: Response;
	try {
		res = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({ query: gql, variables }),
			signal: AbortSignal.timeout(20_000),
		});
	} catch {
		throw new BigCommerceGraphQLError('BigCommerce could not be reached.', {
			outcomeUnknown: isMutation,
		});
	}

	if (!res.ok) {
		throw new BigCommerceGraphQLError('BigCommerce rejected the request.', {
			status: res.status,
			outcomeUnknown: isMutation && res.status >= 500,
		});
	}

	let json: GraphQLResponse<T>;
	try {
		json = (await res.json()) as GraphQLResponse<T>;
	} catch {
		// A successful HTTP response with an unreadable body is ambiguous for a
		// mutation. Keep the idempotency key terminal so the browser cannot
		// blindly repeat an operation BigCommerce may already have applied.
		throw new BigCommerceGraphQLError('BigCommerce returned an unreadable response.', { outcomeUnknown: isMutation });
	}

	if (json.errors?.length) {
		const providerCode = json.errors[0].extensions?.code;
		const hint = `${providerCode ?? ''} ${json.errors[0].message}`.toLowerCase();
		const conflict = hint.includes('conflict') || hint.includes('version');
		console.error('BigCommerce GraphQL request returned an application error.', {
			count: json.errors.length,
			code: providerCode ?? 'unspecified',
		});
		throw new BigCommerceGraphQLError(json.errors[0].message, {
			providerCode,
			// An application error after a mutation request is not safe to repeat
			// unless BigCommerce explicitly identifies optimistic concurrency.
			outcomeUnknown: isMutation && !conflict,
		});
	}

	if (!json.data) {
		throw new BigCommerceGraphQLError('BigCommerce returned no data.', {
			outcomeUnknown: isMutation,
		});
	}
	return json.data;
}

// ─── Queries ────────────────────────────────────────────────────────

export interface BCProduct {
	entityId: number;
	name: string;
	sku: string;
	path: string;
	description: string;
	prices: {
		price: { value: number; currencyCode: string };
		salePrice: { value: number; currencyCode: string } | null;
	};
	defaultImage: {
		url: string;
		altText: string;
	} | null;
	customFields: {
		edges: Array<{
			node: { name: string; value: string };
		}>;
	};
	categories: {
		edges: Array<{
			node: { entityId: number; name: string; path: string };
		}>;
	};
}

export interface BCProductOption {
	entityId: number;
	displayName: string;
	isRequired: boolean;
	displayStyle: string | null;
	values: { edges: Array<{ node: { entityId: number; label: string; isDefault: boolean } }> } | null;
}

export interface BCKibbleProductDetail extends BCProduct {
	images: { edges: Array<{ node: { url: string; altText: string } }> };
	inventory: { isInStock: boolean } | null;
	productOptions: { edges: Array<{ node: BCProductOption }> };
	relatedProducts: { edges: Array<{ node: BCProduct }> };
}

interface ProductsResponse {
	site: {
		products: {
			edges: Array<{ node: BCProduct }>;
			pageInfo: { hasNextPage: boolean; endCursor: string };
		};
	};
}

interface MerchandisingProductsResponse {
	site: {
		featuredProducts?: { edges: Array<{ node: BCProduct }> };
		newestProducts?: { edges: Array<{ node: BCProduct }> };
	};
}

interface CategoryProductsResponse {
	site: {
		category: {
			entityId: number;
			name: string;
			description: string;
			products: {
				edges: Array<{ node: BCProduct }>;
				pageInfo: BCPageInfo;
			};
		} | null;
	};
}

export interface BCPageInfo {
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	startCursor: string | null;
	endCursor: string | null;
}

interface CategoriesResponse {
	site: {
		categoryTree: Array<{
			entityId: number;
			name: string;
			path: string;
			children: Array<{
				entityId: number;
				name: string;
				path: string;
			}>;
		}>;
	};
}

const PRODUCT_FRAGMENT = `
	entityId
	name
	sku
	path
	description
	prices {
		price { value currencyCode }
		salePrice { value currencyCode }
	}
	defaultImage {
		url(width: 800, height: 800)
		altText
	}
	customFields(first: 10) {
		edges {
			node { name value }
		}
	}
	categories(first: 5) {
		edges {
			node { entityId name path }
		}
	}
`;

export async function getProducts(limit = 30): Promise<BCProduct[]> {
	const data = await query<ProductsResponse>(`
		query GetProducts($first: Int!) {
			site {
				products(first: $first) {
					edges {
						node {
							${PRODUCT_FRAGMENT}
						}
					}
				}
			}
		}
	`, { first: limit });

	return data.site.products.edges.map((e) => e.node);
}

/**
 * BigCommerce-owned featured order. Mirrors the pinned Kibble storefront query.
 * Verified 2026-08-12 against
 * https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/overview.md
 * (`site.featuredProducts`) and the internal pinned bc-subscriptions reference.
 */
export async function getFeaturedProducts(limit = 8): Promise<BCProduct[]> {
	const first = Math.min(Math.max(1, limit), 50);
	const data = await query<MerchandisingProductsResponse>(`
		query GetFeaturedProducts($first: Int!) {
			site {
				featuredProducts(first: $first) {
					edges { node { ${PRODUCT_FRAGMENT} } }
				}
			}
		}
	`, { first });

	return data.site.featuredProducts?.edges.map((edge) => edge.node) ?? [];
}

/**
 * BigCommerce-owned newest order. Used only when no products are featured.
 * Verified 2026-08-12 against
 * https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/overview.md
 * (`site.newestProducts`); collection size stays within the documented 50-item limit.
 */
export async function getNewestProducts(limit = 8): Promise<BCProduct[]> {
	const first = Math.min(Math.max(1, limit), 50);
	const data = await query<MerchandisingProductsResponse>(`
		query GetNewestProducts($first: Int!) {
			site {
				newestProducts(first: $first) {
					edges { node { ${PRODUCT_FRAGMENT} } }
				}
			}
		}
	`, { first });

	return data.site.newestProducts?.edges.map((edge) => edge.node) ?? [];
}

/**
 * Category PLP connection. Callers own the requested page size and validated
 * cursor; BigCommerce owns the selected category ordering.
 *
 * Verified 2026-08-12 against:
 * https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/overview.md
 * https://docs.bigcommerce.com/developer/docs/storefront/headless/products/faceted-textual-search.md
 * https://github.com/bigcommerce/storefront-data-hooks/blob/6cb5d8f163a864a6c466b681972b3ad00b58bb7c/src/schema.d.ts#L424-L435
 */
export async function getProductsByCategory(
	categoryEntityId: number,
	options: {
		first?: number;
		after?: string | null;
		sortBy?: BigCommerceCategoryProductSort;
	} = {},
): Promise<{
	category: { name: string; description: string };
	products: BCProduct[];
	pageInfo: BCPageInfo;
}> {
	const data = await query<CategoryProductsResponse>(`
		query GetCategoryProducts(
			$categoryId: Int!
			$first: Int!
			$after: String
			$sortBy: CategoryProductSort
		) {
			site {
				category(entityId: $categoryId) {
					entityId
					name
					description
					products(first: $first, after: $after, sortBy: $sortBy) {
						edges {
							node {
								${PRODUCT_FRAGMENT}
							}
						}
						pageInfo {
							hasNextPage
							hasPreviousPage
							startCursor
							endCursor
						}
					}
				}
			}
		}
	`, {
		categoryId: categoryEntityId,
		first: options.first ?? 24,
		after: options.after ?? null,
		sortBy: options.sortBy ?? null,
	});

	if (!data.site.category) {
		throw new Error(`Category ${categoryEntityId} not found`);
	}

	return {
		category: {
			name: data.site.category.name,
			description: data.site.category.description,
		},
		products: data.site.category.products.edges.map((e) => e.node),
		pageInfo: data.site.category.products.pageInfo,
	};
}

export type KibblePdpRelatedCandidateSource = 'native_related' | 'category_sibling';

export type KibblePdpRelatedResolution = {
	products: BCProduct[];
	candidateSource: KibblePdpRelatedCandidateSource;
	relationKind: 'related' | null;
};

/**
 * Resolve the bounded PDP related-products set from server-owned catalog data.
 * BigCommerce's explicit relatedProducts field is preferred; when it is sparse,
 * category siblings fill the same 3–4 slot bound. Bundle contents are a separate
 * Preserve projection and never participate in this recommendation set.
 *
 * The source is part of the result because a category sibling is a safe fallback,
 * not proof that the merchant configured a native related-products relationship.
 */
export async function resolveKibblePdpRelatedProducts(detail: BCKibbleProductDetail): Promise<KibblePdpRelatedResolution> {
	const currentEntityId = detail.entityId;
	const nativeRelated = uniqueCatalogProducts(
		detail.relatedProducts?.edges?.map(({ node }) => node) ?? [],
	).filter(({ entityId }) => entityId !== currentEntityId).slice(0, 4);
	if (nativeRelated.length >= 3) return {
		products: nativeRelated,
		candidateSource: 'native_related',
		relationKind: 'related',
	};

	const categoryEntityId = detail.categories?.edges?.[0]?.node?.entityId;
	if (!Number.isInteger(categoryEntityId) || categoryEntityId <= 0) return nativeResolution(nativeRelated);

	try {
		const { products: categoryProducts } = await getProductsByCategory(categoryEntityId, { first: 8 });
		const products = uniqueCatalogProducts([...nativeRelated, ...categoryProducts])
			.filter(({ entityId }) => entityId !== currentEntityId)
			.slice(0, 4);
		const usedCategorySibling = products.some(({ entityId }) => !nativeRelated.some((native) => native.entityId === entityId));
		return usedCategorySibling ? {
			products,
			candidateSource: 'category_sibling',
			relationKind: null,
		} : nativeResolution(products);
	} catch (error) {
		console.warn('[kibble-preserve] category fallback unavailable for PDP related products', error);
		return nativeResolution(nativeRelated);
	}
}

/** Preserve the array-returning helper for callers that only need candidates. */
export async function getKibblePdpRelatedProducts(detail: BCKibbleProductDetail): Promise<BCProduct[]> {
	return (await resolveKibblePdpRelatedProducts(detail)).products;
}

function nativeResolution(products: BCProduct[]): KibblePdpRelatedResolution {
	return {
		products,
		candidateSource: 'native_related',
		relationKind: products.length > 0 ? 'related' : null,
	};
}

function uniqueCatalogProducts(products: BCProduct[]): BCProduct[] {
	const seen = new Set<number>();
	return products.filter((product) => {
		if (!Number.isInteger(product?.entityId) || seen.has(product.entityId)) return false;
		seen.add(product.entityId);
		return true;
	});
}

interface ProductByPathResponse {
	site: {
		route: {
			node: BCProduct | null;
		};
	};
}

interface KibbleProductDetailResponse {
	site: {
		route: {
			node: (BCKibbleProductDetail & { __typename: 'Product' }) | { __typename: string } | null;
		};
	};
}

export async function getProductByPath(path: string): Promise<BCProduct | null> {
	const fullPath = path.startsWith('/') ? path : `/${path}/`;
	const data = await query<ProductByPathResponse>(`
		query GetProductByPath($path: String!) {
			site {
				route(path: $path) {
					node {
						... on Product {
							${PRODUCT_FRAGMENT}
						}
					}
				}
			}
		}
	`, { path: fullPath });

	return data.site.route.node;
}

/**
 * Fixed catalog presentation payload for Kibble Preserve. This query carries
 * no transaction authority; the separate server-owned cart adapter validates
 * an eligible product again before mutation.
 *
 * Verified 2026-08-12 against the pinned Kibble source at
 * `ef122b8e17b9eb0b327c9d42491c44a61577ead4`,
 * `apps/storefront-svelte/src/routes/products/[slug]/+page.server.ts`, and
 * https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/products-and-catalog/products.md
 */
export async function getKibbleProductDetailByPath(path: string): Promise<BCKibbleProductDetail | null> {
	const fullPath = path.startsWith('/') ? path : `/${path}/`;
	const data = await query<KibbleProductDetailResponse>(`
		query GetKibbleProductDetail($path: String!) {
			site {
				route(path: $path) {
					node {
						__typename
						... on Product {
							${PRODUCT_FRAGMENT}
							images(first: 10) { edges { node { url(width: 1200, height: 1200) altText } } }
							inventory { isInStock }
							productOptions(first: 10) {
								edges { node {
									entityId displayName isRequired
									... on MultipleChoiceOption {
										displayStyle
										values(first: 25) { edges { node { entityId label isDefault } } }
									}
								} }
							}
							relatedProducts(first: 4) { edges { node { ${PRODUCT_FRAGMENT} } } }
						}
					}
				}
			}
		}
	`, { path: fullPath });

	const node = data.site.route.node;
	if (!node || node.__typename !== 'Product' || !('entityId' in node)) return null;
	return node;
}

/**
 * Verified 2026-08-12 against
 * https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/products-and-catalog/products.md
 * (`site.product(entityId: $entityId)`) and the internal pinned bc-subscriptions reference.
 */
export async function getProductByEntityId(entityId: number): Promise<BCProduct | null> {
	interface SingleProductResponse {
		site: { product: BCProduct | null };
	}

	const data = await query<SingleProductResponse>(`
		query GetProduct($entityId: Int!) {
			site {
				product(entityId: $entityId) {
					${PRODUCT_FRAGMENT}
				}
			}
		}
	`, { entityId });

	return data.site.product;
}

export interface CartProductEligibility {
	entityId: number;
	isInStock: boolean;
	hasOptions: boolean;
}

export interface BigCommerceCustomerContext {
	customerAccessToken: string;
}

/** Revalidate the minimum one-time cart boundary from provider-owned catalog data. */
export async function getCartProductEligibility(entityId: number, customer?: BigCommerceCustomerContext): Promise<CartProductEligibility | null> {
	const data = await query<{
		site: {
			product: {
				entityId: number;
				inventory: { isInStock: boolean } | null;
				productOptions: { edges: Array<{ node: { entityId: number } }> };
			} | null;
		};
	}>(
		`
		query GetCartProductEligibility($entityId: Int!) {
			site {
				product(entityId: $entityId) {
					entityId
					inventory { isInStock }
					productOptions(first: 1) { edges { node { entityId } } }
				}
			}
		}
	`,
		{ entityId },
		customerAuth(customer),
	);
	const product = data.site.product;
	if (!product) return null;
	return {
		entityId: product.entityId,
		isInStock: product.inventory?.isInStock === true,
		hasOptions: product.productOptions.edges.length > 0,
	};
}

export async function getCategories() {
	const data = await query<CategoriesResponse>(`
		query GetCategories {
			site {
				categoryTree {
					entityId
					name
					path
					children {
						entityId
						name
						path
					}
				}
			}
		}
	`);

	return data.site.categoryTree;
}

// ─── Cart Operations ────────────────────────────────────────────────

export interface CartResponse {
	entityId: string;
	version: number;
	currencyCode: string;
	amount: { value: number; currencyCode: string };
	baseAmount: { value: number; currencyCode: string };
	lineItems: {
		physicalItems: Array<{
			entityId: string;
			productEntityId: number;
			variantEntityId: number | null;
			name: string;
			quantity: number;
			salePrice: { value: number; currencyCode: string } | null;
			listPrice: { value: number; currencyCode: string };
			extendedSalePrice: { value: number; currencyCode: string } | null;
			extendedListPrice: { value: number; currencyCode: string };
			imageUrl: string | null;
			path: string;
			isMutable: boolean;
		}>;
	};
}

const CART_FRAGMENT = /* GraphQL */ `
	entityId
	version
	currencyCode
	amount { value currencyCode }
	baseAmount { value currencyCode }
	lineItems {
		physicalItems {
			entityId
			productEntityId
			variantEntityId
			name
			quantity
			salePrice { value currencyCode }
			listPrice { value currencyCode }
			extendedSalePrice { value currencyCode }
			extendedListPrice { value currencyCode }
			imageUrl
			path
			isMutable
		}
	}
`;

/**
 * Headless cart operations use the current Storefront GraphQL cart API.
 * BigCommerce owns the cart, prices, and version used for optimistic concurrency.
 * Verified 2026-08-14 against:
 * https://docs.bigcommerce.com/developer/docs/admin/checkout-and-cart/custom-checkouts/graphql-storefront
 * and the current official Catalyst-generated GraphQL schema for Cart.version.
 */

export async function createCart(productEntityId: number, quantity = 1, customer?: BigCommerceCustomerContext): Promise<CartResponse> {
	interface CreateCartResponse {
		cart?: { createCart?: { cart?: CartResponse | null } | null } | null;
	}

	const data = await query<CreateCartResponse>(
		`
		mutation CreateCart($productId: Int!, $quantity: Int!) {
			cart {
				createCart(input: {
					lineItems: [{ productEntityId: $productId, quantity: $quantity }]
				}) {
					cart {
						${CART_FRAGMENT}
					}
				}
			}
		}
	`,
		{ productId: productEntityId, quantity },
		customerAuth(customer),
	);

	return requireMutationCart(data.cart?.createCart?.cart, 'BigCommerce did not confirm cart creation.');
}

export async function addToCart(cartEntityId: string, productEntityId: number, quantity = 1, version?: number, customer?: BigCommerceCustomerContext): Promise<CartResponse> {
	interface AddToCartResponse {
		cart?: { addCartLineItems?: { cart?: CartResponse | null } | null } | null;
	}

	const data = await query<AddToCartResponse>(
		`
		mutation AddToCart($cartId: String!, $productId: Int!, $quantity: Int!, $version: Int) {
			cart {
				addCartLineItems(input: {
					cartEntityId: $cartId,
					version: $version,
					data: { lineItems: [{ productEntityId: $productId, quantity: $quantity }] }
				}) {
					cart {
						${CART_FRAGMENT}
					}
				}
			}
		}
	`,
		{ cartId: cartEntityId, productId: productEntityId, quantity, version },
		customerAuth(customer),
	);

	return requireMutationCart(data.cart?.addCartLineItems?.cart, 'BigCommerce did not confirm the added item.');
}

export async function getCart(cartEntityId: string, customer?: BigCommerceCustomerContext): Promise<CartResponse | null> {
	interface GetCartResponse {
		site: { cart: CartResponse | null };
	}

	const data = await query<GetCartResponse>(
		`
		query GetCart($cartId: String!) {
			site {
				cart(entityId: $cartId) {
					${CART_FRAGMENT}
				}
			}
		}
	`,
		{ cartId: cartEntityId },
		customerAuth(customer),
	);

	return data.site.cart;
}

export async function updateCartLineItem(cartEntityId: string, lineItemEntityId: string, productEntityId: number, quantity: number, version: number, customer?: BigCommerceCustomerContext): Promise<CartResponse> {
	const data = await query<{
		cart?: { updateCartLineItem?: { cart?: CartResponse | null } | null } | null;
	}>(
		`
		mutation UpdateCartLineItem($cartId: String!, $lineId: String!, $productId: Int!, $quantity: Int!, $version: Int!) {
			cart {
				updateCartLineItem(input: {
					cartEntityId: $cartId,
					lineItemEntityId: $lineId,
					version: $version,
					data: { lineItem: { productEntityId: $productId, quantity: $quantity } }
				}) {
					cart { ${CART_FRAGMENT} }
				}
			}
		}
	`,
		{
			cartId: cartEntityId,
			lineId: lineItemEntityId,
			productId: productEntityId,
			quantity,
			version,
		},
		customerAuth(customer),
	);
	return requireMutationCart(data.cart?.updateCartLineItem?.cart, 'BigCommerce did not confirm the quantity update.');
}

export async function deleteCartLineItem(cartEntityId: string, lineItemEntityId: string, version: number, customer?: BigCommerceCustomerContext): Promise<CartResponse | null> {
	const data = await query<{
		cart?: {
			deleteCartLineItem?: {
				cart?: CartResponse | null;
				deletedCartEntityId?: string | null;
			} | null;
		} | null;
	}>(
		`
		mutation DeleteCartLineItem($cartId: String!, $lineId: String!, $version: Int!) {
			cart {
				deleteCartLineItem(input: {
					cartEntityId: $cartId,
					lineItemEntityId: $lineId,
					version: $version
				}) {
					deletedCartEntityId
					cart { ${CART_FRAGMENT} }
				}
			}
		}
	`,
		{ cartId: cartEntityId, lineId: lineItemEntityId, version },
		customerAuth(customer),
	);
	const result = data.cart?.deleteCartLineItem;
	if (result?.cart) return result.cart;
	if (result?.deletedCartEntityId === cartEntityId) return null;
	throw new BigCommerceGraphQLError('BigCommerce did not confirm line removal.', { outcomeUnknown: true });
}

export async function deleteCart(cartEntityId: string, customer?: BigCommerceCustomerContext): Promise<void> {
	const data = await query<{
		cart: { deleteCart: { deletedCartEntityId: string | null } | null };
	}>(
		`
		mutation DeleteCart($cartId: String!) {
			cart {
				deleteCart(input: { cartEntityId: $cartId }) { deletedCartEntityId }
			}
		}
	`,
		{ cartId: cartEntityId },
		customerAuth(customer),
	);
	if (data.cart.deleteCart?.deletedCartEntityId !== cartEntityId) {
		throw new BigCommerceGraphQLError('BigCommerce did not confirm the empty-cart operation.', { outcomeUnknown: true });
	}
}

/**
 * Mint a one-use hosted checkout URL only when the shopper asks to continue.
 * This does not create an order or collect payment in Aisles.
 * Verified 2026-08-14 against:
 * https://docs.bigcommerce.com/developer/learn/courses/graphql-storefront-api/checkout/lab-query-practice
 */
export async function createCartRedirectUrl(cartEntityId: string, customer?: BigCommerceCustomerContext): Promise<string> {
	const data = await query<{
		cart?: {
			createCartRedirectUrls?: {
				redirectUrls: { redirectedCheckoutUrl: string | null } | null;
			} | null;
		} | null;
	}>(
		`
		mutation CreateCartRedirectUrl($cartId: String!) {
			cart {
				createCartRedirectUrls(input: { cartEntityId: $cartId }) {
					redirectUrls { redirectedCheckoutUrl }
				}
			}
		}
	`,
		{ cartId: cartEntityId },
		customerAuth(customer),
	);
	const value = data.cart?.createCartRedirectUrls?.redirectUrls?.redirectedCheckoutUrl;
	if (!value) throw new BigCommerceGraphQLError('BigCommerce did not confirm a checkout handoff URL.', { outcomeUnknown: true });
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new BigCommerceGraphQLError('BigCommerce returned an invalid checkout handoff URL.');
	}
	if (url.protocol !== 'https:') {
		throw new BigCommerceGraphQLError('BigCommerce returned an insecure checkout handoff URL.');
	}
	return url.toString();
}

export interface BigCommerceCustomerLoginResult {
	customerEntityId: number;
	customerAccessToken: string;
	expiresAt: string;
	cartEntityId: string | null;
}

/**
 * Server-to-server login may assign an anonymous cart to the customer and
 * returns the customer access token in the GraphQL body. The private bearer
 * token and customer token never cross the server boundary.
 * Verified 2026-08-15 against:
 * https://docs.bigcommerce.com/developer/api-reference/graphql/storefront/mutations/login
 * https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/authentication
 */
export async function loginBigCommerceCustomer(input: {
	email: string;
	password: string;
	guestCartEntityId: string | null;
}): Promise<BigCommerceCustomerLoginResult> {
	const data = await query<{
		login: {
			customer: { entityId: number } | null;
			cart: { entityId: string } | null;
			customerAccessToken: { value: string; expiresAt: string } | null;
		} | null;
	}>(
		`
		mutation LoginCustomer($email: String!, $password: String!, $guestCartEntityId: String) {
			login(email: $email, password: $password, guestCartEntityId: $guestCartEntityId) {
				customer { entityId }
				cart { entityId }
				customerAccessToken { value expiresAt }
			}
		}
	`,
		input,
		{ requirePrivateToken: true },
	);
	const login = data.login;
	const expiresAt = login?.customerAccessToken?.expiresAt ?? '';
	if (!login?.customer || !login.customerAccessToken?.value || !Number.isFinite(Date.parse(expiresAt))) {
		throw new BigCommerceGraphQLError('BigCommerce did not confirm a customer session.');
	}
	return {
		customerEntityId: login.customer.entityId,
		customerAccessToken: login.customerAccessToken.value,
		expiresAt,
		cartEntityId: login.cart?.entityId ?? null,
	};
}

export interface BigCommerceCustomerOrderSummary {
	entityId: number;
	orderedAt: string;
	status: string;
	total: { value: number; currencyCode: string };
	itemCount: number;
}

/** Customer order reads require a customer access token and create no order. */
export async function getBigCommerceCustomerOrders(
	customer: BigCommerceCustomerContext,
	limit = 25,
): Promise<BigCommerceCustomerOrderSummary[]> {
	const first = Math.min(Math.max(Math.trunc(limit), 1), 50);
	const data = await query<{
		customer: {
			orders: {
				edges: Array<{ node: {
					entityId: number;
					orderedAt: { utc: string };
					status: { label: string };
					totalIncTax: { value: number; currencyCode: string };
					totalProductQuantity: number;
				} }>;
			};
		} | null;
	}>(
		`
		query CustomerOrders($first: Int!) {
			customer {
				orders(first: $first) {
					edges { node {
						entityId
						orderedAt { utc }
						status { label }
						totalIncTax { value currencyCode }
						totalProductQuantity
					} }
				}
			}
		}
	`,
		{ first },
		customerAuth(customer),
	);
	if (!data.customer) throw new BigCommerceCustomerSessionError('BigCommerce did not confirm an authenticated customer.');
	return data.customer.orders.edges.map(({ node }) => ({
		entityId: node.entityId,
		orderedAt: node.orderedAt.utc,
		status: node.status.label,
		total: node.totalIncTax,
		itemCount: node.totalProductQuantity,
	}));
}

/**
 * Logout invalidates the customer token and may return an unassigned anonymous
 * cart reference. Local state is updated only after this mutation confirms.
 * https://docs.bigcommerce.com/developer/api-reference/graphql/storefront/mutations/logout
 */
export async function logoutBigCommerceCustomer(
	customer: BigCommerceCustomerContext,
	cartEntityId: string | null,
): Promise<string | null> {
	const data = await query<{
		logout: {
			result: string | null;
			cartUnassignResult: { cart: { entityId: string } | null } | null;
		} | null;
	}>(
		`
		mutation LogoutCustomer($cartEntityId: String) {
			logout(cartEntityId: $cartEntityId) {
				result
				cartUnassignResult { cart { entityId } }
			}
		}
	`,
		{ cartEntityId },
		customerAuth(customer),
	);
	if (!data.logout?.result) {
		throw new BigCommerceGraphQLError('BigCommerce did not confirm customer logout.', { outcomeUnknown: true });
	}
	return data.logout.cartUnassignResult?.cart?.entityId ?? null;
}

function customerAuth(customer?: BigCommerceCustomerContext): GraphQLAuthContext {
	return customer
		? { requirePrivateToken: true, customerAccessToken: customer.customerAccessToken }
		: {};
}

function requireMutationCart(cart: CartResponse | null | undefined, message: string): CartResponse {
	if (!cart) throw new BigCommerceGraphQLError(message, { outcomeUnknown: true });
	return cart;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Extract custom fields into a key-value record */
export function customFieldsToRecord(product: BCProduct): Record<string, string> {
	const fields: Record<string, string> = {};
	for (const edge of product.customFields.edges) {
		fields[edge.node.name] = edge.node.value;
	}
	return fields;
}

/** Get the category slug from a BC category path (e.g., "/haven-living-room/" → "haven-living-room") */
export function categorySlug(path: string): string {
	return path.replace(/^\/|\/$/g, '');
}
