/*
 * Process-only BigCommerce GraphQL fixture interceptor.
 *
 * Loaded with NODE_OPTIONS=--require by scripts/kibble-parity-local.ts. It is
 * intentionally outside either storefront's source tree and never runs in a
 * production build. Both Vite processes retain their own rendered routes.
 */
const { readFileSync } = require('node:fs');

const fixturePath = process.env.KIBBLE_PARITY_FIXTURE_PATH;
if (!fixturePath) throw new Error('KIBBLE_PARITY_FIXTURE_PATH is required by the local parity fixture interceptor.');

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

// Aisles Preserve records a render provenance row. The local runner must render
// that real route without opening Hyperdrive or a local/remote database, so the
// process replaces the database client before Vite loads application modules.
// This file is loaded only through NODE_OPTIONS by the local runner.
if (process.env.KIBBLE_PARITY_DISABLE_DATABASE === '1') {
	const postgresModule = require.resolve('postgres');
	const noopSql = () => Promise.resolve([]);
	noopSql.end = () => Promise.resolve();
	require.cache[postgresModule] = { id: postgresModule, filename: postgresModule, loaded: true, exports: () => noopSql };
}
const categories = Object.entries(fixture.categories).map(([name, entityId]) => ({
	entityId,
	name,
	path: `/${name.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-')}/`,
	children: [],
}));

function imageFor(product) {
	const hue = (product.bc_product_id * 37) % 360;
	return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="hsl(${hue} 38% 87%)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="hsl(${hue} 30% 25%)" font-family="Arial" font-size="32">${product.name.replace(/[<&>]/g, '')}</text></svg>`)}`;
}

function productNode(product) {
	const category = categories.find((candidate) => candidate.entityId === product.bc_category_id);
	return {
		entityId: product.bc_product_id,
		name: product.name,
		sku: product.sku,
		path: `/${product.slug}/`,
		description: `${product.name} from ${product.brand}.`,
		plainTextDescription: `${product.name} from ${product.brand}.`,
		brand: { name: product.brand },
		prices: {
			price: { value: product.one_time_price, currencyCode: 'USD' },
			// The source seed records Auto-Refill pricing, not a BigCommerce sale.
			// Mapping it to salePrice would fabricate a catalog promotion in Aisles.
			salePrice: null,
		},
		defaultImage: { url: imageFor(product), altText: product.name },
		customFields: { edges: [] },
		categories: { edges: category ? [{ node: category }] : [] },
	};
}

const products = fixture.products.map(productNode);

function responseFor(query, variables) {
	if (/CategoryTree|GetCategories/.test(query)) return { site: { categoryTree: categories } };
	if (/FeaturedProducts|GetFeaturedProducts/.test(query)) {
		const limit = Math.max(1, Number(variables.first) || 8);
		return { site: { featuredProducts: { edges: products.slice(0, limit).map((node) => ({ node })) } } };
	}
	if (/NewestProducts|GetNewestProducts/.test(query)) {
		const limit = Math.max(1, Number(variables.first) || 8);
		return { site: { newestProducts: { edges: products.slice(0, limit).map((node) => ({ node })) } } };
	}
	if (/query GetProduct\b|query GetProduct\(/.test(query)) {
		return { site: { product: products.find((product) => product.entityId === Number(variables.entityId)) ?? null } };
	}
	if (/GetProducts\b/.test(query)) {
		const limit = Math.max(1, Number(variables.first) || 30);
		return { site: { products: { edges: products.slice(0, limit).map((node) => ({ node })), pageInfo: { hasNextPage: false, endCursor: null } } } };
	}
	if (/GetCategoryProducts/.test(query)) {
		const category = categories.find((candidate) => candidate.entityId === Number(variables.categoryId));
		if (!category) return { site: { category: null } };
		const limit = Math.max(1, Number(variables.first) || 24);
		const members = products.filter((product) => product.categories.edges.some(({ node }) => node.entityId === category.entityId));
		return {
			site: {
				category: {
					entityId: category.entityId,
					name: category.name,
					description: '',
					products: { edges: members.slice(0, limit).map((node) => ({ node })), pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } },
				},
			},
		};
	}
	throw new Error(`Local Kibble parity fixture does not implement this GraphQL operation: ${query.match(/query\s+\w+/)?.[0] ?? 'unknown'}`);
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
	if (!/^https:\/\/store-[^.]+\.mybigcommerce\.com\/graphql$/.test(url)) return originalFetch(input, init);
	const request = init ?? (typeof input === 'object' ? input : undefined);
	const body = typeof request?.body === 'string' ? JSON.parse(request.body) : null;
	if (!body?.query) throw new Error('Local Kibble parity fixture received a GraphQL request without a query.');
	return new Response(JSON.stringify({ data: responseFor(body.query, body.variables ?? {}) }), {
		status: 200,
		headers: { 'content-type': 'application/json' },
	});
};
