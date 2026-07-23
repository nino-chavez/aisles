/**
 * BigCommerce multi-channel seeder.
 *
 * Creates channels, category trees, products, and storefront tokens
 * for Volt (audio) and Ember (outdoor) brands.
 *
 * Run: npx tsx tools/seed-channels/index.ts
 *
 * Requires: BIGCOMMERCE_STORE_HASH, BIGCOMMERCE_ACCESS_TOKEN in .env
 */

import 'dotenv/config';
import { voltProducts, voltCategories } from './volt-catalog';
import { emberProducts, emberCategories } from './ember-catalog';

const STORE_HASH = process.env.BIGCOMMERCE_STORE_HASH;
const ACCESS_TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;

if (!STORE_HASH || !ACCESS_TOKEN) {
	throw new Error('BIGCOMMERCE_STORE_HASH and BIGCOMMERCE_ACCESS_TOKEN required in .env');
}

const API_BASE = `https://api.bigcommerce.com/stores/${STORE_HASH}`;

const headers = {
	'X-Auth-Token': ACCESS_TOKEN,
	'Content-Type': 'application/json',
	'Accept': 'application/json',
};

// ─── API Helpers ──────────────────────────────────────────────────

async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
	const url = `${API_BASE}${path}`;
	const res = await fetch(url, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`${method} ${path} → ${res.status}: ${text}`);
	}

	const text = await res.text();
	if (!text) return {} as T;
	const json = JSON.parse(text);
	return json.data ?? json;
}

async function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

// ─── Channel Creation ─────────────────────────────────────────────

async function createChannel(name: string): Promise<number> {
	console.log(`Creating channel: ${name}...`);
	try {
		const channel = await api('POST', '/v3/channels', {
			name,
			type: 'storefront',
			platform: 'custom',
			is_enabled: true,
			is_listable_from_ui: true,
			is_visible: true,
		});
		console.log(`  Channel created: ID ${channel.id}`);
		return channel.id;
	} catch (err) {
		// Channel might already exist — try to find it
		const channels = await api('GET', '/v3/channels');
		const existing = (channels as any[]).find((c: any) => c.name === name);
		if (existing) {
			console.log(`  Channel already exists: ID ${existing.id}`);
			return existing.id;
		}
		throw err;
	}
}

// ─── Category Tree ────────────────────────────────────────────────

interface CategoryDef {
	name: string;
	children?: CategoryDef[];
}

async function createCategories(categories: CategoryDef[]): Promise<Map<string, number>> {
	console.log(`Creating categories...`);

	const categoryMap = new Map<string, number>();

	for (const cat of categories) {
		try {
			// Check if category already exists
			const existing = await api('GET', `/v3/catalog/categories?name=${encodeURIComponent(cat.name)}`);
			if (Array.isArray(existing) && existing.length > 0) {
				categoryMap.set(cat.name, existing[0].id);
				console.log(`  Category exists: ${cat.name} → ID ${existing[0].id}`);
				continue;
			}

			const result = await api('POST', '/v3/catalog/categories', {
				name: cat.name,
				parent_id: 0,
				is_visible: true,
			});
			categoryMap.set(cat.name, result.id);
			console.log(`  Category created: ${cat.name} → ID ${result.id}`);
		} catch (err) {
			console.warn(`  Failed to create category ${cat.name}:`, (err as Error).message);
		}
		await sleep(300);
	}

	return categoryMap;
}

// ─── Product Creation ─────────────────────────────────────────────

interface ProductDef {
	name: string;
	type: 'physical';
	price: number;
	sale_price?: number;
	weight: number;
	description: string;
	categories: string[];
	custom_fields: Array<{ name: string; value: string }>;
	image_url?: string;
}

async function createProducts(
	channelId: number,
	products: ProductDef[],
	categoryMap: Map<string, number>,
): Promise<number[]> {
	const productIds: number[] = [];

	for (const product of products) {
		const categoryIds = product.categories
			.map((name) => categoryMap.get(name))
			.filter((id): id is number => !!id);

		try {
			const result = await api('POST', '/v3/catalog/products', {
				name: product.name,
				type: product.type,
				price: product.price,
				sale_price: product.sale_price,
				weight: product.weight,
				description: product.description,
				categories: categoryIds,
				custom_fields: product.custom_fields,
				is_visible: true,
			});

			const productId = result.id;
			productIds.push(productId);
			console.log(`  Product: ${product.name} → ID ${productId}`);

			// Assign to channel
			await api('PUT', '/v3/catalog/products/channel-assignments', [
				{ product_id: productId, channel_id: channelId },
			]);

			// Set product image if provided
			if (product.image_url) {
				try {
					await api('POST', `/v3/catalog/products/${productId}/images`, {
						image_url: product.image_url,
						is_thumbnail: true,
					});
				} catch {
					console.warn(`    Image upload failed for ${product.name}`);
				}
			}

			await sleep(300); // Rate limit
		} catch (err) {
			console.warn(`  Failed: ${product.name} — ${(err as Error).message}`);
		}
	}

	return productIds;
}

// ─── Storefront Token ─────────────────────────────────────────────

async function createStorefrontToken(channelId: number, origins: string[]): Promise<string> {
	console.log(`Creating storefront token for channel ${channelId}...`);

	// Set expiry to 1 year from now
	const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

	const result = await api('POST', '/v3/storefront/api-token', {
		channel_id: channelId,
		expires_at: expiresAt,
		allowed_cors_origins: origins,
	});

	const token = result.token;
	console.log(`  Token created (${token.slice(0, 20)}...)`);
	return token;
}

// ─── Main ─────────────────────────────────────────────────────────

async function seedBrand(
	brandName: string,
	categories: CategoryDef[],
	products: ProductDef[],
) {
	console.log(`\n${'='.repeat(60)}`);
	console.log(`  Seeding: ${brandName}`);
	console.log(`${'='.repeat(60)}\n`);

	const channelId = await createChannel(brandName);
	const categoryMap = await createCategories(categories);
	const productIds = await createProducts(channelId, products, categoryMap);

	const token = await createStorefrontToken(channelId, [
		'http://localhost:5180',
		`https://${brandName.toLowerCase()}-signal-x-studio-labs.vercel.app`,
	]);

	console.log(`\n--- ${brandName} Summary ---`);
	console.log(`Channel ID: ${channelId}`);
	console.log(`Categories: ${categoryMap.size}`);
	console.log(`Products: ${productIds.length}`);
	console.log(`Storefront Token: ${token.slice(0, 30)}...`);
	console.log(`\nAdd to .env:`);
	console.log(`  ${brandName.toUpperCase()}_CHANNEL_ID=${channelId}`);
	console.log(`  ${brandName.toUpperCase()}_STOREFRONT_TOKEN=${token}`);

	return { channelId, categoryMap, productIds, token };
}

async function main() {
	console.log('BigCommerce Multi-Channel Seeder');
	console.log(`Store: ${STORE_HASH}\n`);

	await seedBrand('Volt', voltCategories, voltProducts);
	await seedBrand('Ember', emberCategories, emberProducts);

	console.log('\nDone. Update .env with the tokens above, then run the enrichment pipeline for each brand.');
}

main().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
