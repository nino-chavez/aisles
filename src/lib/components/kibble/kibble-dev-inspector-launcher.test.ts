import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import KibbleDevInspectorLauncher from './KibbleDevInspectorLauncher.svelte';

describe('KibbleDevInspectorLauncher', () => {
	it('makes the public demo inspector discoverable without knowing a query parameter', () => {
		const result = render(KibbleDevInspectorLauncher, { props: { href: '/?observe=true' } });
		expect(result.body).toContain('Aisles demo');
		expect(result.body).toContain('Show decision inspector');
		expect(result.body).toContain('href="/?observe=true"');
	});
});
