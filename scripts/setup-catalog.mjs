/**
 * Haven Demo Store — Catalog Setup Script
 *
 * Cleans existing BC catalog and creates the Haven furniture catalog
 * for the Prism walking skeleton.
 *
 * Usage: node scripts/setup-catalog.mjs
 */

import 'dotenv/config';

const STORE = process.env.BIGCOMMERCE_STORE_HASH;
const TOKEN = process.env.BIGCOMMERCE_ACCESS_TOKEN;
const BASE = `https://api.bigcommerce.com/stores/${STORE}/v3`;

const headers = {
	'X-Auth-Token': TOKEN,
	'Content-Type': 'application/json',
};

async function api(method, path, body) {
	const url = `${BASE}${path}`;
	const opts = { method, headers };
	if (body) opts.body = JSON.stringify(body);

	const res = await fetch(url, opts);

	// Rate limit handling
	if (res.status === 429) {
		const retry = parseInt(res.headers.get('X-Rate-Limit-Time-Reset-Ms') || '1000');
		console.log(`  Rate limited, waiting ${retry}ms...`);
		await new Promise((r) => setTimeout(r, retry + 100));
		return api(method, path, body);
	}

	if (res.status === 204) return null;

	const data = await res.json();
	if (!res.ok) {
		console.error(`  API Error ${res.status}:`, JSON.stringify(data, null, 2));
		throw new Error(`API ${method} ${path} failed: ${res.status}`);
	}
	return data;
}

// ─── Step 1: Delete all existing products ───────────────────────────

async function deleteAllProducts() {
	console.log('\n=== Deleting existing products ===');
	let page = 1;
	let deleted = 0;

	while (true) {
		const res = await api('GET', `/catalog/products?limit=50&page=1`);
		const products = res.data;
		if (products.length === 0) break;

		const ids = products.map((p) => p.id).join(',');
		await api('DELETE', `/catalog/products?id:in=${ids}`);
		deleted += products.length;
		console.log(`  Deleted ${deleted} products...`);
	}

	console.log(`  Done. Deleted ${deleted} total products.`);
}

// ─── Step 2: Delete all existing categories ─────────────────────────

async function deleteAllCategories() {
	console.log('\n=== Deleting existing categories ===');

	// Delete children first (deepest first)
	for (let round = 0; round < 5; round++) {
		const res = await api('GET', '/catalog/categories?limit=50');
		const cats = res.data;
		if (cats.length === 0) break;

		// Sort by depth (children first)
		const leaves = cats.filter((c) => !cats.some((other) => other.parent_id === c.id));
		if (leaves.length === 0) break;

		for (const cat of leaves) {
			await api('DELETE', `/catalog/categories/${cat.id}`);
			console.log(`  Deleted category: ${cat.name}`);
		}
	}

	console.log('  Done.');
}

// ─── Step 3: Create Haven categories ────────────────────────────────

async function createCategories() {
	console.log('\n=== Creating Haven categories ===');

	const categories = [
		{ name: 'Living Room', description: 'Sofas, sectionals, coffee tables, accent chairs, and lighting', sort_order: 1 },
		{ name: 'Office', description: 'Desks, chairs, storage, and accessories for home offices and dorm rooms', sort_order: 2 },
	];

	const created = {};
	for (const cat of categories) {
		const res = await api('POST', '/catalog/categories', {
			...cat,
			is_visible: true,
			parent_id: 0,
		});
		created[cat.name] = res.data.id;
		console.log(`  Created: ${cat.name} [${res.data.id}]`);
	}

	return created;
}

// ─── Step 4: Create Haven products ──────────────────────────────────

async function createProducts(categoryIds) {
	console.log('\n=== Creating Haven products ===');

	const products = [
		// ── Living Room (15 products) ──
		{
			name: 'Carmel Leather Sectional',
			type: 'physical',
			weight: 180,
			price: 2499,
			categories: [categoryIds['Living Room']],
			description: '<p>Clean-lined L-shaped sectional in top-grain Italian leather. Reversible chaise configuration. Kiln-dried hardwood frame with double-doweled joints and sinuous spring support. Leather will develop a rich patina over time.</p>',
			sku: 'HVN-LR-001',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Top-grain Italian leather' },
				{ name: 'Seats', value: '5' },
				{ name: 'Dimensions', value: '112" W x 85" D x 33" H' },
				{ name: 'Frame', value: 'Kiln-dried hardwood' },
			],
		},
		{
			name: 'Nora Velvet Sofa',
			type: 'physical',
			weight: 120,
			price: 1899,
			sale_price: 1599,
			categories: [categoryIds['Living Room']],
			description: '<p>Sculptural three-seat sofa with deep cushions and bolster arms. Upholstered in performance velvet — stain-resistant and pet-friendly. Solid oak legs with a natural finish.</p>',
			sku: 'HVN-LR-002',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Performance velvet' },
				{ name: 'Seats', value: '3' },
				{ name: 'Dimensions', value: '84" W x 36" D x 32" H' },
				{ name: 'Legs', value: 'Solid oak, natural finish' },
			],
		},
		{
			name: 'Milo Walnut Coffee Table',
			type: 'physical',
			weight: 45,
			price: 649,
			categories: [categoryIds['Living Room']],
			description: '<p>Solid walnut coffee table with waterfall edge detailing. Matte lacquer finish protects the natural grain while maintaining a soft, tactile surface. Sized for smaller living rooms.</p>',
			sku: 'HVN-LR-003',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Solid walnut' },
				{ name: 'Dimensions', value: '48" W x 24" D x 16" H' },
				{ name: 'Finish', value: 'Matte lacquer' },
			],
		},
		{
			name: 'Hana Linen Accent Chair',
			type: 'physical',
			weight: 42,
			price: 799,
			categories: [categoryIds['Living Room']],
			description: '<p>Winged-back accent chair upholstered in Belgian linen. Gently curved arms and a generously padded seat. The kind of chair people fight over.</p>',
			sku: 'HVN-LR-004',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Belgian linen' },
				{ name: 'Dimensions', value: '32" W x 30" D x 33" H' },
				{ name: 'Fill', value: 'High-resilience foam + fiber wrap' },
			],
		},
		{
			name: 'Modular Bouclé Sofa System',
			type: 'physical',
			weight: 210,
			price: 3299,
			categories: [categoryIds['Living Room']],
			description: '<p>Four-piece modular system in textured bouclé fabric. Rearrange for movie night, hosting, or everyday lounging. Removable, washable covers. Each module connects with hidden brackets.</p>',
			sku: 'HVN-LR-005',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Bouclé fabric (removable covers)' },
				{ name: 'Seats', value: '6 (configurable)' },
				{ name: 'Modules', value: '4 pieces' },
				{ name: 'Dimensions', value: '120" W x 96" D x 30" H (as shown)' },
			],
		},
		{
			name: 'Carrara Marble Side Table',
			type: 'physical',
			weight: 28,
			price: 349,
			categories: [categoryIds['Living Room']],
			description: '<p>Round side table with genuine Carrara marble top and brushed brass pedestal base. Each marble top has unique veining — no two tables are identical.</p>',
			sku: 'HVN-LR-006',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Carrara marble top, brushed brass base' },
				{ name: 'Dimensions', value: '16" dia x 22" H' },
			],
		},
		{
			name: 'Arc Floor Lamp',
			type: 'physical',
			weight: 18,
			price: 289,
			categories: [categoryIds['Living Room']],
			description: '<p>Overarching floor lamp with natural linen drum shade. Adjustable height and arm reach. Weighted base prevents tipping. Places light exactly where you need it without ceiling fixtures.</p>',
			sku: 'HVN-LR-007',
			is_visible: true,
			custom_fields: [
				{ name: 'Height', value: '72" (adjustable)' },
				{ name: 'Material', value: 'Brushed steel, linen shade' },
				{ name: 'Bulb', value: 'E26 standard (not included)' },
			],
		},
		{
			name: 'Maren Media Console',
			type: 'physical',
			weight: 85,
			price: 1149,
			categories: [categoryIds['Living Room']],
			description: '<p>Low-profile media console in white oak with slatted cabinet doors. Cable management channels keep cords hidden. Holds TVs up to 65 inches. Two adjustable interior shelves per cabinet.</p>',
			sku: 'HVN-LR-008',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Solid white oak' },
				{ name: 'Dimensions', value: '64" W x 18" D x 24" H' },
				{ name: 'TV Size', value: 'Up to 65"' },
			],
		},
		{
			name: 'Wool Blend Area Rug — Ivory',
			type: 'physical',
			weight: 25,
			price: 599,
			categories: [categoryIds['Living Room']],
			description: '<p>Hand-tufted area rug in an ivory/oatmeal blend. Wool-nylon blend for softness and durability. Low pile, vacuum-friendly. Defines the room without competing with the furniture.</p>',
			sku: 'HVN-LR-009',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: '80% wool, 20% nylon' },
				{ name: 'Size', value: "8' x 10'" },
				{ name: 'Pile Height', value: '0.5"' },
			],
		},
		{
			name: 'Linen Throw Pillow Set',
			type: 'physical',
			weight: 4,
			price: 89,
			categories: [categoryIds['Living Room']],
			description: '<p>Set of two 20" throw pillows in stonewashed linen. Removable covers with hidden zipper. Down-alternative insert included. The texture that makes a sofa look finished.</p>',
			sku: 'HVN-LR-010',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Stonewashed linen covers, down-alternative fill' },
				{ name: 'Size', value: '20" x 20" (set of 2)' },
			],
		},
		{
			name: 'Faye Leather Ottoman',
			type: 'physical',
			weight: 35,
			price: 549,
			categories: [categoryIds['Living Room']],
			description: '<p>Round ottoman in full-grain leather with blind-tufted top. Works as a footrest, extra seat, or coffee table with a tray. Solid oak legs.</p>',
			sku: 'HVN-LR-011',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Full-grain leather' },
				{ name: 'Dimensions', value: '32" dia x 17" H' },
			],
		},
		{
			name: 'Ceramic Table Lamp — Pair',
			type: 'physical',
			weight: 12,
			price: 199,
			categories: [categoryIds['Living Room']],
			description: '<p>Set of two ceramic table lamps with linen shades. Hand-glazed in a warm sand finish. Simple silhouette that works on nightstands, consoles, or side tables.</p>',
			sku: 'HVN-LR-012',
			is_visible: true,
			custom_fields: [
				{ name: 'Height', value: '22"' },
				{ name: 'Material', value: 'Hand-glazed ceramic, linen shade' },
				{ name: 'Set', value: 'Pair (2 lamps)' },
			],
		},
		{
			name: 'Oak Bookcase — Tall',
			type: 'physical',
			weight: 75,
			price: 879,
			categories: [categoryIds['Living Room']],
			description: '<p>Five-shelf open bookcase in solid white oak. Tapered legs and a clean profile. Adjustable shelves hold books, objects, and plants. Anti-tip wall anchor included.</p>',
			sku: 'HVN-LR-013',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Solid white oak' },
				{ name: 'Dimensions', value: '36" W x 14" D x 72" H' },
				{ name: 'Shelves', value: '5 (3 adjustable)' },
			],
		},
		{
			name: 'Woven Storage Basket Set',
			type: 'physical',
			weight: 6,
			price: 129,
			categories: [categoryIds['Living Room']],
			description: '<p>Set of three nesting baskets in natural seagrass with leather handles. Styled storage that hides blankets, magazines, or toys. Handwoven — slight variations are part of the character.</p>',
			sku: 'HVN-LR-014',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Natural seagrass, leather handles' },
				{ name: 'Set', value: '3 nesting sizes (S/M/L)' },
			],
		},
		{
			name: 'Concrete Planter — Large',
			type: 'physical',
			weight: 22,
			price: 79,
			categories: [categoryIds['Living Room']],
			description: '<p>Cylindrical planter in lightweight fiber-reinforced concrete. Drainage hole with plug. Works indoors or on a covered patio. The weight says substance without being immovable.</p>',
			sku: 'HVN-LR-015',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Fiber-reinforced concrete' },
				{ name: 'Dimensions', value: '14" dia x 16" H' },
				{ name: 'Drainage', value: 'Yes (with plug)' },
			],
		},

		// ── Office / Dorm (15 products) ──
		{
			name: 'Compact Student Desk',
			type: 'physical',
			weight: 35,
			price: 129,
			categories: [categoryIds['Office']],
			description: '<p>Space-efficient desk with built-in cable management tray. Fits standard dorm rooms at 48 inches wide. Engineered wood top on a powder-coated steel frame. Assembles in 15 minutes.</p>',
			sku: 'HVN-OF-001',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Engineered wood top, steel frame' },
				{ name: 'Dimensions', value: '48" W x 24" D x 30" H' },
				{ name: 'Weight Capacity', value: '150 lbs' },
			],
		},
		{
			name: 'Ergo Mesh Task Chair',
			type: 'physical',
			weight: 38,
			price: 249,
			categories: [categoryIds['Office']],
			description: '<p>Breathable mesh-back task chair with adjustable lumbar support, seat height, and armrests. Rated for 8+ hours of daily use. 5-year warranty covers the mechanism and gas cylinder.</p>',
			sku: 'HVN-OF-002',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Mesh back, molded foam seat' },
				{ name: 'Adjustable', value: 'Height, lumbar, armrests, tilt tension' },
				{ name: 'Weight Capacity', value: '275 lbs' },
				{ name: 'Warranty', value: '5 years' },
			],
		},
		{
			name: 'Platform Bed Frame — Twin',
			type: 'physical',
			weight: 42,
			price: 149,
			categories: [categoryIds['Office']],
			description: '<p>Low-profile platform bed frame in powder-coated steel. No box spring needed — slat system supports any mattress type. 12 inches of under-bed clearance for storage bins.</p>',
			sku: 'HVN-OF-003',
			is_visible: true,
			custom_fields: [
				{ name: 'Size', value: 'Twin (38" x 75")' },
				{ name: 'Material', value: 'Powder-coated steel' },
				{ name: 'Under-bed Clearance', value: '12"' },
				{ name: 'Weight Capacity', value: '350 lbs' },
			],
		},
		{
			name: '3-Drawer Rolling Cart',
			type: 'physical',
			weight: 15,
			price: 89,
			categories: [categoryIds['Office']],
			description: '<p>Compact rolling storage cart with three fabric drawers. Tucks under most desks. Locking casters keep it in place when needed. The organizer for small spaces.</p>',
			sku: 'HVN-OF-004',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Steel frame, fabric drawers' },
				{ name: 'Dimensions', value: '18" W x 12" D x 28" H' },
				{ name: 'Casters', value: 'Locking' },
			],
		},
		{
			name: 'LED Desk Lamp with USB',
			type: 'physical',
			weight: 3,
			price: 39,
			categories: [categoryIds['Office']],
			description: '<p>Adjustable LED desk lamp with built-in USB-A charging port. Three color temperatures and five brightness levels. Flexible neck positions light where you need it. 10W, 50,000-hour rated.</p>',
			sku: 'HVN-OF-005',
			is_visible: true,
			custom_fields: [
				{ name: 'Light', value: '3 color temps, 5 brightness levels' },
				{ name: 'USB', value: 'USB-A charging port' },
				{ name: 'Power', value: '10W LED, 50,000 hours' },
			],
		},
		{
			name: 'Standing Desk — Electric',
			type: 'physical',
			weight: 95,
			price: 599,
			categories: [categoryIds['Office']],
			description: '<p>Electric sit-stand desk with dual motors and three memory presets. Bamboo desktop on a steel frame. Adjusts from 28 to 48 inches in under 10 seconds. The desk that moves with your day.</p>',
			sku: 'HVN-OF-006',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Bamboo top, steel frame' },
				{ name: 'Height Range', value: '28" - 48"' },
				{ name: 'Motor', value: 'Dual motor, 3 memory presets' },
				{ name: 'Weight Capacity', value: '300 lbs' },
			],
		},
		{
			name: 'Industrial Bookshelf — 5 Tier',
			type: 'physical',
			weight: 40,
			price: 79,
			categories: [categoryIds['Office']],
			description: '<p>Five-tier open bookshelf in engineered wood and powder-coated steel. Industrial aesthetic, 24 inches wide. Each shelf holds 50 lbs. Anti-tip hardware included.</p>',
			sku: 'HVN-OF-007',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Engineered wood + steel' },
				{ name: 'Dimensions', value: '24" W x 12" D x 60" H' },
				{ name: 'Shelves', value: '5' },
				{ name: 'Capacity', value: '50 lbs per shelf' },
			],
		},
		{
			name: 'Bamboo Monitor Stand',
			type: 'physical',
			weight: 4,
			price: 45,
			categories: [categoryIds['Office']],
			description: '<p>Desktop monitor riser in natural bamboo with built-in organizer. Drawer for pens, cables, and small items. Slots for phone and tablet. Raises monitor 4 inches to reduce neck strain.</p>',
			sku: 'HVN-OF-008',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Natural bamboo' },
				{ name: 'Dimensions', value: '20" W x 8" D x 4" H' },
				{ name: 'Features', value: 'Drawer, phone slot, tablet slot' },
			],
		},
		{
			name: 'Wall-Mounted Floating Shelf Set',
			type: 'physical',
			weight: 8,
			price: 59,
			categories: [categoryIds['Office']],
			description: '<p>Set of two floating shelves in walnut veneer. Hidden bracket mounting for a clean look. Each shelf holds 25 lbs. Display books, plants, or photos without floor space.</p>',
			sku: 'HVN-OF-009',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Walnut veneer over MDF' },
				{ name: 'Dimensions', value: '24" W x 8" D x 1.5" H (each)' },
				{ name: 'Set', value: '2 shelves' },
			],
		},
		{
			name: 'Cork Desk Pad',
			type: 'physical',
			weight: 2,
			price: 35,
			categories: [categoryIds['Office']],
			description: '<p>Full-desk cork pad in natural tan. Protects the desktop surface and dampens keyboard noise. Smooth top for mouse tracking. Naturally antimicrobial.</p>',
			sku: 'HVN-OF-010',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Natural cork' },
				{ name: 'Dimensions', value: '36" W x 17" D x 0.12" H' },
			],
		},
		{
			name: 'Fabric Storage Ottoman — Dorm',
			type: 'physical',
			weight: 12,
			price: 69,
			categories: [categoryIds['Office']],
			description: '<p>Collapsible storage ottoman in heathered grey fabric. Lid flips to reveal hidden storage for blankets, books, or laundry. Doubles as extra seating. Folds flat when not in use.</p>',
			sku: 'HVN-OF-011',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Polyester fabric, MDF frame' },
				{ name: 'Dimensions', value: '16" x 16" x 16"' },
				{ name: 'Weight Capacity', value: '200 lbs (as seat)' },
			],
		},
		{
			name: 'Clip-On Ring Light',
			type: 'physical',
			weight: 1,
			price: 29,
			categories: [categoryIds['Office']],
			description: '<p>10-inch ring light with flexible gooseneck clip mount. Three color temperatures and 10 brightness levels. Clips to desks, shelves, or bed frames. USB-powered — no outlet needed.</p>',
			sku: 'HVN-OF-012',
			is_visible: true,
			custom_fields: [
				{ name: 'Size', value: '10" ring' },
				{ name: 'Mount', value: 'Clip + flexible gooseneck' },
				{ name: 'Power', value: 'USB (cable included)' },
			],
		},
		{
			name: 'Stackable Desk Organizer',
			type: 'physical',
			weight: 3,
			price: 25,
			categories: [categoryIds['Office']],
			description: '<p>Three-tier stackable organizer in matte white steel. Letter tray, supply caddy, and file sorter. Keeps a small desk functional without clutter.</p>',
			sku: 'HVN-OF-013',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Powder-coated steel' },
				{ name: 'Tiers', value: '3 (stackable)' },
				{ name: 'Color', value: 'Matte white' },
			],
		},
		{
			name: 'Under-Desk Cable Tray',
			type: 'physical',
			weight: 2,
			price: 19,
			categories: [categoryIds['Office']],
			description: '<p>Mesh cable management tray that mounts under any desk. Holds power strips, chargers, and cables out of sight. No-drill clamp mount. Because visible cables ruin a clean desk.</p>',
			sku: 'HVN-OF-014',
			is_visible: true,
			custom_fields: [
				{ name: 'Material', value: 'Steel mesh' },
				{ name: 'Dimensions', value: '16" W x 5" D x 3" H' },
				{ name: 'Mount', value: 'No-drill clamp' },
			],
		},
		{
			name: 'Dorm Essentials Bundle',
			type: 'physical',
			weight: 55,
			price: 399,
			sale_price: 349,
			categories: [categoryIds['Office']],
			description: '<p>Everything for move-in day in one box. Includes: Compact Student Desk, Platform Bed Frame (Twin), and 3-Drawer Rolling Cart. Save $68 vs. buying separately. Ships in two boxes.</p>',
			sku: 'HVN-OF-015',
			is_visible: true,
			custom_fields: [
				{ name: 'Includes', value: 'Desk + Bed Frame + Rolling Cart' },
				{ name: 'Savings', value: '$68 vs. individual items' },
				{ name: 'Ships', value: '2 boxes' },
			],
		},
	];

	let created = 0;
	for (const product of products) {
		const res = await api('POST', '/catalog/products', product);
		created++;
		console.log(`  [${created}/${products.length}] Created: ${product.name} ($${product.price}) [ID: ${res.data.id}]`);
	}

	console.log(`  Done. Created ${created} products.`);
}

// ─── Run ────────────────────────────────────────────────────────────

async function main() {
	console.log('Haven Demo Store — Catalog Setup');
	console.log(`Store: ${STORE}`);
	console.log('================================');

	await deleteAllProducts();
	await deleteAllCategories();
	const categoryIds = await createCategories();
	await createProducts(categoryIds);

	console.log('\n================================');
	console.log('Catalog setup complete.');
	console.log(`Categories: ${Object.keys(categoryIds).length}`);
	console.log('Products: 30 (15 Living Room, 15 Office)');
}

main().catch(console.error);
