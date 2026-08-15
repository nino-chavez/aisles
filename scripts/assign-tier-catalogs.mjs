/**
 * Kibble & Co — Tier Catalog Assignment
 *
 * Phase 2 of the multi-pet catalog wave. Assigns the 82 real Kibble products
 * (49 dogs + 33 multi-pet, both already live on channel 1853406) to the
 * merchant-tier channels (Small, Medium, and — once available — Enterprise):
 *
 *   1. Channel assignments (product -> channel), batched.
 *   2. Category assignments: APPENDS tier category IDs to each product's
 *      existing `categories` array. BigCommerce's PUT /catalog/products
 *      REPLACES the categories array wholesale, so every write here is a
 *      read-union-write: fetch current categories, union in the new tier
 *      IDs, write the union back. Nothing existing is ever dropped.
 *
 * CREATE/APPEND-ONLY. Never removes a category or channel assignment. Never
 * modifies a channel's own config (name, status, tree binding) — that is out
 * of scope for this script.
 *
 * Idempotent — categories are unioned (re-running is a no-op once applied),
 * channel-assignments are PUT with the same body (BC dedupes).
 *
 * Usage: node scripts/assign-tier-catalogs.mjs [--enterprise-only]
 * Requires: BIGCOMMERCE_STORE_HASH, BIGCOMMERCE_ACCESS_TOKEN in env.
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STORE = process.env.BIGCOMMERCE_STORE_HASH;
const TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
if (!STORE || !TOKEN) {
	console.error('Missing BIGCOMMERCE_STORE_HASH or BIGCOMMERCE_ACCESS_TOKEN in env.');
	process.exit(1);
}
const BASE = `https://api.bigcommerce.com/stores/${STORE}/v3`;

const SHARED_DIR =
	'/private/tmp/claude-501/-Users-nino-Workspace-dev/4a41fac1-d07c-4137-8031-c52e31e55b2b/scratchpad/kibble-wave';
const CHANNELS_REPORT_PATH = join(SHARED_DIR, 'channels-report.json');
const ENTERPRISE_TREE_PATH = join(SHARED_DIR, 'enterprise-tree.json');
const MANIFEST_PATH = join(__dirname, '../src/lib/brand/reference/kibble-multipet-catalog.json');

const KIBBLE_CO_CHANNEL = 1853406; // source of truth for "the 82 real products"

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

// ─── Tier category ID maps (small + medium from channels-report.json) ────

function loadTierCategoryMaps() {
	const report = JSON.parse(readFileSync(CHANNELS_REPORT_PATH, 'utf-8'));

	const pathToId = (list) => {
		const map = {};
		for (const c of list) map[c.path] = c.id;
		return map;
	};

	return {
		small: {
			channelId: report.tiers.small.channelId,
			treeId: report.tiers.small.treeId,
			byPath: pathToId(report.categories.small),
		},
		medium: {
			channelId: report.tiers.medium.channelId,
			treeId: report.tiers.medium.treeId,
			byPath: pathToId(report.categories.medium),
		},
	};
}

function loadEnterpriseTierMap() {
	if (!existsSync(ENTERPRISE_TREE_PATH)) return null;
	const raw = JSON.parse(readFileSync(ENTERPRISE_TREE_PATH, 'utf-8'));
	// Actual shape: { treeId, channelId, categories: { "Species > Dept > Leaf": id, ... } }
	if (raw.byPath) return raw;
	if (raw.categories && !Array.isArray(raw.categories)) {
		return { channelId: raw.channelId, treeId: raw.treeId, byPath: raw.categories };
	}
	// Fallback shape: array of {path, id} like channels-report's category lists
	if (Array.isArray(raw.categories)) {
		const byPath = {};
		for (const c of raw.categories) byPath[c.path] = c.id;
		return { channelId: raw.channelId, treeId: raw.treeId, byPath };
	}
	return null;
}

// ─── Species / department resolution ──────────────────────────────────

// Normalizes multi-pet manifest species to the 4-species tier taxonomy.
const SPECIES_NORMALIZE = {
	cat: 'Cats',
	bird: 'Birds',
	snake: 'Reptiles',
	'bearded-dragon': 'Reptiles',
};

// metadata.productRole (my 33) -> { small: 'Treats & Toys' | 'Care & Wellness' | null, medium: department }
const ROLE_TO_TIER = {
	'staple-food': { smallExtra: null, mediumDept: 'Food' },
	topper: { smallExtra: null, mediumDept: 'Food' },
	litter: { smallExtra: 'Care & Wellness', mediumDept: 'Health & Care' },
	treat: { smallExtra: 'Treats & Toys', mediumDept: 'Treats' },
	feeding: { smallExtra: null, mediumDept: 'Gear & Habitat' },
	enrichment: { smallExtra: 'Treats & Toys', mediumDept: 'Toys & Enrichment' },
	travel: { smallExtra: null, mediumDept: 'Gear & Habitat' },
	habitat: { smallExtra: null, mediumDept: 'Gear & Habitat' },
	substrate: { smallExtra: null, mediumDept: 'Gear & Habitat' },
	hide: { smallExtra: null, mediumDept: 'Gear & Habitat' },
	'heat-source': { smallExtra: null, mediumDept: 'Gear & Habitat' },
	'environment-control': { smallExtra: null, mediumDept: 'Gear & Habitat' },
	'environment-monitor': { smallExtra: null, mediumDept: 'Gear & Habitat' },
	hydration: { smallExtra: null, mediumDept: 'Gear & Habitat' },
	'uvb-lighting': { smallExtra: null, mediumDept: 'Gear & Habitat' },
	'lighting-fixture': { smallExtra: null, mediumDept: 'Gear & Habitat' },
};

// Default-tree category name (the 49 dogs) -> tier mapping.
const DOG_DEPT_TO_TIER = {
	'Dog Food': { smallExtra: null, mediumDept: 'Food' },
	'Supplements & Wellness': { smallExtra: 'Care & Wellness', mediumDept: 'Health & Care' },
	'Treats & Chews': { smallExtra: 'Treats & Toys', mediumDept: 'Treats' },
	'Grooming & Care': { smallExtra: 'Care & Wellness', mediumDept: 'Health & Care' },
	Toys: { smallExtra: 'Treats & Toys', mediumDept: 'Toys & Enrichment' },
	'Walk & Gear': { smallExtra: null, mediumDept: 'Gear & Habitat' },
	'Beds & Apparel': { smallExtra: null, mediumDept: 'Gear & Habitat' },
	Bundles: { smallExtra: null, mediumDept: null }, // cross-department, unmapped by design
};

const TREE1_DOG_CATEGORY_NAMES = {
	325: 'Dog Food',
	326: 'Supplements & Wellness',
	327: 'Treats & Chews',
	328: 'Grooming & Care',
	329: 'Toys',
	330: 'Walk & Gear',
	331: 'Beds & Apparel',
	332: 'Bundles',
};

// Enterprise leaf resolution: the enterprise tree uses the *same five
// department names* as the medium tier (Food, Treats, Toys & Enrichment,
// Health & Care, Gear & Habitat) one level deeper (each department has 3-5
// real sub-category leaves). So department resolution reuses ROLE_TO_TIER /
// DOG_DEPT_TO_TIER's mediumDept, and leaf resolution is a word-overlap score
// between the leaf's own name and this product's known signal words (its
// phase-1 manifest category leaf name, for the 33 multi-pet products, plus
// its product name) — matched only against paths that actually exist in
// enterprise-tree.json, never an invented path. Falls back to the
// department-level id (2-level) when nothing scores above zero, and that
// fallback is reported as unmapped.
const STOPWORDS = new Set([
	'the', 'and', 'for', 'with', 'dog', 'dogs', 'cat', 'cats', 'bird', 'birds', 'pet', 'pets', 'count', 'pack',
	'aid', // "Calming Aid" was false-matching "First Aid" on this word alone
]);

function tokenize(str) {
	return (str || '')
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/)
		.filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function scoreLeafMatch(leafName, signalWords) {
	const leafWords = new Set(tokenize(leafName));
	let score = 0;
	for (const w of signalWords) if (leafWords.has(w)) score++;
	return score;
}

// ─── Data loading ──────────────────────────────────────────────────────

async function loadRealProducts() {
	const assignments = await api(
		'GET',
		`/catalog/products/channel-assignments?channel_id:in=${KIBBLE_CO_CHANNEL}&limit=100`,
	);
	const ids = assignments.data.map((a) => a.product_id);
	const idChunks = [];
	for (let i = 0; i < ids.length; i += 50) idChunks.push(ids.slice(i, i + 50));

	const products = [];
	for (const chunk of idChunks) {
		const res = await api('GET', `/catalog/products?id:in=${chunk.join(',')}&limit=50`);
		products.push(...res.data);
	}
	return products;
}

function classifyProducts(products, manifestBySku) {
	const rows = [];
	for (const p of products) {
		if (p.sku.startsWith('KIB-')) {
			const m = manifestBySku[p.sku];
			if (!m) {
				rows.push({ id: p.id, sku: p.sku, name: p.name, kind: 'unknown', error: 'not in manifest' });
				continue;
			}
			const species = SPECIES_NORMALIZE[m.metadata.species[0]] || null;
			const role = m.metadata.productRole;
			rows.push({
				id: p.id,
				sku: p.sku,
				name: p.name,
				kind: 'multipet',
				species,
				role,
				manifestLeaf: m.categories[m.categories.length - 1],
				currentCategories: p.categories,
			});
		} else {
			const tree1CategoryId = p.categories.find((c) => TREE1_DOG_CATEGORY_NAMES[c]);
			const dept = TREE1_DOG_CATEGORY_NAMES[tree1CategoryId] || null;
			rows.push({
				id: p.id,
				sku: p.sku,
				name: p.name,
				kind: 'dog',
				species: 'Dogs',
				dept,
				currentCategories: p.categories,
			});
		}
	}
	return rows;
}

// ─── Tier category resolution per product row ─────────────────────────

function resolveSmallCategories(row, small) {
	const ids = [];
	const speciesId = small.byPath[row.species];
	if (speciesId) ids.push(speciesId);

	let extra = null;
	if (row.kind === 'multipet') extra = ROLE_TO_TIER[row.role]?.smallExtra || null;
	if (row.kind === 'dog') extra = DOG_DEPT_TO_TIER[row.dept]?.smallExtra || null;
	if (extra && small.byPath[extra]) ids.push(small.byPath[extra]);

	return ids;
}

function resolveMediumCategory(row, medium) {
	let dept = null;
	if (row.kind === 'multipet') dept = ROLE_TO_TIER[row.role]?.mediumDept || null;
	if (row.kind === 'dog') dept = DOG_DEPT_TO_TIER[row.dept]?.mediumDept || null;

	if (dept) {
		const path = `${row.species} > ${dept}`;
		if (medium.byPath[path]) return { id: medium.byPath[path], path, mapped: true };
	}
	// Unmapped -> species-level fallback, flagged.
	const speciesId = medium.byPath[row.species];
	return { id: speciesId, path: row.species, mapped: false };
}

function resolveEnterpriseCategory(row, enterprise) {
	const dept = row.kind === 'multipet' ? ROLE_TO_TIER[row.role]?.mediumDept : DOG_DEPT_TO_TIER[row.dept]?.mediumDept;

	if (!dept) {
		// No department for this bucket by design (e.g. dog Bundles span every
		// department) -> species-level fallback, reported as unmapped.
		const speciesId = enterprise.byPath[row.species];
		return { id: speciesId, path: row.species, mapped: false };
	}

	const deptPath = `${row.species} > ${dept}`;
	const deptId = enterprise.byPath[deptPath];

	// Department-name words (e.g. "care" in "Health & Care", "treats" in
	// "Treats") recur across every sibling leaf in that department and are
	// not discriminating -- strip them from the signal before scoring, or
	// they win ties by insertion order instead of by an actual match.
	const deptWords = new Set(tokenize(dept));
	const signalSource = row.kind === 'multipet' ? `${row.manifestLeaf || ''} ${row.name}` : `${row.name} ${row.sku}`;
	const signalWords = tokenize(signalSource).filter((w) => !deptWords.has(w));

	let best = null;
	let bestScore = 0;
	let tie = false;
	for (const [path, id] of Object.entries(enterprise.byPath)) {
		if (!path.startsWith(`${deptPath} > `)) continue;
		const leafName = path.slice(deptPath.length + 3);
		const score = scoreLeafMatch(leafName, signalWords);
		if (score > bestScore) {
			bestScore = score;
			best = { id, path };
			tie = false;
		} else if (score === bestScore && score > 0) {
			tie = true;
		}
	}

	// An unresolved tie means the matched word doesn't actually discriminate
	// between candidate leaves -- fall through to department-level rather
	// than pick one arbitrarily.
	if (best && !tie) return { ...best, mapped: true, score: bestScore };
	if (deptId) return { id: deptId, path: deptPath, mapped: false };
	// Department name itself doesn't exist in the enterprise tree (shouldn't
	// happen — enterprise and medium share department names) -> species fallback.
	const speciesId = enterprise.byPath[row.species];
	return { id: speciesId, path: row.species, mapped: false };
}

// ─── Category write (read-union-write) ─────────────────────────────────

async function unionCategoriesForProduct(productId, addIds) {
	const current = await api('GET', `/catalog/products/${productId}`);
	const existing = new Set(current.data.categories || []);
	const before = existing.size;
	for (const id of addIds) {
		if (id) existing.add(id);
	}
	const union = [...existing];
	if (union.length === before && addIds.every((id) => current.data.categories.includes(id))) {
		return { changed: false, categories: union };
	}
	await api('PUT', `/catalog/products/${productId}`, { categories: union });
	return { changed: true, categories: union };
}

// ─── Channel assignments (batched) ─────────────────────────────────────

async function batchChannelAssignments(productIds, channelIds) {
	const entries = [];
	for (const productId of productIds) {
		for (const channelId of channelIds) {
			entries.push({ product_id: productId, channel_id: channelId });
		}
	}
	const CHUNK = 100;
	for (let i = 0; i < entries.length; i += CHUNK) {
		const chunk = entries.slice(i, i + CHUNK);
		await api('PUT', '/catalog/products/channel-assignments', chunk);
		console.log(`  Channel-assigned ${Math.min(i + CHUNK, entries.length)}/${entries.length} entries`);
	}
}

// ─── Verification ───────────────────────────────────────────────────────

async function channelTotal(channelId) {
	const res = await api('GET', `/catalog/products/channel-assignments?channel_id:in=${channelId}&limit=1`);
	return res.meta.pagination.total;
}

// Scoped to a known set of product IDs, so a channel that's also receiving
// unrelated writes (e.g. a synthetic-corpus seeder running concurrently on
// the enterprise channel) doesn't get misreported via the channel's raw
// pagination total.
async function scopedChannelCount(channelId, productIds) {
	const idSet = new Set(productIds);
	let count = 0;
	const CHUNK = 50;
	for (let i = 0; i < productIds.length; i += CHUNK) {
		const chunk = productIds.slice(i, i + CHUNK);
		const res = await api(
			'GET',
			`/catalog/products/channel-assignments?channel_id:in=${channelId}&product_id:in=${chunk.join(',')}&limit=${CHUNK}`,
		);
		for (const a of res.data) {
			if (idSet.has(a.product_id)) count++;
		}
	}
	return count;
}

// ─── Main passes ─────────────────────────────────────────────────────

async function runSmallMediumPass(rows, tierMaps) {
	console.log('\n=== Channel assignments: small + medium ===');
	await batchChannelAssignments(
		rows.map((r) => r.id),
		[tierMaps.small.channelId, tierMaps.medium.channelId],
	);

	console.log('\n=== Category assignments: small + medium (read-union-write) ===');
	const mappingTable = [];
	const unmapped = [];

	for (const row of rows) {
		const smallIds = resolveSmallCategories(row, tierMaps.small);
		const mediumResolved = resolveMediumCategory(row, tierMaps.medium);

		const addIds = [...smallIds, mediumResolved.id].filter(Boolean);
		const result = await unionCategoriesForProduct(row.id, addIds);

		mappingTable.push({
			sku: row.sku,
			name: row.name,
			species: row.species,
			bucket: row.kind === 'multipet' ? row.role : row.dept,
			smallCategoryIds: smallIds,
			mediumCategoryId: mediumResolved.id,
			mediumPath: mediumResolved.path,
			mediumMapped: mediumResolved.mapped,
			categoriesChanged: result.changed,
		});

		if (!mediumResolved.mapped) {
			unmapped.push({ sku: row.sku, name: row.name, tier: 'medium', reason: 'no department match, used species-level' });
		}

		console.log(
			`  ${row.sku} -> small:[${smallIds.join(',')}] medium:${mediumResolved.id}(${mediumResolved.path}${mediumResolved.mapped ? '' : ' UNMAPPED'})`,
		);
	}

	return { mappingTable, unmapped };
}

async function runEnterprisePass(rows, enterprise) {
	console.log('\n=== Channel assignments: enterprise ===');
	await batchChannelAssignments(
		rows.map((r) => r.id),
		[enterprise.channelId],
	);

	console.log('\n=== Category assignments: enterprise (read-union-write) ===');
	const mappingTable = [];
	const unmapped = [];

	for (const row of rows) {
		const resolved = resolveEnterpriseCategory(row, enterprise);
		const addIds = resolved.id ? [resolved.id] : [];
		const result = addIds.length > 0 ? await unionCategoriesForProduct(row.id, addIds) : { changed: false };

		mappingTable.push({
			sku: row.sku,
			name: row.name,
			species: row.species,
			bucket: row.kind === 'multipet' ? row.role : row.dept,
			enterpriseCategoryId: resolved.id,
			enterprisePath: resolved.path,
			enterpriseMapped: resolved.mapped,
			categoriesChanged: result.changed,
		});

		if (!resolved.mapped) {
			unmapped.push({
				sku: row.sku,
				name: row.name,
				tier: 'enterprise',
				reason: resolved.id ? 'no exact leaf match, used department-level' : 'no match at all in enterprise tree',
			});
		}

		console.log(`  ${row.sku} -> enterprise:${resolved.id}(${resolved.path}${resolved.mapped ? '' : ' UNMAPPED'})`);
	}

	return { mappingTable, unmapped };
}

// ─── Run ────────────────────────────────────────────────────────────

async function main() {
	console.log('Kibble & Co — Tier Catalog Assignment');
	console.log(`Store: ${STORE}`);
	console.log('=====================================');

	const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
	const manifestBySku = {};
	for (const p of manifest.products) manifestBySku[p.sku] = p;

	const tierMaps = loadTierCategoryMaps();
	console.log(`Small: channel ${tierMaps.small.channelId}, tree ${tierMaps.small.treeId}`);
	console.log(`Medium: channel ${tierMaps.medium.channelId}, tree ${tierMaps.medium.treeId}`);

	console.log('\n=== Loading the 82 real products (channel 1853406) ===');
	const products = await loadRealProducts();
	console.log(`  Loaded ${products.length} products`);

	const rows = classifyProducts(products, manifestBySku);
	const badRows = rows.filter((r) => r.kind === 'unknown');
	if (badRows.length > 0) {
		console.log(`  WARNING: ${badRows.length} products could not be classified:`, badRows);
	}
	const classifiable = rows.filter((r) => r.kind !== 'unknown');

	const smMediumResult = await runSmallMediumPass(classifiable, tierMaps);

	const smallTotal = await channelTotal(tierMaps.small.channelId);
	const mediumTotal = await channelTotal(tierMaps.medium.channelId);

	console.log('\n=== Spot-check (5 products) ===');
	const spotChecks = [];
	for (const row of classifiable.slice(0, 5)) {
		const p = await api('GET', `/catalog/products/${row.id}`);
		spotChecks.push({ sku: row.sku, id: row.id, categories: p.data.categories });
		console.log(`  ${row.sku}: ${JSON.stringify(p.data.categories)}`);
	}

	const report = {
		phase: 'small+medium',
		perChannelTotals: {
			small: smallTotal,
			medium: mediumTotal,
		},
		mappingTable: smMediumResult.mappingTable,
		unmapped: smMediumResult.unmapped,
		spotChecks,
		commit: null, // filled in by shell after commit
	};

	mkdirSync(SHARED_DIR, { recursive: true });
	writeFileSync(join(SHARED_DIR, 'tier-assign-report.json'), JSON.stringify(report, null, 2));
	console.log('\nReport written (small+medium phase):', join(SHARED_DIR, 'tier-assign-report.json'));

	console.log('\n=====================================');
	console.log(`Small channel total: ${smallTotal}`);
	console.log(`Medium channel total: ${mediumTotal}`);
	console.log(`Unmapped: ${smMediumResult.unmapped.length}`);

	// ── Enterprise pass (only if the tree file is already present) ──
	const enterprise = loadEnterpriseTierMap();
	if (enterprise && enterprise.channelId) {
		console.log('\n=== Enterprise tree found — running enterprise pass ===');
		const entResult = await runEnterprisePass(classifiable, enterprise);
		// Scoped to our own 82 product IDs: channel 1857860 may also be
		// receiving a concurrent synthetic-corpus seed, so the raw
		// pagination total on the channel is not a reliable "our 82" count.
		const enterpriseScopedCount = await scopedChannelCount(
			enterprise.channelId,
			classifiable.map((r) => r.id),
		);
		const enterpriseRawTotal = await channelTotal(enterprise.channelId);
		report.phase = 'small+medium+enterprise';
		report.perChannelTotals.enterprise = enterpriseScopedCount;
		report.perChannelTotals.enterpriseChannelRawTotal = enterpriseRawTotal;
		report.enterpriseMappingTable = entResult.mappingTable;
		report.unmapped = [...report.unmapped, ...entResult.unmapped];
		writeFileSync(join(SHARED_DIR, 'tier-assign-report.json'), JSON.stringify(report, null, 2));
		console.log(`Enterprise channel — our 82 products assigned: ${enterpriseScopedCount} (channel raw total: ${enterpriseRawTotal})`);
	} else {
		console.log('\nEnterprise tree not yet available — small+medium complete, enterprise pending.');
	}

	return report;
}

main().catch((err) => {
	console.error('\nFatal error:', err);
	process.exit(1);
});
