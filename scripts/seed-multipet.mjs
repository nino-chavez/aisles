/**
 * Kibble & Co — Multi-Pet Catalog Seed Script
 *
 * Seeds the 33 researched multi-pet products (cats, birds, reptiles) from
 * src/lib/brand/reference/kibble-multipet-catalog.json into the BigCommerce
 * sandbox: brands, nested categories (default tree), products, generated
 * packshot images, and channel assignments.
 *
 * CREATE-ONLY. Never deletes or modifies existing catalog data. Idempotent —
 * safe to re-run; every step checks for an existing match (by SKU for
 * products, by name+parent for categories, by exact name for brands) before
 * creating anything.
 *
 * Usage: node scripts/seed-multipet.mjs
 * Requires: BIGCOMMERCE_STORE_HASH, BIGCOMMERCE_ACCESS_TOKEN in env.
 */

import 'dotenv/config';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STORE = process.env.BIGCOMMERCE_STORE_HASH;
const TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
if (!STORE || !TOKEN) {
	console.error('Missing BIGCOMMERCE_STORE_HASH or BIGCOMMERCE_ACCESS_TOKEN in env.');
	process.exit(1);
}
const BASE = `https://api.bigcommerce.com/stores/${STORE}/v3`;

const DEFAULT_TREE_ID = 1;
const CHANNEL_IDS = [1, 1853406];

const MANIFEST_PATH = join(__dirname, '../src/lib/brand/reference/kibble-multipet-catalog.json');
const PACKSHOT_DIR = join(os.tmpdir(), 'kibble-multipet-packshots');

const SPECIES_PALETTE = {
	cat: { bg: '#E8DFD3', pkg: '#B9A98A' },
	bird: { bg: '#DCE8DF', pkg: '#8FAE9C' },
	reptile: { bg: '#D9E2E8', pkg: '#7F98A6' },
};

const headers = {
	'X-Auth-Token': TOKEN,
	'Content-Type': 'application/json',
};

async function api(method, path, body) {
	const url = `${BASE}${path}`;
	const opts = { method, headers };
	if (body) opts.body = JSON.stringify(body);

	const res = await fetch(url, opts);

	if (res.status === 429) {
		const retry = parseInt(res.headers.get('X-Rate-Limit-Time-Reset-Ms') || '1000', 10);
		console.log(`  Rate limited, waiting ${retry}ms...`);
		await new Promise((r) => setTimeout(r, retry + 100));
		return api(method, path, body);
	}

	if (res.status === 204) return null;

	const text = await res.text();
	let data;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = text;
	}

	if (!res.ok) {
		console.error(`  API Error ${res.status} on ${method} ${path}:`, JSON.stringify(data, null, 2).slice(0, 1000));
		throw new Error(`API ${method} ${path} failed: ${res.status}`);
	}
	return data;
}

async function apiMultipart(method, path, formData) {
	const url = `${BASE}${path}`;
	const res = await fetch(url, {
		method,
		headers: { 'X-Auth-Token': TOKEN }, // no Content-Type — fetch sets multipart boundary
		body: formData,
	});

	if (res.status === 429) {
		const retry = parseInt(res.headers.get('X-Rate-Limit-Time-Reset-Ms') || '1000', 10);
		console.log(`  Rate limited, waiting ${retry}ms...`);
		await new Promise((r) => setTimeout(r, retry + 100));
		return apiMultipart(method, path, formData);
	}

	const text = await res.text();
	let data;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = text;
	}

	if (!res.ok) {
		console.error(`  API Error ${res.status} on ${method} ${path}:`, JSON.stringify(data, null, 2).slice(0, 1000));
		throw new Error(`API ${method} ${path} failed: ${res.status}`);
	}
	return data;
}

function truncate(str, max = 250) {
	if (!str) return '';
	return str.length > max ? str.slice(0, max) : str;
}

// ─── Step 1: Brands ──────────────────────────────────────────────────

async function ensureBrand(name, brandIds) {
	if (brandIds[name]) return brandIds[name];

	const existing = await api('GET', `/catalog/brands?name=${encodeURIComponent(name)}`);
	if (existing.data.length > 0) {
		brandIds[name] = existing.data[0].id;
		console.log(`  Brand exists: ${name} [${brandIds[name]}]`);
		return brandIds[name];
	}

	const created = await api('POST', '/catalog/brands', { name });
	brandIds[name] = created.data.id;
	console.log(`  Brand created: ${name} [${brandIds[name]}]`);
	return brandIds[name];
}

async function ensureBrands(products) {
	console.log('\n=== Ensuring brands ===');
	const brandIds = {};
	const uniqueBrands = [...new Set(products.map((p) => p.brand))].sort();
	for (const name of uniqueBrands) {
		await ensureBrand(name, brandIds);
	}
	console.log(`  Done. ${Object.keys(brandIds).length} brands resolved.`);
	return brandIds;
}

// ─── Step 2: Categories ──────────────────────────────────────────────

async function ensureCategory(name, parentId) {
	const existing = await api(
		'GET',
		`/catalog/categories?name=${encodeURIComponent(name)}&parent_id=${parentId}`,
	);
	if (existing.data.length > 0) {
		return existing.data[0].id;
	}

	const created = await api('POST', '/catalog/categories', {
		name,
		parent_id: parentId,
		is_visible: true,
	});
	console.log(`  Category created: ${name} (parent ${parentId}) [${created.data.id}]`);
	return created.data.id;
}

async function ensureCategoryPath(pathArr, categoryIds) {
	const key = pathArr.join(' > ');
	if (categoryIds[key]) return categoryIds[key];

	let parentId = 0;
	let cumulative = [];
	for (const segment of pathArr) {
		cumulative.push(segment);
		const cumKey = cumulative.join(' > ');
		if (categoryIds[cumKey]) {
			parentId = categoryIds[cumKey];
			continue;
		}
		const id = await ensureCategory(segment, parentId);
		categoryIds[cumKey] = id;
		parentId = id;
	}
	return categoryIds[key];
}

async function ensureCategories(products) {
	console.log('\n=== Ensuring categories (tree 1) ===');
	const categoryIds = {};
	const uniquePaths = [];
	const seen = new Set();
	for (const p of products) {
		const key = p.categories.join(' > ');
		if (!seen.has(key)) {
			seen.add(key);
			uniquePaths.push(p.categories);
		}
	}
	for (const pathArr of uniquePaths) {
		await ensureCategoryPath(pathArr, categoryIds);
	}
	console.log(`  Done. ${Object.keys(categoryIds).length} category nodes resolved.`);
	return categoryIds;
}

// ─── Step 3: Packshot image generation ───────────────────────────────

function wrapText(text, maxChars) {
	const words = text.split(' ');
	const lines = [];
	let current = '';
	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (candidate.length > maxChars && current) {
			lines.push(current);
			current = word;
		} else {
			current = candidate;
		}
	}
	if (current) lines.push(current);
	return lines;
}

function escapeXml(str) {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

async function generatePackshot(product, filePath) {
	const species = product.metadata.species[0] || 'cat';
	const palette = SPECIES_PALETTE[species] || SPECIES_PALETTE.cat;

	const width = 386;
	const height = 513;

	const pkgW = 220;
	const pkgH = 320;
	const pkgX = (width - pkgW) / 2;
	const pkgY = (height - pkgH) / 2 + 20;

	const brandLine = escapeXml(product.brand.toUpperCase());
	const shortName = escapeXml(product.name.split(' ').slice(0, 5).join(' '));
	const nameLines = wrapText(shortName, 18).slice(0, 4);

	const nameStartY = pkgY + pkgH / 2 - ((nameLines.length - 1) * 22) / 2;
	const nameTspans = nameLines
		.map((line, i) => `<tspan x="${width / 2}" y="${nameStartY + i * 22}">${line}</tspan>`)
		.join('');

	const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${palette.bg}" />
  <rect x="${pkgX}" y="${pkgY}" width="${pkgW}" height="${pkgH}" rx="18" ry="18" fill="${palette.pkg}" />
  <text x="${width / 2}" y="${pkgY - 24}" font-family="Helvetica, Arial, sans-serif" font-size="13" letter-spacing="2" text-anchor="middle" fill="#3A3A3A" font-weight="600">${brandLine}</text>
  <text font-family="Helvetica, Arial, sans-serif" font-size="18" text-anchor="middle" fill="#FFFFFF" font-weight="600">${nameTspans}</text>
</svg>`.trim();

	await sharp(Buffer.from(svg)).png().toFile(filePath);
}

// ─── Step 4: Products ─────────────────────────────────────────────────

async function findExistingProductBySku(sku) {
	const res = await api('GET', `/catalog/products?sku=${encodeURIComponent(sku)}`);
	return res.data.length > 0 ? res.data[0] : null;
}

function buildProductPayload(product, brandIds, categoryIds) {
	const leafCategoryId = categoryIds[product.categories.join(' > ')];
	const priceNum = parseFloat(product.price);

	return {
		name: product.name,
		type: 'physical',
		sku: product.sku,
		price: priceNum,
		weight: 1,
		description: `<p>${escapeXml(product.description)}</p>`,
		brand_id: brandIds[product.brand],
		categories: [leafCategoryId],
		is_visible: true,
		search_keywords: (product.tags || []).join(','),
		availability: 'available',
		inventory_level: 100,
		inventory_tracking: 'product',
		custom_fields: [
			{ name: 'provenance', value: truncate('research-candidate') },
			{ name: 'species', value: truncate((product.metadata.species || []).join(',')) },
			{ name: 'product_role', value: truncate(product.metadata.productRole || '') },
			{ name: 'source_retailer', value: truncate(product.source.retailer || '') },
			{ name: 'source_url', value: truncate(product.source.url || '') },
			{ name: 'retrieved_at', value: truncate(product.source.retrievedAt || '') },
		],
	};
}

async function ensureProduct(product, brandIds, categoryIds) {
	const existing = await findExistingProductBySku(product.sku);
	if (existing) {
		console.log(`  Product exists: ${product.sku} [${existing.id}]`);
		return { id: existing.id, created: false };
	}

	const payload = buildProductPayload(product, brandIds, categoryIds);
	const res = await api('POST', '/catalog/products', payload);
	console.log(`  Product created: ${product.sku} — ${product.name} [${res.data.id}]`);
	return { id: res.data.id, created: true };
}

async function ensureProductImage(product, productId) {
	const existingImages = await api('GET', `/catalog/products/${productId}/images`);
	if (existingImages.data && existingImages.data.length > 0) {
		return { hasImage: true, created: false };
	}

	mkdirSync(PACKSHOT_DIR, { recursive: true });
	const filePath = join(PACKSHOT_DIR, `${product.sku}.png`);
	await generatePackshot(product, filePath);

	const fileBuffer = readFileSync(filePath);
	const form = new FormData();
	form.append('image_file', new Blob([fileBuffer], { type: 'image/png' }), `${product.sku}.png`);
	form.append('is_thumbnail', 'true');

	await apiMultipart('POST', `/catalog/products/${productId}/images`, form);
	return { hasImage: true, created: true };
}

async function ensureChannelAssignments(productId) {
	const assignments = CHANNEL_IDS.map((channel_id) => ({ product_id: productId, channel_id }));
	await api('PUT', '/catalog/products/channel-assignments', assignments);
}

// ─── Verification ─────────────────────────────────────────────────────

async function verifyProduct(sku) {
	const found = await findExistingProductBySku(sku);
	if (!found) return { sku, ok: false, reason: 'not found' };

	const [images, customFields] = await Promise.all([
		api('GET', `/catalog/products/${found.id}/images`),
		api('GET', `/catalog/products/${found.id}/custom-fields`),
	]);

	return {
		sku,
		productId: found.id,
		ok: true,
		hasImage: (images.data || []).length > 0,
		customFieldCount: (customFields.data || []).length,
		categoryId: (found.categories || [])[0],
	};
}

// ─── Run ────────────────────────────────────────────────────────────

async function main() {
	console.log('Kibble & Co — Multi-Pet Catalog Seed');
	console.log(`Store: ${STORE}`);
	console.log('=====================================');

	const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
	const products = manifest.products;
	console.log(`Manifest: ${products.length} products`);

	const brandIds = await ensureBrands(products);
	const categoryIds = await ensureCategories(products);

	console.log('\n=== Ensuring products, images, channel assignments ===');
	const skuToProductId = {};
	const failures = [];

	for (const product of products) {
		try {
			const { id: productId } = await ensureProduct(product, brandIds, categoryIds);
			skuToProductId[product.sku] = productId;

			const imgResult = await ensureProductImage(product, productId);
			if (imgResult.created) {
				console.log(`    Image uploaded: ${product.sku}`);
			}

			await ensureChannelAssignments(productId);
		} catch (err) {
			console.error(`  FAILED: ${product.sku} — ${err.message}`);
			failures.push({ sku: product.sku, name: product.name, error: err.message });
		}
	}

	console.log('\n=== Verification ===');
	const verifications = [];
	for (const product of products) {
		const v = await verifyProduct(product.sku);
		verifications.push({ ...v, name: product.name, category: product.categories.join(' > ') });
	}

	console.log('\nsku\t\tproduct_id\tcategory\t\t\t\timage');
	for (const v of verifications) {
		if (!v.ok) {
			console.log(`${v.sku}\tMISSING\t\t${v.reason}`);
			continue;
		}
		console.log(`${v.sku}\t${v.productId}\t${v.category}\t${v.hasImage ? 'yes' : 'NO'}\tcustom_fields=${v.customFieldCount}`);
	}

	const channel1Count = await api('GET', '/catalog/products/channel-assignments?channel_id:in=1&limit=1');
	const channelKibbleCount = await api(
		'GET',
		'/catalog/products/channel-assignments?channel_id:in=1853406&limit=1',
	);

	console.log('\n=====================================');
	console.log(`Brands resolved: ${Object.keys(brandIds).length}`);
	console.log(`Category nodes resolved: ${Object.keys(categoryIds).length}`);
	console.log(`Products processed: ${products.length}`);
	console.log(`Failures: ${failures.length}`);
	console.log(`Channel 1 total assignments: ${channel1Count.meta.pagination.total}`);
	console.log(`Channel 1853406 total assignments: ${channelKibbleCount.meta.pagination.total}`);

	if (failures.length > 0) {
		console.log('\nFailed rows:');
		for (const f of failures) console.log(`  ${f.sku} (${f.name}): ${f.error}`);
	}

	return {
		skuToProductId,
		categoryIds,
		brandIds,
		channel1Total: channel1Count.meta.pagination.total,
		channelKibbleTotal: channelKibbleCount.meta.pagination.total,
		failures,
		verifications,
	};
}

main()
	.then((result) => {
		const outPath = process.env.SEED_REPORT_PATH;
		if (outPath) {
			mkdirSync(dirname(outPath), { recursive: true });
			writeFileSync(outPath, JSON.stringify(result, null, 2));
			console.log(`\nReport written: ${outPath}`);
		}
	})
	.catch((err) => {
		console.error('\nFatal error:', err);
		process.exit(1);
	});
