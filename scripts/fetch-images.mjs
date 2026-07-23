/**
 * Haven Demo Store — Unsplash Image Fetcher + BC Uploader
 *
 * Searches Unsplash for furniture product photos, downloads them,
 * and uploads to BigCommerce product images via API.
 *
 * Usage: node scripts/fetch-images.mjs
 *
 * Requires: BIGCOMMERCE_STORE_HASH, BIGCOMMERCE_ACCESS_TOKEN in .env
 * Unsplash API: uses the public (demo) access — no key needed for basic search
 */

import 'dotenv/config';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const STORE = process.env.BIGCOMMERCE_STORE_HASH;
const TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const BC_BASE = `https://api.bigcommerce.com/stores/${STORE}/v3`;
const IMAGE_DIR = join(process.cwd(), 'scripts', 'images');

const bcHeaders = {
	'X-Auth-Token': TOKEN,
	'Content-Type': 'application/json',
};

// ─── Product → Search Query mapping ────────────────────────────────

const productSearches = [
	// Living Room
	{ id: 375, query: 'leather sectional sofa living room modern', name: 'Carmel Leather Sectional' },
	{ id: 376, query: 'velvet sofa modern living room', name: 'Nora Velvet Sofa' },
	{ id: 377, query: 'walnut coffee table modern minimal', name: 'Milo Walnut Coffee Table' },
	{ id: 378, query: 'linen accent chair modern living room', name: 'Hana Linen Accent Chair' },
	{ id: 379, query: 'modular sofa sectional boucle fabric', name: 'Modular Bouclé Sofa System' },
	{ id: 380, query: 'marble side table brass modern', name: 'Carrara Marble Side Table' },
	{ id: 381, query: 'arc floor lamp modern living room', name: 'Arc Floor Lamp' },
	{ id: 382, query: 'media console tv stand wood modern', name: 'Maren Media Console' },
	{ id: 383, query: 'area rug ivory wool living room', name: 'Wool Blend Area Rug' },
	{ id: 384, query: 'linen throw pillows sofa neutral', name: 'Linen Throw Pillow Set' },
	{ id: 385, query: 'leather ottoman round tufted', name: 'Faye Leather Ottoman' },
	{ id: 386, query: 'ceramic table lamp pair modern', name: 'Ceramic Table Lamp' },
	{ id: 387, query: 'tall bookcase oak wood modern', name: 'Oak Bookcase' },
	{ id: 388, query: 'woven storage basket seagrass', name: 'Woven Storage Basket Set' },
	{ id: 389, query: 'concrete planter indoor modern', name: 'Concrete Planter' },
	// Office / Dorm
	{ id: 390, query: 'student desk compact minimal', name: 'Compact Student Desk' },
	{ id: 391, query: 'ergonomic office chair mesh', name: 'Ergo Mesh Task Chair' },
	{ id: 392, query: 'platform bed frame metal twin', name: 'Platform Bed Frame' },
	{ id: 393, query: 'rolling storage cart drawers fabric', name: '3-Drawer Rolling Cart' },
	{ id: 394, query: 'led desk lamp modern minimal', name: 'LED Desk Lamp' },
	{ id: 395, query: 'standing desk electric bamboo', name: 'Standing Desk' },
	{ id: 396, query: 'industrial bookshelf metal wood', name: 'Industrial Bookshelf' },
	{ id: 397, query: 'bamboo monitor stand desk organizer', name: 'Bamboo Monitor Stand' },
	{ id: 398, query: 'floating shelf wall mounted wood', name: 'Floating Shelf Set' },
	{ id: 399, query: 'cork desk pad mat workspace', name: 'Cork Desk Pad' },
	{ id: 400, query: 'storage ottoman cube fabric', name: 'Fabric Storage Ottoman' },
	{ id: 401, query: 'ring light desk clip on', name: 'Clip-On Ring Light' },
	{ id: 402, query: 'desk organizer stackable white', name: 'Stackable Desk Organizer' },
	{ id: 403, query: 'cable management tray under desk', name: 'Under-Desk Cable Tray' },
	{ id: 404, query: 'dorm room furniture desk bed', name: 'Dorm Essentials Bundle' },
];

// ─── Unsplash search (no API key needed for public endpoint) ───────

async function searchUnsplash(query) {
	const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`;
	const res = await fetch(url, {
		headers: { 'Accept': 'application/json' },
	});

	if (!res.ok) {
		console.error(`  Unsplash search failed for "${query}": ${res.status}`);
		return null;
	}

	const data = await res.json();
	const results = data.results || [];

	if (results.length === 0) {
		console.error(`  No Unsplash results for "${query}"`);
		return null;
	}

	// Take first result, get the regular size (1080px wide)
	const photo = results[0];
	return {
		url: photo.urls?.regular || photo.urls?.small,
		photographer: photo.user?.name || 'Unknown',
		unsplashLink: photo.links?.html,
	};
}

// ─── Download image ────────────────────────────────────────────────

async function downloadImage(imageUrl, filename) {
	const filepath = join(IMAGE_DIR, filename);

	if (existsSync(filepath)) {
		console.log(`  Cached: ${filename}`);
		return filepath;
	}

	const res = await fetch(imageUrl);
	if (!res.ok) {
		console.error(`  Download failed: ${res.status}`);
		return null;
	}

	const buffer = await res.arrayBuffer();
	await writeFile(filepath, Buffer.from(buffer));
	return filepath;
}

// ─── Upload to BigCommerce ─────────────────────────────────────────

async function uploadImageToBC(productId, imageUrl, description) {
	// BC supports image upload via URL
	const payload = {
		image_url: imageUrl,
		is_thumbnail: true,
		description: description,
		sort_order: 0,
	};

	const res = await fetch(`${BC_BASE}/catalog/products/${productId}/images`, {
		method: 'POST',
		headers: bcHeaders,
		body: JSON.stringify(payload),
	});

	if (res.status === 429) {
		const retry = parseInt(res.headers.get('X-Rate-Limit-Time-Reset-Ms') || '1500');
		console.log(`  Rate limited, waiting ${retry}ms...`);
		await new Promise((r) => setTimeout(r, retry + 100));
		return uploadImageToBC(productId, imageUrl, description);
	}

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		console.error(`  BC upload failed for product ${productId}: ${res.status}`, err.title || '');
		return false;
	}

	return true;
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
	console.log('Haven Demo Store — Image Setup');
	console.log('Source: Unsplash (free license)');
	console.log('================================\n');

	if (!existsSync(IMAGE_DIR)) await mkdir(IMAGE_DIR, { recursive: true });

	let success = 0;
	let failed = 0;

	for (const product of productSearches) {
		console.log(`[${product.id}] ${product.name}`);
		console.log(`  Searching: "${product.query}"`);

		const photo = await searchUnsplash(product.query);
		if (!photo) {
			failed++;
			continue;
		}

		console.log(`  Found: by ${photo.photographer}`);

		// Upload directly to BC via image URL (BC downloads it)
		const uploaded = await uploadImageToBC(product.id, photo.url, `Photo by ${photo.photographer} on Unsplash`);

		if (uploaded) {
			success++;
			console.log(`  Uploaded to BC product ${product.id}`);
		} else {
			failed++;
		}

		// Small delay to respect Unsplash rate limits
		await new Promise((r) => setTimeout(r, 500));
	}

	console.log(`\n================================`);
	console.log(`Done. ${success} images uploaded, ${failed} failed.`);
}

main().catch(console.error);
