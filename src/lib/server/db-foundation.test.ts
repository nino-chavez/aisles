import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getRequestDb } from './db';
import { requireDatabaseUrl } from './db-policy';

const migration = readFileSync(
	resolve(import.meta.dirname, '../../../supabase/migrations/20260812200405_create_brand_scoped_aisles_schema.sql'),
	'utf8',
);
const wrangler = readFileSync(resolve(import.meta.dirname, '../../../wrangler.toml'), 'utf8');

describe('database foundation', () => {
	it('fails required paths when DATABASE_URL is absent', () => {
		expect(() => requireDatabaseUrl(undefined)).toThrow('DATABASE_URL not configured');
	});

	it('allows the explicit optional storefront fallback', () => {
		expect(requireDatabaseUrl(undefined, 'optional')).toBeNull();
		expect(requireDatabaseUrl('postgresql://example')).toBe('postgresql://example');
	});

	it('does not reuse a client across request contexts', () => {
		let created = 0;
		const create = (connectionString: string) => ({ connectionString, id: ++created });
		const firstRequest = {};
		const secondRequest = {};

		expect(getRequestDb(firstRequest, 'postgresql://hyperdrive', create)).toBe(
			getRequestDb(firstRequest, 'postgresql://hyperdrive', create),
		);
		expect(getRequestDb(secondRequest, 'postgresql://hyperdrive', create)).not.toBe(
			getRequestDb(firstRequest, 'postgresql://hyperdrive', create),
		);
		expect(created).toBe(2);
	});

	it('enables Node compatibility and binds Hyperdrive in Pages', () => {
		expect(wrangler).toContain('compatibility_flags = ["nodejs_compat"]');
		expect(wrangler).toContain('binding = "HYPERDRIVE"');
		expect(wrangler).toContain('id = "7ad29b1caf5845d48f93b59fa15fc83b"');
	});

	it('scopes product and session identities by brand', () => {
		expect(migration).toContain('UNIQUE (brand_id, bc_entity_id)');
		expect(migration).toContain('UNIQUE (brand_id, session_id)');
	});

	it('enables RLS without public grants or policies', () => {
		for (const table of ['enriched_products', 'generation_logs', 'session_outcomes', 'merchandising_rules']) {
			expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
		}
		expect(migration).not.toContain('CREATE POLICY');
		expect(migration).not.toContain('GRANT ');
	});
});
