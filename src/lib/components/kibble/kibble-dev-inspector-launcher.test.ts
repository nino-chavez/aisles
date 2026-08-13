import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import KibbleDevInspectorLauncher from './KibbleDevInspectorLauncher.svelte';

describe('KibbleDevInspectorLauncher', () => {
	it('makes the hidden local inspector discoverable without knowing a query parameter', () => {
		const result = render(KibbleDevInspectorLauncher, { props: { href: '/?dev=true' } });
		expect(result.body).toContain('Local development');
		expect(result.body).toContain('Show decision inspector');
		expect(result.body).toContain('href="/?dev=true"');
	});
});
