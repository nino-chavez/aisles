import { describe, expect, it } from 'vitest';
import {
	deriveLocalParityPaths,
	findWorkspaceRoot,
	KIBBLE_PARITY_PDP_SOURCE_FILES,
	readLocalParityRoutes,
	verifyPinnedPdpSourceDigests,
} from './kibble-parity-local';

describe('Kibble local visual parity runner', () => {
	it('uses Home by default and supports an explicit route matrix', () => {
		expect(readLocalParityRoutes(undefined)).toEqual([{ id: 'home', path: '/' }]);
		expect(readLocalParityRoutes('[{"id":"home","path":"/"},{"id":"plp","path":"/category/dog-food"}]')).toEqual([
			{ id: 'home', path: '/' }, { id: 'plp', path: '/category/dog-food' },
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

	it('requires every locally rendered PDP source file to match its canonical SHA', () => {
		const exact = Object.fromEntries(KIBBLE_PARITY_PDP_SOURCE_FILES.map(({ path, sha256 }) => [path, sha256]));
		expect(() => verifyPinnedPdpSourceDigests(exact)).not.toThrow();

		const tampered = { ...exact, [KIBBLE_PARITY_PDP_SOURCE_FILES[0].path]: '0'.repeat(64) };
		expect(() => verifyPinnedPdpSourceDigests(tampered)).toThrow(/PDP source SHA mismatch/);

		const missing = { ...exact };
		delete missing[KIBBLE_PARITY_PDP_SOURCE_FILES[1].path];
		expect(() => verifyPinnedPdpSourceDigests(missing)).toThrow(/received missing/);
	});
});
