import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(import.meta.dirname, path), 'utf8');

describe('Kibble Preserve failure surface', () => {
	it('uses a Kibble-native conditional error shell and retains a legacy branch', () => {
		const errorRoute = source('+error.svelte');
		expect(errorRoute).toContain("chromeMode === 'reference'");
		expect(errorRoute).toContain('<KibbleErrorReference');
		expect(errorRoute).toContain('$page.status');
		expect(errorRoute).toContain('$page.error?.message');
		expect(errorRoute).not.toContain('$props()');
		expect(errorRoute).toContain('{:else}');
	});

	it('keeps internal adapter detail behind the dev boundary', () => {
		for (const serverRoute of ['+page.server.ts', 'category/[slug]/+page.server.ts']) {
			const routeSource = source(serverRoute);
			expect(routeSource).toContain('console.error');
			expect(routeSource).toMatch(/throw error\(503, dev \?/);
			expect(routeSource).toContain('temporarily unavailable');
		}
	});
});
