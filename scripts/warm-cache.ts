/**
 * Pre-generate and cache layouts for common persona+category combinations.
 * Run after deployment to fill the cache so first visitors get instant layouts.
 *
 * Usage: npx tsx scripts/warm-cache.ts [brand|all]
 * Examples:
 *   npx tsx scripts/warm-cache.ts          # warm Haven (default)
 *   npx tsx scripts/warm-cache.ts volt      # warm Volt
 *   npx tsx scripts/warm-cache.ts all       # warm all brands
 */

const PERSONAS = ['gatherer', 'hunter', 'researcher', 'gifter'];

const BRANDS: Record<string, { url: string; categories: string[] }> = {
	haven: {
		url: 'https://aisles-signal-x-studio-labs.vercel.app',
		categories: ['living-room', 'bedroom', 'dining', 'office', 'outdoor', 'kids'],
	},
	volt: {
		url: 'https://volt-aisles-signal-x-studio-labs.vercel.app',
		categories: ['headphones', 'earbuds', 'speakers', 'gaming'],
	},
	ember: {
		url: 'https://ember-aisles-signal-x-studio-labs.vercel.app',
		categories: ['fire-pits', 'camp-stoves', 'grills', 'accessories'],
	},
};

async function warmOne(baseUrl: string, persona: string, categorySlug: string): Promise<{ ok: boolean; timeMs: number; cached: boolean }> {
	const start = Date.now();
	try {
		const res = await fetch(`${baseUrl}/api/layout`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ persona, categorySlug }),
		});
		const data = await res.json();
		const timeMs = Date.now() - start;
		return { ok: res.ok, timeMs, cached: !!data.meta?.cacheHit };
	} catch {
		return { ok: false, timeMs: Date.now() - start, cached: false };
	}
}

async function warmBrand(brandId: string) {
	const brand = BRANDS[brandId];
	if (!brand) {
		console.error(`Unknown brand: ${brandId}`);
		return;
	}

	// Warm all 4 personas for each category
	const combos = PERSONAS.flatMap((persona) =>
		brand.categories.map((c) => ({ persona, categorySlug: c }))
	);

	console.log(`\n=== ${brandId.toUpperCase()} (${brand.url}) ===`);
	console.log(`${combos.length} combinations\n`);

	let cached = 0, generated = 0, failed = 0;

	for (const { persona, categorySlug } of combos) {
		process.stdout.write(`  ${persona}:${categorySlug}... `);
		const result = await warmOne(brand.url, persona, categorySlug);

		if (!result.ok) {
			console.log(`FAILED (${result.timeMs}ms)`);
			failed++;
		} else if (result.cached) {
			console.log(`CACHED (${result.timeMs}ms)`);
			cached++;
		} else {
			console.log(`GENERATED (${result.timeMs}ms)`);
			generated++;
		}
	}

	console.log(`\n  ${generated} generated, ${cached} cached, ${failed} failed`);
}

async function main() {
	const target = process.argv[2] || 'haven';

	if (target === 'all') {
		for (const brandId of Object.keys(BRANDS)) {
			await warmBrand(brandId);
		}
	} else {
		await warmBrand(target);
	}
}

main();
