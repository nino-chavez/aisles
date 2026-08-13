import { describe, expect, it } from 'vitest';
import { deriveLocalParityPaths, findWorkspaceRoot, readLocalParityRoutes } from './kibble-parity-local';

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
});
