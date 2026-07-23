#!/usr/bin/env node
/**
 * Read-only inventory of the BigCommerce store.
 * Used before any destructive operation to verify state.
 */
import 'dotenv/config';

const STORE = process.env.BIGCOMMERCE_STORE_HASH;
const TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const BASE = `https://api.bigcommerce.com/stores/${STORE}/v3`;

const headers = {
	'X-Auth-Token': TOKEN,
	'Content-Type': 'application/json',
	Accept: 'application/json',
};

async function api(path) {
	const res = await fetch(`${BASE}${path}`, { headers });
	if (res.status === 429) {
		const wait = parseInt(res.headers.get('X-Rate-Limit-Time-Reset-Ms') || '1000');
		await new Promise((r) => setTimeout(r, wait + 100));
		return api(path);
	}
	if (!res.ok) throw new Error(`${res.status} ${path}: ${await res.text()}`);
	return res.json();
}

console.log(`\nStore: ${STORE}\n`);

// 1. Channels
console.log('=== Channels ===');
const channels = await api('/channels');
for (const ch of channels.data) {
	console.log(`  ID ${ch.id} | name="${ch.name}" | type=${ch.type} | platform=${ch.platform} | status=${ch.status}`);
}

// 2. Total product count
console.log('\n=== Catalog totals ===');
const products = await api('/catalog/products?limit=1');
console.log(`  Products: ${products.meta.pagination.total}`);
const cats = await api('/catalog/categories?limit=1');
console.log(`  Categories: ${cats.meta.pagination.total}`);

// 3. Categories by channel (if more than 1 channel exists)
console.log('\n=== Category trees (top-level) ===');
const trees = await api('/catalog/trees');
for (const tree of trees.data) {
	console.log(`  Tree ID ${tree.id} | name="${tree.name}" | channels=[${tree.channels.join(',')}]`);
}

// 4. Sample products
console.log('\n=== First 10 products (sample) ===');
const sample = await api('/catalog/products?limit=10');
for (const p of sample.data) {
	const cats = p.categories?.length || 0;
	console.log(`  ${p.id} | "${p.name}" | $${p.price} | categories=${cats}`);
}

// 5. Sample categories
console.log('\n=== First 20 categories (sample) ===');
const samCats = await api('/catalog/categories?limit=20');
for (const c of samCats.data) {
	console.log(`  ${c.id} | "${c.name}" | tree=${c.tree_id} | parent=${c.parent_id}`);
}

console.log('\n');
