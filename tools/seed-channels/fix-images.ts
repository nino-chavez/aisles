/**
 * Fix product images for Volt and Ember channels.
 *
 * For each product, deletes existing images and uploads the corrected
 * Unsplash URL from the catalog files.
 *
 * Run: npx tsx tools/seed-channels/fix-images.ts
 *
 * Requires: BIGCOMMERCE_STORE_HASH, BIGCOMMERCE_ACCESS_TOKEN in .env
 */

import 'dotenv/config';
import { voltProducts } from './volt-catalog';
import { emberProducts } from './ember-catalog';

const STORE_HASH = process.env.BIGCOMMERCE_STORE_HASH;
const ACCESS_TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;

if (!STORE_HASH || !ACCESS_TOKEN) {
	throw new Error('BIGCOMMERCE_STORE_HASH and BIGCOMMERCE_ACCESS_TOKEN required in .env');
}

const API_BASE = `https://api.bigcommerce.com/stores/${STORE_HASH}`;

const headers = {
	'X-Auth-Token': ACCESS_TOKEN,
	'Content-Type': 'application/json',
	Accept: 'application/json',
};

// Product entity IDs from previous seeder output
const VOLT_START_ID = 460;
const EMBER_START_ID = 478;

interface ProductImageEntry {
	productId: number;
	name: string;
	image_url: string;
}

// Build the mapping of product IDs to new image URLs
const entries: ProductImageEntry[] = [
	...voltProducts.map((p, i) => ({
		productId: VOLT_START_ID + i,
		name: p.name,
		image_url: p.image_url,
	})),
	...emberProducts.map((p, i) => ({
		productId: EMBER_START_ID + i,
		name: p.name,
		image_url: p.image_url,
	})),
];

async function apiFetch(path: string, options: RequestInit = {}) {
	const url = `${API_BASE}${path}`;
	const res = await fetch(url, { ...options, headers });
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`${options.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
	}
	// DELETE returns 204 with no body
	if (res.status === 204) return null;
	return res.json();
}

async function fixProductImage(entry: ProductImageEntry) {
	const { productId, name, image_url } = entry;
	const imagesPath = `/v3/catalog/products/${productId}/images`;

	// 1. GET existing images
	let existingImages: { id: number }[] = [];
	try {
		const res = await apiFetch(imagesPath);
		existingImages = res?.data ?? [];
	} catch (err) {
		console.error(`  [WARN] Could not fetch images for ${name} (${productId}):`, err);
	}

	// 2. DELETE each existing image
	for (const img of existingImages) {
		try {
			await apiFetch(`${imagesPath}/${img.id}`, { method: 'DELETE' });
			console.log(`  Deleted image ${img.id} from ${name}`);
		} catch (err) {
			console.error(`  [WARN] Failed to delete image ${img.id} from ${name}:`, err);
		}
	}

	// 3. POST new image with corrected URL
	try {
		const body = JSON.stringify({
			image_url,
			is_thumbnail: true,
			sort_order: 0,
			description: name,
		});
		await apiFetch(imagesPath, { method: 'POST', body });
		console.log(`  ✓ ${name} (${productId}) → ${image_url.split('photo-')[1]?.split('?')[0] ?? image_url}`);
	} catch (err) {
		console.error(`  ✗ Failed to create image for ${name} (${productId}):`, err);
	}
}

async function main() {
	console.log(`\nFixing product images on store ${STORE_HASH}...`);
	console.log(`Total products: ${entries.length}\n`);

	// Process sequentially to avoid rate limits
	for (const entry of entries) {
		await fixProductImage(entry);
		// Small delay to respect BigCommerce rate limits
		await new Promise((r) => setTimeout(r, 250));
	}

	console.log('\nDone.');
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
