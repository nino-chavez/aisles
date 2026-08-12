import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
const sql = vi.hoisted(() => vi.fn(async () => state.rows));

vi.mock('$lib/server/db', () => ({ getDb: () => sql }));
vi.mock('$lib/brand/config', () => ({
	getBrand: () => ({ organizationId: 'kibble-demo-merchant', id: 'kibble' }),
}));

import { GET } from './+server';

const baseRow = {
	type: 'layout', persona: 'researcher', category_slug: 'dog-food', cache_hit: false,
	generation_ms: 10, product_count: 4, input_tokens: 100, output_tokens: 20,
	eval_score: null, prompt_version: 'v5', model: 'test-model', estimated_cost: 0.01,
	session_id: 'session-one', synthetic: false, scenario_id: null, created_at: '2026-08-12T12:00:00Z',
	organization_id: 'kibble-demo-merchant', brand_id: 'kibble',
	provenance_version: 'layout-provenance-v1', reference_status: 'uncontracted_legacy',
	reference_id: null, reference_version: null, policy_version: 'legacy_generated_v1',
	surface: 'plp', route: '/category/dog-food', viewport_class: 'responsive',
	renderer_component_id: 'legacy.layout-renderer', renderer_variant_id: 'legacy.whole-page-responsive-v1',
	decision_source: 'model', input_hash: '0123456789abcdef', catalog_version: 'catalog:0123456789abcdef',
	shopper_context_hash: 'fedcba9876543210', picks_hash: null, incentive_hash: null,
	autonomy_preset: null, effective_capabilities: ['rank_products'], decision_mode: 'model',
	publication_mode: 'live', schema_version: 'legacy-layout-schema-v1',
};

describe('/api/observe/logs provenance mapping', () => {
	beforeEach(() => {
		state.rows = [];
		sql.mockClear();
	});

	it('maps the stored provenance envelope without promoting legacy generation', async () => {
		state.rows = [baseRow];
		const response = await GET({ url: new URL('http://localhost/api/observe/logs?limit=20') } as never);
		const data = await response.json();

		expect(data.logs[0].provenance).toMatchObject({
			organizationId: 'kibble-demo-merchant',
			brandId: 'kibble',
			reference: { status: 'uncontracted_legacy', id: null, version: null },
			policyVersion: 'legacy_generated_v1',
			viewportClass: 'responsive',
			autonomy: { preset: null, decisionMode: 'model', publicationMode: 'live' },
		});
	});

	it('leaves historical rows explicitly without provenance', async () => {
		state.rows = [{ ...baseRow, provenance_version: null }];
		const response = await GET({ url: new URL('http://localhost/api/observe/logs?limit=20') } as never);
		const data = await response.json();

		expect(data.logs[0].provenance).toBeNull();
	});
});
