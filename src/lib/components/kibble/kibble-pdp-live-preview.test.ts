import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateKibblePdpLivePreview } from './kibble-pdp-live-preview';
import type { KibbleProduct } from './types';
import { KIBBLE_PDP_DEFAULT_PRESENTATION, KIBBLE_PDP_PRESENTATION_POLICY } from '$lib/brand/reference/kibble-presentation-decisions';

const products: KibbleProduct[] = [
	{ id: 'starter', entityId: 11, name: 'Starter Bundle', price: 90, image: '', imageAlt: '', description: '', specs: {}, tags: [], category: 'Bundles' },
	{ id: 'mealtime', entityId: 12, name: 'Mealtime Kit', price: 55, image: '', imageAlt: '', description: '', specs: {}, tags: [], category: 'Care' },
	{ id: 'toys', entityId: 13, name: 'Dog Toy Kit', price: 32, image: '', imageAlt: '', description: '', specs: {}, tags: [], category: 'Toys' },
];
const expected = { routePath: '/product/puppy-starter-kit' as const, policyVersion: 'pdp-assist-v1', productIds: ['11', '12', '13'], relatedHeading: 'You may also like' };
function response(ids = ['13', '11', '12']) {
	return {
		version: 'kibble-pdp-presentation-preview-v2', previewOnly: true, routePath: expected.routePath, policyVersion: expected.policyVersion,
		persona: 'researcher', rankedProductIds: ids, provider: 'anthropic', modelId: 'claude-haiku-4-5',
		presentationPolicy: KIBBLE_PDP_PRESENTATION_POLICY,
		zoneArtifacts: {
			related: {
				instanceId: 'pdp.related', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: 1,
				adapterId: 'kibble.zone.pdp.related', componentVariantId: 'kibble.product-detail.related-products', inputSha256: 'a'.repeat(64),
				selection: { componentVariantId: 'kibble.product-detail.related-products', copyVariantId: KIBBLE_PDP_DEFAULT_PRESENTATION.relatedCopyVariantId },
				content: { component: 'product-carousel', props: { title: 'You may also like', products: ids.map((productId) => ({ productId, role: 'standard' })), showQuickAdd: false } },
			},
			marketing: {
				instanceId: 'pdp.below-description', sharedStatus: 'live', sharedContentKind: 'hidden', decisionMode: 'model', modelCallCount: 1,
				adapterId: 'kibble.zone.pdp.below-description', componentVariantId: 'kibble.hero.zone-editorial-header', inputSha256: 'b'.repeat(64),
				selection: { componentVariantId: 'kibble.hero.zone-editorial-header', copyVariantId: 'none', visible: false },
			},
		},
		modelCallCount: 1, provenance: {},
	};
}

describe('Kibble PDP live preview validation', () => {
	it('allows only a server-approved exact related-product permutation', () => {
		const preview = validateKibblePdpLivePreview(response(), expected, products);
		expect(preview?.products.map(({ id }) => id)).toEqual(['toys', 'starter', 'mealtime']);
		expect(preview?.zoneAdapter.decisionMode).toBe('model');
	});

	it.each([
		['duplicate', ['13', '13', '12']],
		['missing', ['13', '11']],
		['extra', ['13', '11', '12', '99']],
		['unknown', ['13', '11', '99']],
	])('rejects %s IDs and retains the stable server-rendered PDP data', (_label, ids) => {
		const snapshot = structuredClone(products);
		expect(validateKibblePdpLivePreview(response(ids), expected, products)).toBeNull();
		expect(products).toEqual(snapshot);
	});

	it('rejects a response that changes the fixed related-products heading', () => {
		const invalid = response();
		invalid.zoneArtifacts.related.content.props.title = 'Model-authored title';
		expect(validateKibblePdpLivePreview(invalid, expected, products)).toBeNull();
	});

	it('rejects the old aggregate decision shape and hidden artifacts with content', () => {
		expect(validateKibblePdpLivePreview({ ...response(), presentationDecision: KIBBLE_PDP_DEFAULT_PRESENTATION }, expected, products)).toBeNull();
		const missing = response() as any;
		delete missing.zoneArtifacts.related;
		expect(validateKibblePdpLivePreview(missing, expected, products)).toBeNull();
		const adjacent = response() as any;
		adjacent.zoneArtifacts['pdp.cross-sell'] = adjacent.zoneArtifacts.marketing;
		expect(validateKibblePdpLivePreview(adjacent, expected, products)).toBeNull();
		const invalid = response() as any;
		invalid.zoneArtifacts.marketing.content = { component: 'editorial-header', props: { eyebrow: '', headline: '', body: '' } };
		expect(validateKibblePdpLivePreview(invalid, expected, products)).toBeNull();
	});

	it('holds repeated paid requests while one action is pending and has a bounded client watchdog', () => {
		const source = readFileSync(resolve(import.meta.dirname, 'kibble-pdp-live-preview.ts'), 'utf8');
		expect(source).toContain('if (controller) return;');
		expect(source).toContain('KIBBLE_DEMO_MAX_PUBLIC_CLIENT_TIMEOUT_MS');
	});
});
