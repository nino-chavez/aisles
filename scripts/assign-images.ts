/**
 * Assigns Unsplash furniture images to products missing images.
 * Uses BC REST API to set image_url on each product.
 *
 * Run: npx tsx scripts/assign-images.ts
 */

import 'dotenv/config';

const STORE_HASH = process.env.BIGCOMMERCE_STORE_HASH!;
const TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN!;
const BASE = `https://api.bigcommerce.com/stores/${STORE_HASH}/v3`;

// Curated Unsplash furniture images by type keyword
const IMAGE_MAP: Record<string, string[]> = {
	'desk': [
		'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800',
		'https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=800',
		'https://images.unsplash.com/photo-1611269154421-4e27233ac5c7?w=800',
	],
	'chair': [
		'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800',
		'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
		'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800',
	],
	'sofa': [
		'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
		'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800',
		'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=800',
	],
	'table': [
		'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=800',
		'https://images.unsplash.com/photo-1611967164521-abae8fba4668?w=800',
		'https://images.unsplash.com/photo-1577140917170-285929fb55b7?w=800',
	],
	'bed': [
		'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800',
		'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800',
		'https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=800',
	],
	'cabinet': [
		'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800',
		'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800',
		'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800',
	],
	'bookshelf': [
		'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800',
		'https://images.unsplash.com/photo-1594620302200-9a762244a156?w=800',
	],
	'bench': [
		'https://images.unsplash.com/photo-1572297891732-c7e66dd97eda?w=800',
		'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800',
	],
	'vanity': [
		'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=800',
		'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800',
	],
	'ottoman': [
		'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800',
	],
	'hammock': [
		'https://images.unsplash.com/photo-1531973819741-e27a5ae2cc7b?w=800',
	],
	'headboard': [
		'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800',
		'https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=800',
	],
	'wardrobe': [
		'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800',
	],
	'credenza': [
		'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800',
	],
	'lamp': [
		'https://images.unsplash.com/photo-1507473885765-e6ed057ab3fe?w=800',
	],
	// Fallback for anything else
	'default': [
		'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
		'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800',
		'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800',
		'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800',
	],
};

function pickImage(productName: string, index: number): string {
	const nameLower = productName.toLowerCase();
	for (const [keyword, images] of Object.entries(IMAGE_MAP)) {
		if (keyword === 'default') continue;
		if (nameLower.includes(keyword)) {
			return images[index % images.length];
		}
	}
	return IMAGE_MAP.default[index % IMAGE_MAP.default.length];
}

async function main() {
	// Get products without images
	const res = await fetch(`${BASE}/catalog/products?limit=50&id:min=405&include=images`, {
		headers: { 'X-Auth-Token': TOKEN },
	});
	const { data: products } = await res.json();

	const needImages = products.filter((p: any) => !p.images || p.images.length === 0);
	console.log(`${needImages.length} products need images`);

	let assigned = 0;
	let failed = 0;

	for (let i = 0; i < needImages.length; i++) {
		const product = needImages[i];
		const imageUrl = pickImage(product.name, i);

		try {
			const imgRes = await fetch(`${BASE}/catalog/products/${product.id}/images`, {
				method: 'POST',
				headers: {
					'X-Auth-Token': TOKEN,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					is_thumbnail: true,
					sort_order: 0,
					image_url: imageUrl,
				}),
			});

			if (!imgRes.ok) {
				const err = await imgRes.text();
				throw new Error(`${imgRes.status}: ${err}`);
			}

			process.stdout.write(`  ${product.name}... OK\n`);
			assigned++;
		} catch (err) {
			process.stdout.write(`  ${product.name}... FAILED: ${err instanceof Error ? err.message : err}\n`);
			failed++;
		}

		// Rate limit: BC allows 150 req/30s
		if (i % 10 === 9) {
			await new Promise(r => setTimeout(r, 2000));
		}
	}

	console.log(`\nDone: ${assigned} assigned, ${failed} failed`);
}

main().catch(console.error);
