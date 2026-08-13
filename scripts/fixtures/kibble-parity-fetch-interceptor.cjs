/*
 * Process-only BigCommerce GraphQL fixture interceptor.
 *
 * Loaded with NODE_OPTIONS=--require by scripts/kibble-parity-local.ts. It is
 * intentionally outside either storefront's source tree and never runs in a
 * production build. Both Vite processes retain their own rendered routes.
 */
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');

const fixturePath = process.env.KIBBLE_PARITY_FIXTURE_PATH;
if (!fixturePath) throw new Error('KIBBLE_PARITY_FIXTURE_PATH is required by the local parity fixture interceptor.');

const fixtureBytes = readFileSync(fixturePath);
const fixtureIdentity = createHash('sha256').update(fixtureBytes).digest('hex');
const expectedFixtureIdentity = process.env.KIBBLE_PARITY_FIXED_DATA_IDENTITY;
if (expectedFixtureIdentity && fixtureIdentity !== expectedFixtureIdentity) {
	throw new Error(`Local Kibble parity fixture identity mismatch: expected ${expectedFixtureIdentity}, received ${fixtureIdentity}.`);
}
const fixture = JSON.parse(fixtureBytes.toString('utf8'));

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
		__typename: 'Product',
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
		images: { edges: [{ node: { url: imageFor(product), altText: product.name } }] },
		inventory: { isInStock: true },
		productOptions: { edges: [] },
		relatedProducts: { edges: [] },
		customFields: { edges: [] },
		categories: { edges: category ? [{ node: category }] : [] },
	};
}

const products = fixture.products.map(productNode);

function pageInfo() {
	return { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null };
}

function productForPath(path) {
	const normalized = String(path || '').replace(/^\/+|\/+$/g, '');
	return products.find((product) => product.path.replace(/^\/+|\/+$/g, '') === normalized) ?? null;
}

function operationName(query) {
	return query.match(/\bquery\s+([A-Za-z0-9_]+)/)?.[1] ?? 'unknown';
}

function responseFor(query, variables) {
	const operation = operationName(query);
	if (operation === 'CategoryTree' || operation === 'GetCategories') return { site: { categoryTree: categories } };
	if (operation === 'FeaturedProducts' || operation === 'GetFeaturedProducts') {
		const limit = Math.max(1, Number(variables.first) || 8);
		return { site: { featuredProducts: { edges: products.slice(0, limit).map((node) => ({ node })) } } };
	}
	if (operation === 'NewestProducts' || operation === 'GetNewestProducts') {
		const limit = Math.max(1, Number(variables.first) || 8);
		return { site: { newestProducts: { edges: products.slice(0, limit).map((node) => ({ node })) } } };
	}
	if (operation === 'CategoryBySlug') {
		const category = categories.find((candidate) => candidate.path === variables.path);
		const limit = Math.max(1, Number(variables.first) || 24);
		const members = category ? products.filter((product) => product.categories.edges.some(({ node }) => node.entityId === category.entityId)) : [];
		return {
			site: {
				route: {
					node: category ? {
						__typename: 'Category', entityId: category.entityId, name: category.name, path: category.path,
						description: '', products: { edges: members.slice(0, limit).map((node) => ({ node })), pageInfo: pageInfo() },
					} : null,
				},
			},
		};
	}
	if (operation === 'SearchProducts') {
		const term = String(variables.searchTerm || '').trim().toLowerCase();
		const limit = Math.max(1, Number(variables.first) || 24);
		const members = term ? products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(term)) : [];
		return { site: { search: { searchProducts: { products: { edges: members.slice(0, limit).map((node) => ({ node })), pageInfo: pageInfo() } } } } };
	}
	if (operation === 'ProductDetail' || operation === 'GetKibbleProductDetail' || operation === 'GetProductByPath') {
		return { site: { route: { node: productForPath(variables.path) } } };
	}
	if (operation === 'GetProduct') {
		return { site: { product: products.find((product) => product.entityId === Number(variables.entityId)) ?? null } };
	}
	if (operation === 'GetProducts') {
		const limit = Math.max(1, Number(variables.first) || 30);
		return { site: { products: { edges: products.slice(0, limit).map((node) => ({ node })), pageInfo: pageInfo() } } };
	}
	if (operation === 'GetCategoryProducts') {
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
					products: { edges: members.slice(0, limit).map((node) => ({ node })), pageInfo: pageInfo() },
				},
			},
		};
	}
	throw new Error(`Local Kibble parity fixture does not implement GraphQL operation ${operation}.`);
}

module.exports = { fixtureIdentity, operationName, responseFor };

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
