import { describe, expect, it } from 'vitest';
import {
	auditClassifiedDependencyClosure,
	deriveLocalParityPaths,
	findWorkspaceRoot,
	KIBBLE_PARITY_ADAPTED_SOURCE_FILES,
	KIBBLE_PARITY_DEFAULT_ROUTES,
	KIBBLE_PARITY_PDP_SOURCE_FILES,
	readLocalParityRoutes,
	verifyPinnedAdaptedSourceDigests,
	verifyPinnedPdpSourceDigests,
	verifyPinnedSourceCommit,
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
			'home', 'plp', 'pdp-review', 'search', 'error-empty', 'cart', 'account', 'subscriptions',
			'account-subscriptions', 'subscription-detail', 'checkout', 'checkout-gift', 'checkout-prepaid',
			'checkout-confirmation', 'error-404',
		]);
	});

	it('rejects an unclassified local import and an unreachable adapted file', () => {
		const applicationPath = 'apps/storefront-svelte';
		const root = `${applicationPath}/src/routes/search/+page.svelte`;
		const adapted = `${applicationPath}/src/lib/components/SearchInput.svelte`;
		const orphan = `${applicationPath}/src/lib/components/Orphan.svelte`;
		const closure = {
			roots: [root],
			adapted: [{ path: root }, { path: adapted }, { path: orphan }],
			excluded: [{ module: '$lib/components/ProductCard.svelte' }],
			external: [{ module: './$types' }],
		};
		const audit = auditClassifiedDependencyClosure(closure, {
			[root]: "import SearchInput from '$lib/components/SearchInput.svelte'; import ProductCard from '$lib/components/ProductCard.svelte'; import type { PageData } from './$types'; import Bad from '$lib/components/Bad.svelte';",
			[adapted]: '',
			[orphan]: '',
		}, applicationPath);
		expect(audit.unclassified).toEqual([`${root}:$lib/components/Bad.svelte`]);
		expect(audit.unreachable).toEqual([orphan]);
	});

	it('requires the checked-out canonical source to be the pinned commit', () => {
		expect(() => verifyPinnedSourceCommit('ef122b8e17b9eb0b327c9d42491c44a61577ead4')).not.toThrow();
		expect(() => verifyPinnedSourceCommit('0'.repeat(40))).toThrow(/source commit mismatch/);
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
