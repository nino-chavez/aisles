import { describe, expect, it } from 'vitest';
import {
	deriveLocalParityPaths,
	findWorkspaceRoot,
	KIBBLE_PARITY_ADAPTED_SOURCE_FILES,
	KIBBLE_PARITY_DEFAULT_ROUTES,
	KIBBLE_PARITY_PDP_SOURCE_FILES,
	readLocalParityRoutes,
	verifyPinnedAdaptedSourceDigests,
	verifyPinnedPdpSourceDigests,
} from './kibble-parity-local';

describe('Kibble local visual parity runner', () => {
	it('uses the full shopper-surface matrix by default and supports explicit split paths', () => {
		expect(readLocalParityRoutes(undefined)).toEqual(KIBBLE_PARITY_DEFAULT_ROUTES);
		expect(readLocalParityRoutes('[{"id":"home","path":"/"},{"id":"plp","path":"/category/dog-food"}]')).toEqual([
			{ id: 'home', referencePath: '/', candidatePath: '/' },
			{ id: 'plp', referencePath: '/category/dog-food', candidatePath: '/category/dog-food' },
		]);
		expect(readLocalParityRoutes('[{"id":"pdp","referencePath":"/products/p","candidatePath":"/product/p?dev=true"}]')).toEqual([
			{ id: 'pdp', referencePath: '/products/p', candidatePath: '/product/p?dev=true' },
		]);
		expect(KIBBLE_PARITY_DEFAULT_ROUTES.map(({ id }) => id)).toEqual([
			'home', 'plp', 'pdp-review', 'search', 'cart', 'account', 'subscriptions',
			'checkout-gift', 'checkout-prepaid', 'checkout-confirmation', 'error-404',
		]);
	});

	it('fails closed for an invalid matrix', () => {
		expect(() => readLocalParityRoutes('[]')).toThrow(/at least one/);
		expect(() => readLocalParityRoutes('[{"id":"home","path":"https://example.test"}]')).toThrow(/absolute storefront path/);
		expect(() => readLocalParityRoutes('[{"id":"home","path":"/"},{"id":"home","path":"/x"}]')).toThrow(/unique/);
	});

	it('derives the conventional source checkout without a machine-specific path', () => {
		expect(findWorkspaceRoot('/workspace/dev/apps/aisles/aisles/.worktrees/kibble-parity-local')).toBe('/workspace/dev');
		expect(deriveLocalParityPaths('/workspace/dev')).toEqual({
			referenceRoot: '/workspace/dev/labs/bc-subscriptions/apps/storefront-svelte',
			fixturePath: '/workspace/dev/labs/bc-subscriptions/scripts/kibble-demo/data/seed-output.json',
		});
	});

	it('requires every adapted PDP dependency to match its canonical SHA', () => {
		const exact = Object.fromEntries(KIBBLE_PARITY_PDP_SOURCE_FILES.map(({ path, sha256 }) => [path, sha256]));
		expect(() => verifyPinnedPdpSourceDigests(exact)).not.toThrow();

		const tampered = { ...exact, [KIBBLE_PARITY_PDP_SOURCE_FILES[0].path]: '0'.repeat(64) };
		expect(() => verifyPinnedPdpSourceDigests(tampered)).toThrow(/PDP source SHA mismatch/);

		const missing = { ...exact };
		delete missing[KIBBLE_PARITY_PDP_SOURCE_FILES[1].path];
		expect(() => verifyPinnedPdpSourceDigests(missing)).toThrow(/received missing/);
	});

	it('hashes every adapted route closure and rejects independent mutations', () => {
		const exact = Object.fromEntries(KIBBLE_PARITY_ADAPTED_SOURCE_FILES.map(({ path, sha256 }) => [path, sha256]));
		expect(KIBBLE_PARITY_ADAPTED_SOURCE_FILES.length).toBeGreaterThan(KIBBLE_PARITY_PDP_SOURCE_FILES.length);
		expect(() => verifyPinnedAdaptedSourceDigests(exact)).not.toThrow();

		for (const marker of ['routes/search/+page.svelte', 'routes/cart/+page.svelte', 'routes/account/+layout.svelte', 'routes/checkout/gift/+page.svelte', 'routes/subscriptions/+page.svelte']) {
			const target = KIBBLE_PARITY_ADAPTED_SOURCE_FILES.find(({ path }) => path.includes(marker));
			expect(target, marker).toBeDefined();
			expect(() => verifyPinnedAdaptedSourceDigests({ ...exact, [target!.path]: 'f'.repeat(64) })).toThrow(/adapted source SHA mismatch/);
		}
	});
});
