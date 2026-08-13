export const KIBBLE_PLP_PAGE_SIZE = 24 as const;

export const KIBBLE_PLP_SORT_OPTIONS = [
	{ value: 'FEATURED', label: 'Featured', graphQL: 'FEATURED' },
	{ value: 'NEWEST', label: 'Newest', graphQL: 'NEWEST' },
	{ value: 'BEST_SELLING', label: 'Best selling', graphQL: 'BEST_SELLING' },
	{ value: 'A_TO_Z', label: 'A to Z', graphQL: 'A_TO_Z' },
	{ value: 'Z_TO_A', label: 'Z to A', graphQL: 'Z_TO_A' },
	{ value: 'LOWEST_PRICE', label: 'Price: low to high', graphQL: 'LOWEST_PRICE' },
	{ value: 'HIGHEST_PRICE', label: 'Price: high to low', graphQL: 'HIGHEST_PRICE' },
] as const;

export type KibblePlpSort = typeof KIBBLE_PLP_SORT_OPTIONS[number]['value'];
export type BigCommerceCategoryProductSort = typeof KIBBLE_PLP_SORT_OPTIONS[number]['graphQL'];

export const KIBBLE_PLP_DEFAULT_SORT: KibblePlpSort = 'FEATURED';

/**
 * Trusted one-to-one mapping from the seven canonical Kibble controls to
 * BigCommerce's CategoryProductSort enum. Unknown controls never reach GraphQL.
 *
 * Verified 2026-08-12 against:
 * https://docs.bigcommerce.com/developer/docs/storefront/headless/products/faceted-textual-search.md
 * https://github.com/bigcommerce/storefront-data-hooks/blob/6cb5d8f163a864a6c466b681972b3ad00b58bb7c/src/schema.d.ts#L424-L435
 */
export const KIBBLE_PLP_GRAPHQL_SORT: Readonly<Record<KibblePlpSort, BigCommerceCategoryProductSort>> =
	Object.fromEntries(KIBBLE_PLP_SORT_OPTIONS.map(({ value, graphQL }) => [value, graphQL])) as Record<
		KibblePlpSort,
		BigCommerceCategoryProductSort
	>;

export class KibblePlpInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'KibblePlpInputError';
	}
}

export function parseKibblePlpSort(value: string | null): KibblePlpSort {
	if (value === null) return KIBBLE_PLP_DEFAULT_SORT;
	if (Object.hasOwn(KIBBLE_PLP_GRAPHQL_SORT, value)) return value as KibblePlpSort;
	throw new KibblePlpInputError(`Unsupported category sort "${value}".`);
}

/**
 * Cursors are opaque, but Storefront GraphQL examples use base64 connection
 * cursors. Keep the accepted alphabet broad enough for base64 and base64url,
 * while rejecting whitespace, delimiters, empty values, and oversized input.
 */
export function parseKibblePlpCursor(value: string | null): string | null {
	if (value === null) return null;
	if (value.length === 0 || value.length > 512 || !/^[A-Za-z0-9+/_=-]+$/.test(value)) {
		throw new KibblePlpInputError('Invalid category cursor.');
	}
	return value;
}

export function buildKibblePlpHref(sort: KibblePlpSort, after: string | null = null): string {
	const params = new URLSearchParams({ sort });
	if (after) params.set('after', after);
	return `?${params.toString()}`;
}
