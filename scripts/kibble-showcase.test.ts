import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveLocalParityPaths, findWorkspaceRoot, KIBBLE_PARITY_FIXED_DATA_IDENTITY } from './kibble-parity-local';
import {
	KIBBLE_SHOWCASE_DATA_SOURCE,
	KIBBLE_SHOWCASE_PINNED_FIXTURE_SHA256,
	SYNTHETIC_KIBBLE_ENTITY_IDS,
	SYNTHETIC_PERSONA_FIT_BY_ENTITY_ID,
	getEnrichmentByEntityIds,
} from './fixtures/kibble-showcase-enrichment';
import {
	KIBBLE_SHOWCASE_DEFAULT_PORT,
	KIBBLE_SHOWCASE_SCENARIO_ID,
	buildShowcaseChildEnvironment,
	isExpectedShowcaseExit,
	readShowcaseHost,
	readShowcasePort,
	showcaseRootUrl,
	showcaseUrl,
} from './kibble-showcase';

const repositoryRoot = process.cwd();
const fixturePath = deriveLocalParityPaths(findWorkspaceRoot(repositoryRoot)).fixturePath;
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { products: Array<{ bc_product_id: number }> };
const personas = ['gatherer', 'hunter', 'researcher', 'gifter'] as const;

function rank(persona: typeof personas[number]): number[] {
	return [...SYNTHETIC_KIBBLE_ENTITY_IDS].sort((a, b) => {
		const scoreDifference = SYNTHETIC_PERSONA_FIT_BY_ENTITY_ID[b][persona] - SYNTHETIC_PERSONA_FIT_BY_ENTITY_ID[a][persona];
		return scoreDifference || a - b;
	});
}

describe('Kibble local showcase', () => {
	it('binds synthetic enrichment to the same pinned catalog identity', () => {
		const digest = createHash('sha256').update(readFileSync(fixturePath)).digest('hex');
		expect(KIBBLE_SHOWCASE_PINNED_FIXTURE_SHA256).toBe(KIBBLE_PARITY_FIXED_DATA_IDENTITY);
		expect(digest).toBe(KIBBLE_SHOWCASE_PINNED_FIXTURE_SHA256);
		expect(KIBBLE_SHOWCASE_DATA_SOURCE).toBe('Synthetic demo enrichment — not merchant data');
	});

	it('covers every product in the pinned candidate catalog and preserves the production query shape', async () => {
		const requiredEntityIds = fixture.products.map(({ bc_product_id }) => bc_product_id);
		expect(new Set(SYNTHETIC_KIBBLE_ENTITY_IDS)).toEqual(new Set(requiredEntityIds));
		const enrichment = await getEnrichmentByEntityIds([...requiredEntityIds, 999999]);
		expect([...enrichment.keys()]).toEqual(requiredEntityIds);
		for (const record of enrichment.values()) expect(record).toMatchObject({ bcEntityId: expect.any(Number), personaFit: expect.any(Object), semanticTags: expect.any(Array), compatibleWith: expect.any(Array), petProfile: expect.any(Object) });
	});

	it('keeps every synthetic score finite and within the production 0..1 range', () => {
		for (const scores of Object.values(SYNTHETIC_PERSONA_FIT_BY_ENTITY_ID)) {
			for (const score of Object.values(scores)) {
				expect(Number.isFinite(score)).toBe(true);
				expect(score).toBeGreaterThanOrEqual(0);
				expect(score).toBeLessThanOrEqual(1);
			}
		}
	});

	it('gives each persona a distinct deterministic ranking', () => {
		const firstPass = personas.map(rank);
		const secondPass = personas.map(rank);
		expect(secondPass).toEqual(firstPass);
		expect(new Set(firstPass.map((ranking) => ranking.join(','))).size).toBe(personas.length);
	});

	it('keeps fixture aliases in the showcase config and out of normal production config', () => {
		const showcaseConfig = readFileSync(resolve(process.cwd(), 'scripts/kibble-showcase-vite.config.ts'), 'utf8');
		const productionConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');
		const wranglerConfig = readFileSync(resolve(process.cwd(), 'wrangler.toml'), 'utf8');
		expect(showcaseConfig).toContain("'postgres'");
		expect(showcaseConfig).toContain('src/lib/server/enrichment/query.ts');
		expect(showcaseConfig).toContain('kibble-showcase-enrichment.ts');
		expect(showcaseConfig).toContain('x-kibble-showcase-enrichment-source');
		for (const source of [productionConfig, wranglerConfig]) {
			expect(source).not.toContain('kibble-showcase');
			expect(source).not.toContain('kibble-showcase-enrichment');
		}
	});

	it('rejects unsafe ports and non-local hosts', () => {
		expect(readShowcasePort(undefined)).toBe(KIBBLE_SHOWCASE_DEFAULT_PORT);
		expect(readShowcasePort('5175')).toBe(5175);
		expect(() => readShowcasePort('80')).toThrow(/non-privileged/);
		expect(() => readShowcasePort('65536')).toThrow(/non-privileged/);
		expect(() => readShowcasePort('5174.5')).toThrow(/whole-number/);
		expect(readShowcaseHost(undefined)).toBe('127.0.0.1');
		expect(() => readShowcaseHost('0.0.0.0')).toThrow(/localhost/);
		expect(showcaseRootUrl('127.0.0.1', 5174)).toBe('http://127.0.0.1:5174/');
		expect(showcaseUrl('127.0.0.1', 5174, 'hunter')).toBe('http://127.0.0.1:5174/?observe=true&intent=hunter');
	});

	it('blanks production connections and stamps synthetic provenance in the child environment', () => {
		const child = buildShowcaseChildEnvironment({
			PATH: '/usr/bin',
			KV_REST_API_URL: 'https://real-redis.example',
			KV_REST_API_TOKEN: 'real-token',
			DATABASE_URL: 'postgres://real',
			ANTHROPIC_API_KEY: 'real-model-key',
			KIBBLE_DEMO_AI_ENABLED: 'true',
			BIGCOMMERCE_ACCESS_TOKEN: 'real-management-token',
			NODE_OPTIONS: '--trace-warnings',
		}, '/tmp/catalog.json', '/tmp/interceptor.cjs');
		expect(child).toMatchObject({
			PATH: '/usr/bin',
			KV_REST_API_URL: '',
			KV_REST_API_TOKEN: '',
			DATABASE_URL: '',
			ANTHROPIC_API_KEY: '',
			KIBBLE_DEMO_AI_ENABLED: '',
			BIGCOMMERCE_ACCESS_TOKEN: '',
			KIBBLE_SHOWCASE_SCENARIO_ID,
			KIBBLE_SHOWCASE_DATA_SOURCE,
		});
		expect(child.NODE_OPTIONS).toContain('--trace-warnings');
		expect(child.NODE_OPTIONS).toContain('--require=/tmp/interceptor.cjs');
		expect(child.KIBBLE_PARITY_ATTESTATION_KEY).toBe('');
	});

	it('treats conventional terminal exits as an intentional local shutdown', () => {
		expect(isExpectedShowcaseExit(0, null)).toBe(true);
		expect(isExpectedShowcaseExit(130, null)).toBe(true);
		expect(isExpectedShowcaseExit(143, null)).toBe(true);
		expect(isExpectedShowcaseExit(null, 'SIGINT')).toBe(true);
		expect(isExpectedShowcaseExit(1, null)).toBe(false);
	});
});
