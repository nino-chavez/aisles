/**
 * BigCommerce Storefront GraphQL Client
 *
 * Follows the Catalyst pattern: plain fetch, typed queries, Bearer token auth.
 * Server-side only — never import this from client components.
 */

import { env } from '$env/dynamic/private';
import { getBrand } from '$lib/brand/config';
import type { BigCommerceCategoryProductSort } from '$lib/brand/reference/kibble-plp';

function getGraphQLConfig() {
	const brand = getBrand();
	// Brand-specific storefront tokens: VOLT_STOREFRONT_TOKEN, EMBER_STOREFRONT_TOKEN, etc.
	const tokenKey = `${brand.id.toUpperCase()}_STOREFRONT_TOKEN`;
	const storeHash = env.BIGCOMMERCE_STORE_HASH;
	const storefrontToken = env[tokenKey] || env.BIGCOMMERCE_STOREFRONT_TOKEN;

	if (!storeHash) throw new Error('BIGCOMMERCE_STORE_HASH not configured');
	if (!storefrontToken) throw new Error(`Storefront token not configured (tried ${tokenKey} and BIGCOMMERCE_STOREFRONT_TOKEN)`);

	// Non-default channels need channel ID in the URL hostname
	const channelId = brand.bc.channelId;
	const host = channelId === 1
		? `store-${storeHash}.mybigcommerce.com`
		: `store-${storeHash}-${channelId}.mybigcommerce.com`;

	return {
		url: `https://${host}/graphql`,
		token: storefrontToken,
	};
}

interface GraphQLResponse<T> {
	data: T;
	errors?: Array<{ message: string }>;
}

async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
	const { url, token } = getGraphQLConfig();
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ query: gql, variables }),
	});

	if (!res.ok) {
		throw new Error(`BigCommerce GraphQL error: ${res.status} ${res.statusText}`);
	}

	const json: GraphQLResponse<T> = await res.json();

	if (json.errors?.length) {
		console.error('GraphQL errors:', json.errors);
		throw new Error(json.errors[0].message);
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
 * Fixed catalog-only PDP payload for Kibble Preserve. This is intentionally a
 * query: the Preserve route never creates carts, subscriptions, or purchases.
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

interface CartResponse {
	entityId: string;
	lineItems: {
		physicalItems: Array<{
			entityId: string;
			productEntityId: number;
			name: string;
			quantity: number;
			salePrice: { value: number; currencyCode: string };
			listPrice: { value: number; currencyCode: string };
			imageUrl: string;
		}>;
	};
}

export async function createCart(productEntityId: number, quantity = 1): Promise<CartResponse> {
	interface CreateCartResponse { cart: CartResponse; }

	const data = await query<CreateCartResponse>(`
		mutation CreateCart($productId: Int!, $quantity: Int!) {
			cart {
				createCart(input: {
					lineItems: [{ productEntityId: $productId, quantity: $quantity }]
				}) {
					cart {
						entityId
						lineItems {
							physicalItems {
								entityId
								productEntityId
								name
								quantity
								salePrice { value currencyCode }
								listPrice { value currencyCode }
								imageUrl
							}
						}
					}
				}
			}
		}
	`, { productId: productEntityId, quantity });

	// The nested structure from BC's mutation response
	return (data as any).cart.createCart.cart;
}

export async function addToCart(cartEntityId: string, productEntityId: number, quantity = 1): Promise<CartResponse> {
	interface AddToCartResponse { cart: CartResponse; }

	const data = await query<AddToCartResponse>(`
		mutation AddToCart($cartId: String!, $productId: Int!, $quantity: Int!) {
			cart {
				addCartLineItems(input: {
					cartEntityId: $cartId,
					data: { lineItems: [{ productEntityId: $productId, quantity: $quantity }] }
				}) {
					cart {
						entityId
						lineItems {
							physicalItems {
								entityId
								productEntityId
								name
								quantity
								salePrice { value currencyCode }
								listPrice { value currencyCode }
								imageUrl
							}
						}
					}
				}
			}
		}
	`, { cartId: cartEntityId, productId: productEntityId, quantity });

	return (data as any).cart.addCartLineItems.cart;
}

export async function getCart(cartEntityId: string): Promise<CartResponse | null> {
	interface GetCartResponse { site: { cart: CartResponse | null } }

	const data = await query<GetCartResponse>(`
		query GetCart($cartId: String!) {
			site {
				cart(entityId: $cartId) {
					entityId
					lineItems {
						physicalItems {
							entityId
							productEntityId
							name
							quantity
							salePrice { value currencyCode }
							listPrice { value currencyCode }
							imageUrl
						}
					}
				}
			}
		}
	`, { cartId: cartEntityId });

	return data.site.cart;
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
